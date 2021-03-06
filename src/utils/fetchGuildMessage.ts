import { Message } from 'discord.js'

const messageLinkRegex = new RegExp(/https:\/\/\S*\/channels\/\d{18}\/\d{18}\/\d{18}/g)
const messageWithChannelIdRegex = new RegExp(/\d{18}\-\d{18}/g)
const messageIdRegex = new RegExp(/\d{18}/g)

const fetchGuildMessage: (message: Message, search: string) => Promise<Message | null> = async (message, search) => {
  if (!message.guild || !message.client.user) {
    return null
  }

  const options: {
    channelId?: string
    messageId?: string
  } = {}

  if (messageLinkRegex.test(search)) {
    const [channelId, messageId] = search.split('/').slice(-2)
    options.channelId = channelId
    options.messageId = messageId
  } else if (messageWithChannelIdRegex.test(search)) {
    const [channelId, messageId] = search.split('-')
    options.channelId = channelId
    options.messageId = messageId
  } else if (messageIdRegex.test(search)) {
    options.messageId = search
  }

  if (!options.messageId) {
    return null
  }

  const guildChannels = message.guild.channels.cache
    .array()
    .filter(channel => !options.channelId || channel.id === options.channelId)

  for (const channel of guildChannels) {
    if (!channel.isText() || !channel.members.has(message.client.user.id)) {
      continue
    }

    try {
      const targetMessage = await channel.messages.fetch(options.messageId)
      return targetMessage
    } catch {}
  }

  return null
}

export default fetchGuildMessage
