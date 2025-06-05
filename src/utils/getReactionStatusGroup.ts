import { Message } from 'discord.js'
import { ReactionStatusType } from '../types.js'

type ReactionStatusProps = {
  [MemberID: string]: {
    name: string
    status: ReactionStatusType
  }
}

const getReactionStatusGroup: (message: Message<true>) => Promise<Record<ReactionStatusType, string[]>> = async (
  message,
) => {
  const reactionStatus: ReactionStatusProps = {}
  if (message.mentions.everyone) {
    message.guild.members.cache.each((member) => {
      if (!member.user.bot) {
        reactionStatus[member.id] = {
          name: member.displayName,
          status: 'absent',
        }
      }
    })
  } else {
    message.mentions.members?.each((member) => {
      if (!member.user.bot) {
        reactionStatus[member.id] = {
          name: member.displayName,
          status: 'absent',
        }
      }
    })

    message.mentions.roles.each((role) => {
      role.members.each((member) => {
        if (!member.user.bot) {
          reactionStatus[member.id] = {
            name: member.displayName,
            status: 'absent',
          }
        }
      })
    })
  }

  const messageReactions = message.reactions.cache.values()
  for (const messageReaction of messageReactions) {
    let lastUserId = '',
      flag = true
    while (flag) {
      const reactionUsers = await messageReaction.users.fetch({ limit: 100, after: lastUserId || undefined })
      if (reactionUsers.size < 100) {
        flag = false
        break
      }
      lastUserId = reactionUsers.last()?.id || ''
    }

    for (const user of messageReaction.users.cache.values()) {
      if (user.bot) {
        continue
      }
      if (typeof reactionStatus[user.id] === 'undefined') {
        const member = message.guild.members.cache.get(user.id)
        if (member) {
          reactionStatus[user.id] = {
            name: member.displayName,
            status: 'irrelevant',
          }
        } else {
          reactionStatus[user.id] = {
            name: user.username,
            status: 'leaved',
          }
        }
      } else if (reactionStatus[user.id].status === 'absent') {
        reactionStatus[user.id].status = 'reacted'
      }
    }
  }

  for (const memberId in reactionStatus) {
    if (reactionStatus[memberId].status === 'absent') {
      const member = message.guild.members.cache.get(memberId)
      if (
        !member ||
        !message.channel.permissionsFor(member).has('ViewChannel') ||
        !message.channel.permissionsFor(member).has('ReadMessageHistory')
      ) {
        reactionStatus[memberId].status = 'locked'
      }
    }
  }

  const memberNames: Record<ReactionStatusType, string[]> = {
    reacted: [],
    absent: [],
    locked: [],
    irrelevant: [],
    leaved: [],
  }
  for (const memberId in reactionStatus) {
    memberNames[reactionStatus[memberId].status].push(reactionStatus[memberId].name)
  }

  return memberNames
}

export default getReactionStatusGroup
