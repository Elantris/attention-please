import { Client, Message, MessageEmbed, MessageEmbedOptions, NewsChannel, TextChannel, Util } from 'discord.js'
import { loggerHook } from './hooks'

const sendLog = async (
  client: Client,
  options: {
    content?: string
    embeds?: Message['embeds']
    error?: Error
    guildId?: string
    channelId?: string
    userId?: string
    color?: number
    processTime?: number
    noSystemStatus?: boolean
  },
) => {
  const guild = client.guilds.cache.get(options.guildId || '')
  const channel = client.channels.cache.get(options.channelId || '')
  const user = client.users.cache.get(options.userId || '')

  const embeds: (MessageEmbed | MessageEmbedOptions)[] = []
  if (options.embeds) {
    embeds.push(...options.embeds)
  }
  if (!options.noSystemStatus) {
    embeds.push({
      color: options.error ? 0xff6b6b : options.color,
      fields: [
        {
          name: 'Status',
          value: options.error ? '```ERROR```'.replace('ERROR', `${options.error}`) : 'SUCCESS',
        },
        {
          name: 'Guild',
          value: guild ? `${guild.id}\n${Util.escapeMarkdown(guild.name)}` : '--',
          inline: true,
        },
        {
          name: 'Channel',
          value:
            channel instanceof TextChannel || channel instanceof NewsChannel
              ? `${channel.id}\n${Util.escapeMarkdown(channel.name)}`
              : options.channelId || '--',
          inline: true,
        },
        {
          name: 'User',
          value: user ? `${user.id}\n${Util.escapeMarkdown(user.tag)}` : '--',
          inline: true,
        },
      ],
      footer: options.processTime ? { text: `${options.processTime} ms` } : undefined,
    })
  }

  await loggerHook.send(options.content, { embeds }).catch(() => {})
}

export default sendLog
