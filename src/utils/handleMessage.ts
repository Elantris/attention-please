import { Message, MessageEmbedOptions } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps } from '../types'
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

const handleCommand: (message: Message) => Promise<void> = async message => {
  if (message.author.bot || !message.guild) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'ap!'
  const mentionBotPattern = new RegExp(`<@!{0,1}${message.client.user?.id}>`)
  if (mentionBotPattern.test(message.content)) {
    message.channel.send(':gear: 目前指令前綴：`PREFIX`'.replace('PREFIX', prefix))
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
    const commandResult = await commands[commandName](message, { guildId, args: args.slice(1) })
    if (!commandResult.content) {
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

const sendResponse = async (
  message: Message,
  options: { content: string; embed?: MessageEmbedOptions; error?: Error },
) => {
  const responseMessage = await message.channel.send(options)

  const embeds: MessageEmbedOptions[] = []
  options.embed && embeds.push(options.embed)
  options.error &&
    embeds.push({
      color: 0xff6b6b,
      description: '```ERROR```'.replace('ERROR', options.error.stack || ''),
    })

  loggerHook.send(
    '[`TIME`] `GUILD_ID`: MESSAGE_CONTENT\n(**PROCESSING_TIME**ms) RESPONSE_CONTENT'
      .replace('TIME', moment(message.createdTimestamp).format('HH:mm:ss'))
      .replace('GUILD_ID', `${message.guild?.id}`)
      .replace('MESSAGE_CONTENT', message.content)
      .replace('PROCESSING_TIME', `${responseMessage.createdTimestamp - message.createdTimestamp}`)
      .replace('RESPONSE_CONTENT', responseMessage.content),
    { embeds },
  )
}

export default handleCommand
