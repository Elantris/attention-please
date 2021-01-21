import { CommandProps } from '../types'

const commandCheck: CommandProps = async (message, args) => {
  if (!message.guild || !message.client.user) {
    return { content: ':question:' }
  }

  const targetMessageId = args[0]
  if (!targetMessageId) {
    return {
      content: ':x: 請用 Message ID 指定訊息',
      isSyntaxError: true,
    }
  }

  const guildChannels = message.guild.channels.cache.array()
  for (const channel of guildChannels) {
    if (!channel.isText() || !channel.members.has(message.client.user.id)) {
      continue
    }

    try {
      const targetMessage = await channel.messages.fetch(targetMessageId)

      const reactedUserIds: { [UserID: string]: number } = {}
      const messageReactions = targetMessage.reactions.cache.array()
      for (const reaction of messageReactions) {
        const reactionUsers = await reaction.users.fetch()
        reactionUsers.each(user => {
          reactedUserIds[user.id] = 1
        })
      }
      const allMembers = channel.members
        .filter(member => !member.user.bot && !!channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'))
        .filter(
          member =>
            targetMessage.mentions.everyone ||
            targetMessage.mentions.users.has(member.id) ||
            targetMessage.mentions.roles.some(role => role.members.has(member.id)),
        )
      const absentMembers = allMembers.array().filter(member => !reactedUserIds[member.id])
      absentMembers.sort()

      return {
        content: `:bar_chart: 簽到率：**PERCENTAGE%**，(REACTED_MEMBERS / ALL_MEMBERS)`
          .replace('PERCENTAGE', (Object.keys(reactedUserIds).length / allMembers.size).toFixed(2))
          .replace('REACTED_MEMBERS', `${Object.keys(reactedUserIds).length}`)
          .replace('ALL_MEMBERS', `${allMembers.size}`),
        embed: {
          title: `Message ID: \`${targetMessage.id}\``,
          url: targetMessage.url,
          fields: absentMembers
            .reduce((accumulator, value, index) => {
              const chunkIndex = Math.floor(index / 10)
              accumulator[chunkIndex] = ([] as string[]).concat(accumulator[chunkIndex] || [], value.displayName)
              return accumulator
            }, [] as string[][])
            .map((memberNames, pageIndex) => ({
              name: `Page ${pageIndex + 1}`,
              value: memberNames
                .map((memberName, index) => `\`${pageIndex * 10 + index + 1}.\` ${memberName}`)
                .join('\n'),
              inline: true,
            })),
        },
      }
    } catch {}
  }

  return {
    content: ':question: 找不到這則訊息，也許是這隻機器人沒有權限看到它？',
  }
}

export default commandCheck
