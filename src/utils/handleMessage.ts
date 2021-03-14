import { DMChannel, Message } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps, ResultProps } from '../types'
import { cache } from './database'
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
  const mentionBotPattern = new RegExp(`<@!{0,1}${message.client.user?.id}>`)
  if (mentionBotPattern.test(message.content)) {
    message.channel.send(':gear: 指令前綴：`PREFIX`'.replace('PREFIX', prefix))
    return
  }
  if (!message.content.startsWith(prefix)) {
    return
  }

  const args = message.content.replace(/\s+/g, ' ').split(' ')
  const commandName = args[0].slice(prefix.length)
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
    const commandResult = await commands[commandName](message, { guildId, args })
    if (!commandResult.content && !commandResult.embed) {
      throw new Error('No result content.')
    }
    await sendResponse(message, commandResult)
    if (commandResult.isSyntaxError) {
      delete guildStatus[guildId]
      return
    }
  } catch (error) {
    await sendResponse(message, { content: ':fire: 好像發生了點問題，工程師正在努力搶修！', error })
    delete guildStatus[guildId]
    return
  }

  guildStatus[guildId] = 'cooling-down'
  setTimeout(() => {
    delete guildStatus[guildId]
  }, 5000)
}

const sendResponse = async (message: Message, result: ResultProps) => {
  try {
    const responseMessage = await message.channel.send(result.content, {
      embed: result.embed
        ? {
            title: '加入開發群組',
            url: 'https://discord.gg/Ctwz4BB',
            color: 0xff922b,
            ...result.embed,
          }
        : undefined,
    })
    sendLog(message, responseMessage, result)
  } catch (error) {
    sendLog(message, null, { error })
  }
}

export const sendLog = (message: Message, responseMessage: Message | null, result: ResultProps) => {
  if (message.channel instanceof DMChannel) {
    return
  }

  loggerHook
    .send(
      '[`TIME`] MESSAGE_CONTENT\nRESPONSE_CONTENT'
        .replace('TIME', moment(message.createdTimestamp).format('HH:mm:ss'))
        .replace('MESSAGE_CONTENT', message.content)
        .replace('RESPONSE_CONTENT', responseMessage?.content || ''),
      {
        embeds: [
          ...(responseMessage?.embeds || []),
          {
            color: result.error ? 0xff6b6b : undefined,
            fields: [
              {
                name: 'Status',
                value: result.error ? '```ERROR```'.replace('ERROR', `${result.error.stack}`) : 'SUCCESS',
              },
              { name: 'Guild', value: `${message.guild?.id}\n${message.guild?.name}`, inline: true },
              { name: 'Channel', value: `${message.channel.id}\n${message.channel.name}`, inline: true },
              { name: 'User', value: `${message.author.id}\n${message.author.tag}`, inline: true },
            ],
            footer: {
              text: `${(responseMessage?.createdTimestamp || Date.now()) - message.createdTimestamp} ms`,
            },
          },
        ],
      },
    )
    .catch()
}

export default handleMessage
