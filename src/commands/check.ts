import { DMChannel } from 'discord.js'
import { CommandProps } from '../types'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getMessageReactionStatus from '../utils/getMessageReactionStatus'

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

  const targetMessage = await fetchGuildMessage(message, targetMessageId)
  if (!targetMessage || targetMessage.channel instanceof DMChannel) {
    return {
      content: ':question: 找不到這則訊息，也許是這隻機器人沒有權限看到它？',
    }
  }
  const reactionStatus = await getMessageReactionStatus(targetMessage)
  const allMembersCount = Object.keys(reactionStatus).length
  const absentMemberNames = Object.keys(reactionStatus)
    .filter(userId => reactionStatus[userId].emoji.length === 0)
    .sort()
    .map(userId => reactionStatus[userId].name)
  const reactedMembersCount = allMembersCount - absentMemberNames.length

  if (allMembersCount === 0) {
    return {
      content: ':question: 沒有人需要看到這則訊息，似乎沒有標記到活人',
    }
  }

  return {
    content: `:bar_chart: 簽到率：**PERCENTAGE%**，(REACTED_MEMBERS / ALL_MEMBERS)`
      .replace('PERCENTAGE', ((reactedMembersCount * 100) / allMembersCount).toFixed(2))
      .replace('REACTED_MEMBERS', `${reactedMembersCount}`)
      .replace('ALL_MEMBERS', `${allMembersCount}`),
    embed: {
      title: `Message ID: \`${targetMessage.id}\``,
      url: targetMessage.url,
      fields: absentMemberNames
        .reduce((accumulator, value, index) => {
          const chunkIndex = Math.floor(index / 10)
          accumulator[chunkIndex] = ([] as string[]).concat(accumulator[chunkIndex] || [], value)
          return accumulator
        }, [] as string[][])
        .map((memberNames, pageIndex) => ({
          name: `Page ${pageIndex + 1}`,
          value: memberNames.map((memberName, index) => `\`${pageIndex * 10 + index + 1}.\` ${memberName}`).join('\n'),
          inline: true,
        })),
    },
  }
}

export default commandCheck
