import { APIEmbed, escapeMarkdown, MessageOptions } from 'discord.js'
import OpenColor from 'open-color'
import cache from './cache'
import colorFormatter from './colorFormatter'
import timeFormatter from './timeFormatter'

const sendLog = async (options: {
  time: number
  processTime: number
  command: string
  content: string
  embeds?: APIEmbed[]
  files?: MessageOptions['files']
  guildId: string
  guildName?: string
  channelId: string
  channelName?: string
  userId: string
  userName?: string
  error?: Error
}) => {
  await cache.logChannel?.send({
    content: '[`{TIME}`] `{COMMAND}`\n{CONTENT}'
      .replace('{TIME}', timeFormatter({ time: options.time, format: 'yyyy-MM-dd HH:mm:ss' }))
      .replace('{COMMAND}', options.command)
      .replace('{CONTENT}', options.content),
    embeds: [
      ...(options.embeds || []),
      {
        color: options.error ? colorFormatter(OpenColor.red[5]) : undefined,
        description: options.error ? '```{ERROR}```'.replace('{ERROR}', `${options.error}`) : undefined,
        fields: [
          {
            name: 'Guild',
            value: '{ID}\n{NAME}'
              .replace('{ID}', options.guildId)
              .replace('{NAME}', escapeMarkdown(options.guildName || '--')),
            inline: true,
          },
          {
            name: 'Channel',
            value: '{ID}\n{NAME}'
              .replace('{ID}', options.channelId)
              .replace('{NAME}', escapeMarkdown(options.channelName || '--')),
            inline: true,
          },
          {
            name: 'User',
            value: '{ID}\n{NAME}'
              .replace('{ID}', options.userId)
              .replace('{NAME}', escapeMarkdown(options.userName || '--')),
            inline: true,
          },
        ],
        footer: {
          text: `${options.processTime || Date.now() - options.time}ms`,
        },
        timestamp: new Date(options.time).toISOString(),
      },
    ],
    files: options.files,
  })
}

export default sendLog
