import { DMChannel } from 'discord.js'
import { CommandProps } from '../types'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getReactionStatus from '../utils/getReactionStatus'

const commandCheck: CommandProps = async (message, { args }) => {
  if (!args[1]) {
    return {
      content: ':x: 請用訊息 ID 或訊息連結指定要簽到的訊息',
      isSyntaxError: true,
    }
  }

  const targetMessage = await fetchGuildMessage(message, args[1])
  if (!targetMessage || targetMessage.channel instanceof DMChannel) {
    return {
      content: ':question: 找不到這則訊息，也許是這隻機器人沒有權限看到它？',
    }
  }

  return {
    content: await getReactionStatus(targetMessage),
  }
}

export default commandCheck
