import { Message } from 'discord.js'

const fetchGuildMessage: (
  message: Message,
  search: string,
) => Promise<{
  targetMessage: Message | null
  reason?: string
}> = async (message, search) => {
  if (!message.guild) {
    return {
      targetMessage: null,
      reason: ':x: 目標訊息必須在群組內',
    }
  }

  const options: {
    channelId?: string
    messageId?: string
  } = {}

  if (/^https:\/\/\S*\/channels\/\d+\/\d+\/\d+$/.test(search)) {
    // full message link
    const [channelId, messageId] = search.split('/').slice(-2)
    options.channelId = channelId
    options.messageId = messageId
  } else if (/^\d+\-\d+$/.test(search)) {
    // channel id - message id
    const [channelId, messageId] = search.split('-')
    options.channelId = channelId
    options.messageId = messageId
  } else if (/^\d+$/.test(search)) {
    // message id
    options.messageId = search
  }

  if (!options.messageId) {
    return {
      targetMessage: null,
      reason: ':x: 目標訊息格式錯誤，請參考說明文件裡支援的訊息格式',
    }
  }

  const guildChannels = message.guild.channels.cache
    .array()
    .filter(channel => !options.channelId || channel.id === options.channelId)

  for (const channel of guildChannels) {
    if (!channel.isText()) {
      continue
    }

    try {
      const targetMessage = await channel.messages.fetch(options.messageId)
      return {
        targetMessage,
      }
    } catch {}
  }

  return {
    targetMessage: null,
    reason: ':question: 找不到這則訊息，也許是這隻機器人沒有權限看到它？',
  }
}

export default fetchGuildMessage
