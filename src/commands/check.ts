import moment from 'moment'
import { CheckJobProps, CommandProps } from '../types'
import database, { cache } from '../utils/database'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getReactionStatus from '../utils/getReactionStatus'

const commandCheck: CommandProps = async ({ message, guildId, args }) => {
  if (!args[1]) {
    return {
      content: ':x: 要結算哪一則訊息呢？指定訊息 ID 或訊息連結',
      isSyntaxError: true,
    }
  }

  const loadingMessage = await message.channel.send(':mag: 搜尋訊息中. . .').catch(() => null)
  const { targetMessage, reason } = await fetchGuildMessage(message, args[1])
  loadingMessage?.delete().catch(() => {})

  if (!targetMessage || !targetMessage.guild) {
    return {
      content: reason || ':question:',
    }
  }

  if (args[2]) {
    const checkAt = moment(args.slice(2).join(' ')).startOf('minute')
    checkAt.utcOffset(cache.settings[guildId]?.timezone || 8)

    if (!checkAt.isValid()) {
      return {
        content: ':x: 指定的時間好像怪怪的，推薦使用的格式：`YYYY-MM-DD HH:mm`',
        isSyntaxError: true,
      }
    }

    if (checkAt.isAfter()) {
      const updates: CheckJobProps = {
        checkAt: checkAt.toDate().getTime(),
        guildId: targetMessage.guild.id,
        channelId: targetMessage.channel.id,
        messageId: targetMessage.id,
        responseChannelId: message.channel.id,
        retryTimes: 0,
        client: message.client.user?.tag || '',
      }
      await database.ref(`/checkJobs/${message.id}`).set(updates)

      const duplicatedJobId = Object.keys(cache.checkJobs).find(
        jobId => cache.checkJobs[jobId]?.messageId === targetMessage.id,
      )

      if (duplicatedJobId) {
        await database.ref(`/checkJobs/${duplicatedJobId}`).remove()
        return {
          content: ':alarm_clock: `MESSAGE_ID` 的結算時間改為 `CHECK_AT`'
            .replace('MESSAGE_ID', targetMessage.id)
            .replace('CHECK_AT', checkAt.format('YYYY-MM-DD HH:mm')),
        }
      }

      return {
        content: ':alarm_clock: `MESSAGE_ID` 將會在 `CHECK_AT` 列出被標記且沒有按表情符號的成員名單'
          .replace('MESSAGE_ID', targetMessage.id)
          .replace('CHECK_AT', checkAt.format('YYYY-MM-DD HH:mm')),
      }
    }
  }

  return await getReactionStatus(targetMessage)
}

export default commandCheck
