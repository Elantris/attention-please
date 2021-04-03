import { CommandProps } from '../types'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getReactionStatus from '../utils/getReactionStatus'

const commandCheck: CommandProps = async ({ message, args }) => {
  if (!args[1]) {
    return {
      content: ':x: 請用訊息 ID 或訊息連結指定要簽到的訊息',
      isSyntaxError: true,
    }
  }

  const { targetMessage, reason } = await fetchGuildMessage(message, args[1])
  if (!targetMessage) {
    return {
      content: reason || ':question:',
    }
  }

  return await getReactionStatus(targetMessage)
}

export default commandCheck
