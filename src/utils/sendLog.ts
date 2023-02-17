import { escapeMarkdown } from 'discord.js'
import OpenColor from 'open-color'
import { ResultProps } from '../types'
import cache from './cache'
import colorFormatter from './colorFormatter'
import timeFormatter from './timeFormatter'

const sendLog = async (options: {
  command: {
    createdAt: number
    content: string
    guildId: string
    guildName?: string
    channelId: string
    channelName?: string
    userId: string
    userName?: string
  }
  result: ResultProps & {
    createdAt: number
  }
  error?: Error
}) => {
  await cache.logChannel?.send({
    content: '[`{TIME}`] `{COMMAND}`\n{CONTENT}'
      .replace('{TIME}', timeFormatter({ time: options.command.createdAt }))
      .replace('{COMMAND}', options.command.content)
      .replace('{CONTENT}', options.result.content),
    embeds: [
      ...(options.result.embed ? [options.result.embed] : []),
      {
        color: options.error ? colorFormatter(OpenColor.red[5]) : undefined,
        description: options.error ? '```{ERROR}```'.replace('{ERROR}', `${options.error.stack || ''}`) : undefined,
        fields: [
          {
            name: 'Guild',
            value: '{ID}\n{NAME}'
              .replace('{ID}', options.command.guildId)
              .replace('{NAME}', escapeMarkdown(options.command.guildName || '--')),
            inline: true,
          },
          {
            name: 'Channel',
            value: '{ID}\n{NAME}'
              .replace('{ID}', options.command.channelId)
              .replace('{NAME}', escapeMarkdown(options.command.channelName || '--')),
            inline: true,
          },
          {
            name: 'User',
            value: '{ID}\n{NAME}'
              .replace('{ID}', options.command.userId)
              .replace('{NAME}', escapeMarkdown(options.command.userName || '--')),
            inline: true,
          },
        ],
        footer: {
          text: `${options.result.createdAt - options.command.createdAt}ms`,
        },
        timestamp: new Date(options.command.createdAt).toISOString(),
      },
    ],
    files: options.result.files,
  })
}

export default sendLog
