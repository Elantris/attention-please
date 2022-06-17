import { Message } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import { CommandProps } from '../types'
import cache from './cache'
import executeResult from './executeResult'
import { translate } from './translation'

const guildStatus: { [GuildID in string]?: 'processing' | 'cooling-down' } = {}
const commands: { [CommandName in string]?: CommandProps } = {}

readdirSync(join(__dirname, '../commands'))
  .filter(filename => filename.endsWith('.js') || filename.endsWith('.ts'))
  .forEach(filename => {
    const commandName = filename.slice(0, -3)
    commands[commandName] = require(join(__dirname, '../commands', commandName)).default
  })

const handleMessage = async (message: Message) => {
  if (message.author.bot || !message.guild || cache.banned[message.author.id] || cache.banned[message.guild.id]) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'ap!'
  const isMentioned = new RegExp(`^<@!{0,1}${message.client.user?.id}>$`).test(message.content)
  if (!message.content.startsWith(prefix) && !isMentioned) {
    return
  }

  const args = message.content.replace(/\s+/g, ' ').split(' ')
  const commandName = isMentioned ? 'help' : args[0].slice(prefix.length)
  if (!commands[commandName]) {
    return
  }

  if (guildStatus[guildId]) {
    if (guildStatus[guildId] === 'processing') {
      await executeResult(message, {
        response: {
          content: translate('system.text.commandProcessing', { guildId }),
          embed: {
            description: translate('system.text.commandProcessingHelp', { guildId }),
          },
        },
      })
    } else {
      await message.react('🧊')
    }
    return
  }

  try {
    guildStatus[guildId] = 'processing'
    const commandResult = await commands[commandName]?.({ message, guildId, args })
    guildStatus[guildId] = 'cooling-down'
    setTimeout(() => {
      delete guildStatus[guildId]
    }, 5000)
    if (commandResult) {
      await executeResult(message, commandResult)
    }
  } catch (error: any) {
    delete guildStatus[guildId]
    await executeResult(message, {
      response: {
        content: translate('system.text.unexpectedError', { guildId }),
        embed: {
          description: translate('system.text.unexpectedErrorHelp', { guildId }),
        },
      },
      error,
    })
  }
}

export default handleMessage
