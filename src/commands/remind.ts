import { CommandProps } from '../types'
import { database } from '../utils/cache'

const commandRemind: CommandProps = async ({ message, args }) => {
  if (args.length < 3) {
    return {
      content: ':x: 設定表情符號對應的分鐘數，語法：`ap!remind [emoji] [minutes]`',
      isSyntaxError: true,
    }
  }

  const emoji = args[1]
  const minutes = parseInt(args[2])
  const isCustomEmoji = /^<:\w+:\d+>$/.test(emoji)

  if (emoji.length !== 2 && !isCustomEmoji) {
    return {
      content: ':x: 這好像不是 Discord 的表情符號，請換一個試試看',
      isSyntaxError: true,
    }
  }

  if (!Number.isSafeInteger(minutes) || minutes < 5 || minutes > 1440) {
    return {
      content: ':x: 設定的時間必須介於 5 ~ 1440 分鐘之間',
      isSyntaxError: true,
    }
  }

  await database.ref(`/remindSettings/${message.author.id}/${emoji}`).set(minutes)

  return {
    content: ':gear: MEMBER_NAME 已將 EMOJI 設定為 DELAY 分鐘\n:warning: 機器人不一定認得這個表情符號，提醒功能可能會失效'
      .replace('MEMBER_NAME', message.member?.displayName || '')
      .replace('EMOJI', emoji)
      .replace('DELAY', `${minutes}`)
      .trim(),
  }
}

export default commandRemind
