import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import fetchGuildMessage from '../utils/fetchGuildMessage'

const commandRemind: CommandProps = async (message, { guildId, args }) => {
  if (args.length < 3) {
    return {
      content: ':x: 少了幾個參數！這個指令需要訊息ID、時間：`ap!remind [Message ID] [TIME]`',
      isSyntaxError: true,
    }
  }

  const remindAt = moment(args.slice(2).join(' ')).utcOffset(cache.settings[guildId]?.timezone || 8)
  if (!remindAt.isValid()) {
    return {
      content: ':x: 機器人不認識這個時間格式',
      isSyntaxError: true,
    }
  }
  if (remindAt.isBefore()) {
    return {
      content: ':x: 機器人認為你輸入的時間 REMIND_AT 已經過了'.replace(
        'REMIND_AT',
        remindAt.format('YYYY-MM-DD HH:mm'),
      ),
      isSyntaxError: true,
    }
  }

  const { targetMessage, reason } = await fetchGuildMessage(message, args[1])
  if (!targetMessage || !targetMessage.guild) {
    return {
      content: reason || ':question:',
    }
  }

  const remindJobQueue = cache.remindJobs
  const duplicatedRemindJobId = Object.keys(remindJobQueue).find(
    jobId => remindJobQueue[jobId].messageId === targetMessage.id,
  )

  await database.ref(`/remindJobs/${message.id}`).set({
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
