import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import fetchGuildMessage from '../utils/fetchGuildMessage'

const commandRemind: CommandProps = async (message, args) => {
  if (!message.guild) {
    return { content: ':question:' }
  }

  if (args.length < 2) {
    return {
      content: ':x: 少了幾個參數！這者指令需要訊息ID、時間：`ar!remind [Message ID] [TIME]`',
      isSyntaxError: true,
    }
  }

  const remindAt = moment(args.slice(1).join(' ')).utcOffset(cache.settings[message.guild.id]?.timezone || 0)
  if (!remindAt.isValid()) {
    return {
      content: `:x: 機器人不認識這個時間格式`,
      isSyntaxError: true,
    }
  }
  if (remindAt.isBefore()) {
    return {
      content: ':x: 提醒的時間必須設定在未來',
      isSyntaxError: true,
    }
  }

  const targetMessage = await fetchGuildMessage(message, args[0])
  if (!targetMessage || !targetMessage.guild) {
    return {
      content: ':question: 找不到這則訊息，也許是這隻機器人沒有權限看到它？',
    }
  }

  const remindJobQueue = cache.remind_jobs
  const duplicatedRemindJobId = Object.keys(remindJobQueue).find(jobId => remindJobQueue[jobId].messageId === args[0])

  await database.ref(`/remind_jobs/${message.id}`).set({
    remindAt: remindAt.toDate().getTime(),
    guildId: targetMessage.guild.id,
    channelId: targetMessage.channel.id,
    messageId: targetMessage.id,
    responseChannelId: message.channel.id,
    retryTimes: 0,
  })

  if (duplicatedRemindJobId) {
    await database.ref(`/remind_jobs/${duplicatedRemindJobId}`).remove()
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
