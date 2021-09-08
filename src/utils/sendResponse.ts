import { Message } from 'discord.js'
import { CommandResultProps } from '../types'
import { getHint } from './cache'
import sendLog from './sendLog'

const sendResponse = async (commandMessage: Message, result: CommandResultProps) => {
  try {
    const responseMessages = await commandMessage.channel.send(result.content, {
      split: { char: ' ' },
      embed: {
        color: 0xff922b,
        title: '加入 eeBots Support（公告、更新）',
        url: 'https://discord.gg/Ctwz4BB',
        footer: { text: `💡 ${getHint()}` },
        ...result.embed,
      },
    })

    sendLog(commandMessage.client, {
      commandMessage,
      responseMessage: responseMessages[responseMessages.length - 1],
      error: result.error,
      processTime: responseMessages[responseMessages.length - 1].createdTimestamp - commandMessage.createdTimestamp,
    })
  } catch (error: any) {
    sendLog(commandMessage.client, {
      commandMessage,
      content: 'Error: send responses failed',
      error,
      processTime: Date.now() - commandMessage.createdTimestamp,
    })
  }
}

export default sendResponse
