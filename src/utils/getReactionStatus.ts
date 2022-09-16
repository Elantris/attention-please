import { ChannelType, Message } from 'discord.js'

const getReactionStatus: (message: Message) => Promise<{
  [MemberID: string]: {
    name: string
    status: 'reacted' | 'absent' | 'locked'
  }
}> = async message => {
  if (!message.channel.isTextBased() || message.channel.type === ChannelType.DM || !message.guild) {
    return {}
  }

  const mentionedMembers: {
    [MemberID: string]: {
      name: string
      status: 'reacted' | 'absent' | 'locked'
    }
  } = {}
  if (message.mentions.everyone) {
    message.guild.members.cache.each(member => {
      if (!member.user.bot) {
        mentionedMembers[member.id] = {
          name: member.displayName,
          status: 'absent',
        }
      }
    })
  } else {
    message.mentions.members?.each(member => {
      if (!member.user.bot) {
        mentionedMembers[member.id] = {
          name: member.displayName,
          status: 'absent',
        }
      }
    })

    message.mentions.roles.each(role => {
      role.members.each(member => {
        if (!member.user.bot) {
          mentionedMembers[member.id] = {
            name: member.displayName,
            status: 'absent',
          }
        }
      })
    })
  }

  if (Object.keys(mentionedMembers).length === 0) {
    return {}
  }

  const messageReactions = message.reactions.cache.values()
  for (const messageReaction of messageReactions) {
    await messageReaction.users.fetch()
    for (const user of messageReaction.users.cache.values()) {
      if (mentionedMembers[user.id]) {
        mentionedMembers[user.id].status = 'reacted'
      }
    }
  }

  for (const memberId in mentionedMembers) {
    if (mentionedMembers[memberId].status === 'absent') {
      const member = message.guild.members.cache.get(memberId)
      if (
        !member ||
        !message.channel.permissionsFor(member).has('ViewChannel') ||
        !message.channel.permissionsFor(member).has('ReadMessageHistory')
      ) {
        mentionedMembers[memberId].status = 'locked'
      }
    }
  }

  return mentionedMembers
}

export default getReactionStatus
