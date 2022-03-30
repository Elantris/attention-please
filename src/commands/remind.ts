import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'

const commandRemind: CommandProps = async ({ message, guildId, args }) => {
  const remindSettings = cache.remindSettings[message.author.id] || {}

  if (args.length < 3) {
    return {
      a: 1,
      response: {
        content: ':gear: **MEMBER_NAME** 自訂提醒時間設定：COUNT/10'
          .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
          .replace('COUNT', `${Object.keys(remindSettings).length}`),
        embed: {
          description: Object.entries(remindSettings)
            .sort((a, b) => a[1] - b[1])
            .map(([emoji, minutes]) => `${emoji}：${minutes} 分鐘`)
            .join('\n'),
        },
      },
    }
  }

  const emoji = args[1]
  const minutes = parseInt(args[2])
  const isCustomEmoji = /^<:\w+:\d+>$/.test(emoji)

  if (!isCustomEmoji && emoji.length !== 2) {
    return {
      response: {
        content: ':x: 這個表情符號不可用',
        embed: {
          description: '有些 emoji 因為編碼問題無法在提醒功能正常使用，請換一個表情符號再試試看',
        },
      },
    }
  }

  if (!Number.isSafeInteger(minutes) || minutes > 1440) {
    return {
      response: {
        content: ':x: 提醒時間必須小於 1440 分鐘',
      },
    }
  }

  if (minutes < 0) {
    await database.ref(`/remindSettings/${message.author.id}/${emoji}`).remove()
    return {
      response: {
        content: ':gear: **MEMBER_NAME** 移除了 EMOJI 的提醒功能'
          .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
          .replace('EMOJI', emoji)
          .trim(),
      },
    }
  }

  if (!remindSettings[emoji] && Object.keys(remindSettings).length >= 10) {
    return {
      response: {
        content: ':lock: 設定數量已達上限',
        embed: {
          description: '最多只能設定 10 個表情符號的提醒時間',
        },
      },
    }
  }

  await database.ref(`/remindSettings/${message.author.id}/${emoji}`).set(minutes)

  return {
    response: {
      content: ':gear: **MEMBER_NAME** 已將 EMOJI 設定為 REMIND_TIME 分鐘'
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
        .replace('EMOJI', emoji)
        .replace('REMIND_TIME', `${minutes}`)
        .trim(),
      embed: {
        description: '對一則訊息按下設定的表情符號反應，等待 REMIND_TIME 分鐘後 Attention Please 會私訊提醒你'.replace(
          'REMIND_TIME',
          `${minutes}`,
        ),
      },
    },
  }
}

export default commandRemind
