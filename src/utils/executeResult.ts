import { Message, Util } from 'discord.js'
import OpenColor from 'open-color'
import { CommandResultProps } from '../types'
import colorFormatter from './colorFormatter'
import sendLog from './sendLog'

const executeResult = async (
  commandMessage: Message,
  result: CommandResultProps,
  options?: {
    createdAt?: number
    color?: string
    content?: string
  },
) => {
  let responseMessage: Message | undefined = undefined
  let responseError: Error | undefined = undefined

  if (result.response) {
    const contents = result.response.content ? Util.splitMessage(result.response.content, { char: ' ' }) : []
    for (let i = 0; i < contents.length - 1; i++) {
      await commandMessage.channel.send({
        content: contents[i],
      })
    }

    try {
      responseMessage = await commandMessage.channel.send({
        content: contents[contents.length - 1],
        embeds: [
          {
            color: colorFormatter(OpenColor.orange[5]),
            title: '加入 eeBots Support（公告、更新）',
            url: 'https://discord.gg/Ctwz4BB',
            footer: {
              text: 'Version 2022-03-05',
            },
            ...result.response.embed,
          },
        ],
        files: result.response.files,
      })
    } catch (error: any) {
      responseError = error
    }
  }

  sendLog(commandMessage.client, {
    color: options?.color,
    time: options?.createdAt || commandMessage.createdTimestamp,
    content: `${options?.content || commandMessage.content}\n${responseMessage?.content || ''}`.trim(),
    embeds: responseMessage?.embeds,
    files: result.response?.files,
    guildId: commandMessage.guildId || undefined,
    channelId: commandMessage.channelId,
    userId: commandMessage.author.id,
    error: result.error || responseError,
    processTime:
      (responseMessage?.createdTimestamp || Date.now()) - (options?.createdAt || commandMessage.createdTimestamp),
  })
}

export default executeResult
