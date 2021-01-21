import { Message } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps } from '../types'
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
  if (!message.guild) {
    return
  }

  const args = message.content.replace(/\s+/g, ' ').split(' ')
  const commandName = args[0].slice(3)
  if (!commandName || !commands[commandName]) {
    return
  }

  const guildId = message.guild.id
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
    const commandResult = await commands[commandName](message, args.slice(1))
    const responseMessage = await message.channel.send(commandResult.content)
    loggerHook.send(
      '[`TIME`] `GUILD_ID`: MESSAGE_CONTENT (**PROCESSING_TIMEms**)'
        .replace('TIME', moment(message.createdTimestamp).format('HH:mm:ss'))
        .replace('GUILD_ID', guildId)
        .replace('MESSAGE_CONTENT', message.content)
        .replace('PROCESSING_TIME', `${responseMessage.createdTimestamp - message.createdTimestamp}`),
    )
    if (commandResult.isSyntaxError) {
      delete guildStatus[guildId]
      return
    }
  } catch (error) {
    const responseMessage = await message.channel.send(':fire: 好像發生了點問題，工程師正在努力搶修！')
    loggerHook.send(
      '[`TIME`] `GUILD_ID`: MESSAGE_CONTENT (**PROCESSING_TIMEms**)\n```ERROR```'
        .replace('TIME', moment(message.createdTimestamp).format('HH:mm:ss'))
        .replace('GUILD_ID', guildId)
        .replace('MESSAGE_CONTENT', message.content)
        .replace('PROCESSING_TIME', `${responseMessage.createdTimestamp - message.createdTimestamp}`)
        .replace('ERROR', `${error}`),
    )
    delete guildStatus[guildId]
    return
  }

  setTimeout(() => {
    delete guildStatus[guildId]
  }, 5000)
}

export default handleCommand
