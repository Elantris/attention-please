import { Client, DMChannel, Message } from 'discord.js'
import { loggerHook } from './hooks'

const sendLog = async (
  client: Client,
  options: {
    commandMessage?: Message
    responseMessage?: Message

    color?: number
    time?: number
    content?: string
    error?: Error
    guildId?: string
    channelId?: string
    userId?: string
    processTime?: number
  },
) => {
  const guild = options.guildId ? client.guilds.cache.get(options.guildId) : options.commandMessage?.guild
  const channel = options.channelId ? client.channels.cache.get(options.channelId) : options.commandMessage?.channel
  const user = options.userId ? client.users.cache.get(options.userId) : options.commandMessage?.author

  const time = options.time || options.commandMessage?.createdTimestamp || Date.now()

  await loggerHook.send(
    '[TIME] CONTENT'
      .replace('TIME', `<t:${Math.floor(time / 1000)}:T>`)
      .replace(
        'CONTENT',
        `${options.content || ''}\n${options.commandMessage?.content || ''}\n${
          options.responseMessage?.content || ''
        }`.trim(),
      ),
    {
      embeds: [
        ...(options.responseMessage?.embeds || []),
        {
          color: options.error ? 0xff6b6b : options.color,
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
