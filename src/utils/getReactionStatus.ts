import { Message } from 'discord.js'

const getReactionStatus: (message: Message) => Promise<{
  [MemberID: string]: {
    name: string
    status: 'reacted' | 'absent' | 'locked'
  }
}> = async message => {
  if (message.channel.type === 'DM' || !message.guild) {
    throw new Error('Invalid Message')
  }

  await message.guild.members.fetch()

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
    return mentionedMembers
  }

  const messageReactions = message.reactions.cache.values()
  for (const messageReaction of messageReactions) {
    const users = (await messageReaction.users.fetch()).values()
    for (const user of users) {
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
        !message.channel.permissionsFor(member).has('VIEW_CHANNEL') ||
        !message.channel.permissionsFor(member).has('READ_MESSAGE_HISTORY')
      ) {
        mentionedMembers[memberId].status = 'locked'
      }
    }
  }

  return mentionedMembers
}

export default getReactionStatus
