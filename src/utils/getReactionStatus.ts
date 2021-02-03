import { DMChannel, Message } from 'discord.js'

const getReactionStatus: (message: Message) => Promise<string> = async message => {
  const channel = message.channel
  if (channel instanceof DMChannel) {
    return ':question:'
  }

  const reactionStatus: {
    [UserID: string]: {
      name: string
      emoji: string[]
    }
  } = {}

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
    return ':x: 這則訊息沒有被標記的人、或是被標記的人都沒有權限看到這則訊息'
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

  const allMembersCount = Object.keys(reactionStatus).length
  const reactedMembersCount = Object.keys(reactionStatus).filter(userId => reactionStatus[userId].emoji.length).length
  const absentMemberIds = Object.keys(reactionStatus).filter(userId => reactionStatus[userId].emoji.length === 0)

  return ':bar_chart: 已讀人數：**PERCENTAGE%**，(REACTED_MEMBERS / ALL_MEMBERS)\nMESSAGE_URL\nMENTIONS'
    .replace('PERCENTAGE', `${((reactedMembersCount * 100) / allMembersCount).toFixed(2)}`)
    .replace('REACTED_MEMBERS', `${reactedMembersCount}`)
    .replace('ALL_MEMBERS', `${allMembersCount}`)
    .replace('MESSAGE_URL', message.url)
    .replace('MENTIONS', absentMemberIds.map(userId => `<@!${userId}>`).join(' '))
}

export default getReactionStatus
