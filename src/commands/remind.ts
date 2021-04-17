import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'

const commandRemind: CommandProps = async ({ message, args }) => {
  const remindSettings = cache.remindSettings[message.author.id] || {}

  if (args.length < 3) {
    return {
      content: ':gear: **MEMBER_NAME** 自訂提醒設定：\nREMIND_SETTINGS'
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || ''))
        .replace(
          'REMIND_SETTINGS',
          Object.entries(remindSettings)
            .map(([emoji, minutes]) => `${emoji}：${minutes} 分鐘`)
            .join('\n'),
        ),
      isSyntaxError: true,
    }
  }

  const emoji = args[1]
  const minutes = parseInt(args[2])
  const isCustomEmoji = /^<:\w+:\d+>$/.test(emoji)

  if (emoji.length !== 2 && !isCustomEmoji) {
    return {
      content: ':x: 這好像不是一個可以使用的表情符號，請換一個試試看',
      isSyntaxError: true,
    }
  }

  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440) {
    return {
      content: ':x: 設定的時間必須介於 1 ~ 1440 分鐘之間',
      isSyntaxError: true,
    }
  }

  if (minutes === 0) {
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
      content: ':x: 最多只能設定 8 個 emoji 的提醒時間',
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
