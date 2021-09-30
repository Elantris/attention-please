import { Message } from 'discord.js'
import { CommandResultProps } from '../types'
import { getHint } from './cache'
import sendLog from './sendLog'

const sendResponse = async (commandMessage: Message, result: CommandResultProps) => {
  try {
    const responseMessages = await commandMessage.channel.send(result.content, {
      split: { char: ' ' },
      embed: {
        color: '#ff922b',
        title: '加入 eeBots Support（公告、更新）',
        url: 'https://discord.gg/Ctwz4BB',
        footer: { text: `💡 ${getHint()}` },
        files: result.files,
        ...result.embed,
      },
    })

    sendLog(commandMessage.client, {
      color: '#ff922b',
      time: commandMessage.createdTimestamp,
      content: `${commandMessage.content}\n${responseMessages[responseMessages.length - 1].content}`,
      embeds: responseMessages[responseMessages.length - 1].embeds,
      error: result.error,
      guildId: commandMessage.guild?.id,
      channelId: commandMessage.channel.id,
      userId: commandMessage.author.id,
      processTime: responseMessages[responseMessages.length - 1].createdTimestamp - commandMessage.createdTimestamp,
    })
  } catch (error: any) {
    sendLog(commandMessage.client, {
      color: '#ff6b6b',
      time: commandMessage.createdTimestamp,
      content: `${commandMessage.content}\nError: send responses failed`,
      error,
      guildId: commandMessage.guild?.id,
      channelId: commandMessage.channel.id,
      userId: commandMessage.author.id,
      processTime: Date.now() - commandMessage.createdTimestamp,
    })
  }
}

export default sendResponse
