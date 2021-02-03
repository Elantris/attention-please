import { DMChannel } from 'discord.js'
import { CommandProps } from '../types'
import fetchGuildMessage from '../utils/fetchGuildMessage'
import getReactionStatus from '../utils/getReactionStatus'

const commandCheck: CommandProps = async (message, { args }) => {
  const targetMessageId = args[0]
  if (!targetMessageId) {
    return {
      content: ':x: 請用 Message ID 指定訊息',
      isSyntaxError: true,
    }
  }

  const targetMessage = await fetchGuildMessage(message, targetMessageId)
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
