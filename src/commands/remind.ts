import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'

const commandRemind: CommandProps = async ({ message, guildId, args }) => {
  if (!cache.settings[guildId]?.enableRemind) {
    return {
      content: ':lock: **GUILD_NAME** 未擁有「訊息提醒」的功能'.replace(
        'GUILD_NAME',
        Util.escapeMarkdown(message.guild?.name || guildId),
      ),
      isSyntaxError: true,
    }
  }

  const remindSettings = cache.remindSettings[message.author.id] || {}

  if (args.length < 3) {
    return {
      content: ':gear: **MEMBER_NAME** 自訂提醒設定：COUNT/8'
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
        .replace('COUNT', `${Object.keys(remindSettings).length}`),
      embed: {
        description: Object.entries(remindSettings)
          .sort((a, b) => a[1] - b[1])
          .map(([emoji, minutes]) => `${emoji}：${minutes} 分鐘`)
          .join('\n'),
      },
    }
  }

  const emoji = args[1]
  const minutes = parseInt(args[2])
  const isCustomEmoji = /^<:\w+:\d+>$/.test(emoji)

  if (emoji.length !== 2 && !isCustomEmoji) {
    return {
      content: ':x: 「EMOJI」這好像不是一個可以使用的表情符號，請換一個再試試看'.replace('EMOJI', emoji),
      isSyntaxError: true,
    }
  }

  if (!Number.isSafeInteger(minutes) || minutes > 1440) {
    return {
      content: ':x: 提醒時間必須是一個小於 1440 的數字',
      isSyntaxError: true,
    }
  }

  if (minutes < 0) {
    await database.ref(`/remindSettings/${message.author.id}/${emoji}`).remove()
    return {
      content: ':gear: **MEMBER_NAME** 移除了 EMOJI 的提醒功能'
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
        .replace('EMOJI', emoji)
        .trim(),
    }
  }

  if (Object.keys(remindSettings).length >= 8) {
    return {
      content: ':lock: 最多只能設定 8 個 emoji 的提醒時間',
      isSyntaxError: true,
    }
  }

  await database.ref(`/remindSettings/${message.author.id}/${emoji}`).set(minutes)

  return {
    content: ':gear: **MEMBER_NAME** 已將 EMOJI 設定為 REMIND_TIME 分鐘'
      .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
      .replace('EMOJI', emoji)
      .replace('REMIND_TIME', `${minutes}`)
      .trim(),
  }
}

export default commandRemind
