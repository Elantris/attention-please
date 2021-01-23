import { DMChannel, Message } from 'discord.js'

type ReactionStatusProps = {
  [UserID: string]: {
    name: string
    emoji: string[]
  }
}

const getMessageReactionStatus: (message: Message) => Promise<ReactionStatusProps> = async message => {
  const channel = message.channel
  if (channel instanceof DMChannel) {
    return {}
  }

  const reactionStatus: ReactionStatusProps = {}

  channel.members
    .filter(member => !member.user.bot && !!channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'))
    .filter(
      member =>
        message.mentions.everyone ||
        message.mentions.users.has(member.id) ||
        message.mentions.roles.some(role => role.members.has(member.id)),
    )
    .each(member => {
      reactionStatus[member.id] = {
        name: member.displayName,
        emoji: [],
      }
    })

  if (Object.keys(reactionStatus).length === 0) {
    return {}
  }

  const reactions = message.reactions.cache.array()
  for (const reaction of reactions) {
    const users = await reaction.users.fetch()
    users.each(user => {
      if (!reactionStatus[user.id]) {
        return
      }
      reactionStatus[user.id].emoji.push(reaction.emoji.name)
    })
  }

  return reactionStatus
}

export default getMessageReactionStatus
