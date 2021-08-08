import { Util } from 'discord.js'
import moment from 'moment'
import { CheckJobProps, CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getReactionStatus from '../utils/getReactionStatus'

const commandCheck: CommandProps = async ({ message, guildId, args }) => {
  if (!args[1]) {
    return {
      content: ':question: 要結算哪一則訊息呢？指定訊息 ID 或訊息連結',
      isSyntaxError: true,
    }
  }

  const { targetMessage, reason } = await fetchGuildMessage(message, args[1])

  if (!targetMessage || !targetMessage.guild) {
    return {
      content: reason || ':x:',
      isSyntaxError: true,
    }
  }

  if (!targetMessage.mentions.everyone && !targetMessage.mentions.roles.size && !targetMessage.mentions.members?.size) {
    return {
      content: ':x: 這則訊息沒有標記的對象，請選擇一個有「@身份組」或「@成員」的訊息',
      isSyntaxError: true,
    }
  }

  if (args[2]) {
    const checkAt = moment(args.slice(2).join(' ')).startOf('minute')
    checkAt.utcOffset(cache.settings[guildId]?.timezone || 8)

    if (!checkAt.isValid()) {
      return {
        content: ':x: 指定預約結算的時間格式好像怪怪的',
        embed: {
          description: '推薦時間格式：`YYYY-MM-DD HH:mm`（西元年-月-日 時:分）\n使用者的輸入：`USER_INPUT`'.replace(
            'USER_INPUT',
            Util.escapeMarkdown(args.slice(2).join(' ')),
          ),
        },
        isSyntaxError: true,
      }
    }

    if (checkAt.isBefore(message.createdTimestamp)) {
      return await getReactionStatus(targetMessage, {
        passedCheckAt: checkAt.from(message.createdTimestamp, true),
      })
    }

    const duplicatedJobId = Object.keys(cache.checkJobs).find(
      jobId => cache.checkJobs[jobId]?.messageId === targetMessage.id,
    )
    const job: CheckJobProps = {
      checkAt: checkAt.toDate().getTime(),
      guildId: targetMessage.guild.id,
      channelId: targetMessage.channel.id,
      messageId: targetMessage.id,
      userId: message.author.id,
      responseChannelId: message.channel.id,
      retryTimes: 0,
      clientId: message.client.user?.id || '',
    }
    await database.ref(`/checkJobs/${message.id}`).set(job)

    if (duplicatedJobId) {
      await database.ref(`/checkJobs/${duplicatedJobId}`).remove()
    }

    return {
      content: (duplicatedJobId
        ? ':alarm_clock: **GUILD_NAME** 變更 `MESSAGE_ID` 結算時間'
        : ':alarm_clock: **GUILD_NAME** 建立 `MESSAGE_ID` 預約結算'
      )
        .replace('GUILD_NAME', message.guild?.name || '')
        .replace('MESSAGE_ID', targetMessage.id),
      embed: {
        description:
          '預約結算：`TIME`\n結算目標：[訊息連結](TARGET_URL)\n\n刪除 [指令訊息](COMMAND_URL) 即可取消預約結算'
            .replace('TIME', checkAt.format('YYYY-MM-DD HH:mm'))
            .replace('TARGET_URL', targetMessage.url)
            .replace('COMMAND_URL', message.url),
      },
    }
  }

  return await getReactionStatus(targetMessage)
}

export default commandCheck
