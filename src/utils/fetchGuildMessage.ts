import { Message } from 'discord.js'

const fetchGuildMessage: (message: Message, targetMessageId: string) => Promise<Message | null> = async (
  message,
  targetMessageId,
) => {
  if (!message.guild || !message.client.user) {
    return null
  }

  const guildChannels = message.guild.channels.cache.array()

  for (const channel of guildChannels) {
    if (!channel.isText() || !channel.members.has(message.client.user.id)) {
      continue
    }

    try {
      const targetMessage = await channel.messages.fetch(targetMessageId)
      return targetMessage
    } catch {}
  }

  return null
}

export default fetchGuildMessage
