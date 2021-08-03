import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'

const commandRemind: CommandProps = async ({ message, guildId, args }) => {
  if (!cache.settings[guildId]?.enableRemind) {
    return {
      content: ':lock: 請先透過 settings 指令啟用「提醒功能」',
      isSyntaxError: true,
    }
  }

  const remindSettings = cache.remindSettings[message.author.id] || {}

  if (args.length < 3) {
    return {
      content: ':gear: **MEMBER_NAME** 自訂提醒設定：\nREMIND_SETTINGS'
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || ''))
        .replace(
          'REMIND_SETTINGS',
          Object.entries(remindSettings)
            .sort((a, b) => a[1] - b[1])
            .map(([emoji, minutes]) => `${emoji}：${minutes} 分鐘`)
            .join('\n'),
        ),
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
      content: ':x: 設定的時間必須是一個數字',
      isSyntaxError: true,
    }
  }

  if (minutes > 1440) {
    return {
      content: ':x: 分鐘數不能超過 1440',
      isSyntaxError: true,
    }
  }

  if (minutes < 0) {
    await database.ref(`/remindSettings/${message.author.id}/${emoji}`).remove()
    return {
      content: ':gear: **MEMBER_NAME** 移除了 EMOJI 的提醒功能'
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || ''))
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
    content: ':gear: **MEMBER_NAME** 已將 EMOJI 設定為 DELAY 分鐘'
      .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || ''))
      .replace('EMOJI', emoji)
      .replace('DELAY', `${minutes}`)
      .trim(),
  }
}

export default commandRemind
