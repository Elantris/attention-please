import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getReactionStatus from '../utils/getReactionStatus'

const commandRemind: CommandProps = async ({ message, guildId, args }) => {
  if (!args[1]) {
    return {
      content: ':x: 要結算哪一則訊息呢？指定訊息 ID 或訊息連結',
      isSyntaxError: true,
    }
  }

  const remindAt = args[2]
    ? moment(args.slice(2).join(' '))
    : moment().add(cache.settings[guildId]?.delay || 1440, 'minutes')
  remindAt.utcOffset(cache.settings[guildId]?.timezone || 8)
  if (!remindAt.isValid()) {
    return {
      content: ':x: 指定的時間好像怪怪的，再試其他格式看看',
      isSyntaxError: true,
    }
  }

  const { targetMessage, reason } = await fetchGuildMessage(message, args[1])
  if (!targetMessage || !targetMessage.guild) {
    return {
      content: reason || ':question:',
    }
  }

  if (remindAt.isBefore()) {
    return await getReactionStatus(targetMessage)
  }

  const remindJobQueue = cache.remindJobs
  const duplicatedRemindJobId = Object.keys(remindJobQueue).find(
    jobId => remindJobQueue[jobId]?.messageId === targetMessage.id,
  )

  await database.ref(`/remindJobs/${message.id}`).set({
    remindAt: remindAt.toDate().getTime(),
    guildId: targetMessage.guild.id,
    channelId: targetMessage.channel.id,
    messageId: targetMessage.id,
    responseChannelId: message.channel.id,
    retryTimes: 0,
    isTest: process.env.NODE_ENV === 'development',
  })

  if (duplicatedRemindJobId) {
    await database.ref(`/remindJobs/${duplicatedRemindJobId}`).remove()
    return {
      content: ':alarm_clock: `MESSAGE_ID` 的結算時間改為 `REMIND_AT`'
        .replace('MESSAGE_ID', targetMessage.id)
        .replace('REMIND_AT', remindAt.format('YYYY-MM-DD HH:mm')),
    }
  }

  return {
    content: ':alarm_clock: `MESSAGE_ID` 將會在 `REMIND_AT` 列出被標記且沒有按表情符號的成員名單'
      .replace('MESSAGE_ID', targetMessage.id)
      .replace('REMIND_AT', remindAt.format('YYYY-MM-DD HH:mm')),
  }
}

export default commandRemind
