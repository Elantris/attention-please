import { Client, DMChannel, FileOptions, MessageEmbed, MessageEmbedOptions } from 'discord.js'
import { loggerHook } from './hooks'
import timeFormatter from './timeFormatter'

const sendLog = async (
  client: Client,
  options: {
    color?: string
    time?: number
    content?: string
    embeds?: (MessageEmbed | MessageEmbedOptions)[]
    error?: Error
    guildId?: string
    channelId?: string
    userId?: string
    processTime?: number
  },
) => {
  const guild = options.guildId ? client.guilds.cache.get(options.guildId) : undefined
  const channel = options.channelId ? client.channels.cache.get(options.channelId) : undefined
  const user = options.userId ? client.users.cache.get(options.userId) : undefined

  await loggerHook.send(
    '[`TIME`] CONTENT'
      .replace('TIME', timeFormatter({ time: options.time }))
      .replace('CONTENT', options.content?.trim() || ''),
    {
      embeds: [
        ...(options?.embeds || []),
        {
          color: options.error ? '#ff6b6b' : options.color,
          description: options.error ? '```ERROR```'.replace('ERROR', options.error.stack || '') : undefined,
          fields: [
            {
              name: 'Guild',
              value: guild ? `${guild.id}\n${guild.name}` : options.guildId || '--',
              inline: true,
            },
            {
              name: 'Channel',
              value:
                channel?.isText() && !(channel instanceof DMChannel)
                  ? `${channel.id}\n${channel.name}`
                  : options.channelId || channel?.id || '--',
              inline: true,
            },
            {
              name: 'User',
              value: user ? `${user.id}\n${user.tag}` : options.userId || '--',
              inline: true,
            },
          ],
          footer: options.processTime ? { text: `${options.processTime} ms` } : undefined,
        },
      ],
    },
  )
}

export default sendLog
