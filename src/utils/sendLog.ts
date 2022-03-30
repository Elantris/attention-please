import { Client, FileOptions, MessageAttachment, MessageEmbed, MessageEmbedOptions, TextChannel } from 'discord.js'
import OpenColor from 'open-color'
import { loggerHook } from './cache'
import colorFormatter from './colorFormatter'
import timeFormatter from './timeFormatter'

const sendLog = async (
  client: Client,
  options: {
    color?: string
    time?: number
    content?: string
    embeds?: (MessageEmbed | MessageEmbedOptions)[]
    files?: MessageAttachment[] | FileOptions[]
    guildId?: string
    channelId?: string
    userId?: string
    error?: Error
    processTime?: number
  },
) => {
  const guild = options.guildId ? client.guilds.cache.get(options.guildId) : undefined
  const channel = options.channelId ? client.channels.cache.get(options.channelId) : undefined
  const user = options.userId ? client.users.cache.get(options.userId) : undefined

  await loggerHook.send({
    content: '[`TIME`] CONTENT'
      .replace('TIME', timeFormatter({ time: options.time, format: 'yyyy-MM-dd HH:mm:ss' }))
      .replace('CONTENT', options.content?.trim() || ''),
    embeds: [
      ...(options?.embeds || []),
      {
        color: colorFormatter(options.error ? OpenColor.red[5] : options.color || OpenColor.orange[5]),
        description: options.error ? '```ERROR```'.replace('ERROR', options.error.stack || '') : undefined,
        fields: [
          {
            name: 'Guild',
            value: guild ? `${guild.id}\n${guild.name}` : options.guildId || '--',
            inline: true,
          },
          {
            name: 'Channel',
            value: channel instanceof TextChannel ? `${channel.id}\n${channel.name}` : channel?.id || '--',
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
    files: options.files,
  })
}

export default sendLog
