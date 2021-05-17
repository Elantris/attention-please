import { Client, DMChannel, Message, MessageEmbed, NewsChannel, TextChannel, Util } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps, CommandResultProps } from '../types'
import cache from './cache'
import getHint from './getHint'
import { loggerHook } from './hooks'

const guildStatus: { [GuildID: string]: 'processing' | 'cooling-down' | 'muted' } = {}
const commands: { [CommandName: string]: CommandProps } = {}

readdirSync(join(__dirname, '..', 'commands'))
  .filter(filename => filename.endsWith('.js') || filename.endsWith('.ts'))
  .forEach(filename => {
    const commandName = filename.slice(0, -3)
    commands[commandName] = require(join(__dirname, '..', 'commands', commandName)).default
  })

const handleMessage = async (message: Message) => {
  if (
    message.author.bot ||
    cache.banned[message.author.id] ||
    !message.guild ||
    cache.banned[message.guild.id] ||
    message instanceof DMChannel
  ) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'ap!'
  const isMentioned = new RegExp(`<@!{0,1}${message.client.user?.id}>`).test(message.content)
  if (!message.content.startsWith(prefix) && !isMentioned) {
    return
  }

  const args = message.content.replace(/[\s\n]+/g, ' ').split(' ')
  const commandName = isMentioned ? 'help' : args[0].slice(prefix.length)
  if (!commandName || !commands[commandName]) {
    return
  }

  if (guildStatus[guildId]) {
    if (guildStatus[guildId] === 'processing') {
      message.channel.send(':star2: 指令處理中，你需要再等一等...')
      guildStatus[guildId] = 'muted'
    } else if (guildStatus[guildId] === 'cooling-down') {
      message.channel.send(':ice_cube: 指令冷卻中，你需要再慢一點...')
      guildStatus[guildId] = 'muted'
    }
    return
  }

  try {
    guildStatus[guildId] = 'processing'
    const commandResult = await commands[commandName]({ message, guildId, args })
    if (!commandResult.content && !commandResult.embed) {
      throw new Error('No result content.')
    }
    await sendResponse(message, commandResult)
    if (commandResult.isSyntaxError) {
      delete guildStatus[guildId]
      return
    }
  } catch (error) {
    await sendResponse(message, {
      content: ':fire: 好像發生了點問題，如果重試後狀況沒有改善請加入開發群組回報\nhttps://discord.gg/Ctwz4BB',
      error,
    })
    delete guildStatus[guildId]
    return
  }

  guildStatus[guildId] = 'cooling-down'
  setTimeout(() => {
    delete guildStatus[guildId]
  }, 5000)
}

export const sendResponse = async (commandMessage: Message, result: CommandResultProps) => {
  const responseMessage = await commandMessage.channel
    .send(result.content, {
      embed: {
        title: '加入 eeBots Support（公告、更新）',
        url: 'https://discord.gg/Ctwz4BB',
        color: 0xff922b,
        footer: { text: `💡 ${getHint()}` },
        ...result.embed,
      },
    })
    .catch(() => null)

  sendLog(commandMessage.client, {
    content: '[`TIME`] COMMAND_CONTENT\nRESPONSE_CONTENT'
      .replace('TIME', moment(commandMessage.createdTimestamp).format('HH:mm:ss'))
      .replace('COMMAND_CONTENT', commandMessage.content)
      .replace('RESPONSE_CONTENT', responseMessage?.content || 'Error: send response failed')
      .trim(),
    embeds: responseMessage?.embeds,
    error: result.error,
    guildId: commandMessage.guild?.id,
    channelId: commandMessage.channel.id,
    userId: commandMessage.author.id,
    processTime: responseMessage?.createdTimestamp
      ? responseMessage?.createdTimestamp - commandMessage.createdTimestamp
      : undefined,
  })
}

export const sendLog = (
  client: Client,
  options: {
    content?: string
    embeds?: MessageEmbed[]
    error?: Error
    guildId?: string
    channelId?: string
    userId?: string
    processTime?: number
    color?: number
  },
) => {
  const guild = client.guilds.cache.get(options.guildId || '')
  const channel = client.channels.cache.get(options.channelId || '')
  const user = client.users.cache.get(options.userId || '')

  loggerHook
    .send(options.content, {
      embeds: [
        ...(options.embeds || []),
        {
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
                  : '--',
              inline: true,
            },
            {
              name: 'User',
              value: user ? `${user.id}\n${Util.escapeMarkdown(user.tag)}` : '--',
              inline: true,
            },
          ],
          footer: options.processTime ? { text: `${options.processTime} ms` } : undefined,
        },
      ],
    })
    .catch(() => {})
}

export default handleMessage
