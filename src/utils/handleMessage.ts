import { Message } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import { CommandProps } from '../types'
import cache, { database } from './cache'
import sendResponse from './sendResponse'
import timeFormatter from './timeFormatter'

const guildStatus: { [GuildID in string]?: 'processing' | 'cooling-down' | 'muted' } = {}
const commands: { [CommandName in string]?: CommandProps } = {}

readdirSync(join(__dirname, '..', 'commands'))
  .filter(filename => filename.endsWith('.js') || filename.endsWith('.ts'))
  .forEach(filename => {
    const commandName = filename.slice(0, -3)
    commands[commandName] = require(join(__dirname, '..', 'commands', commandName)).default
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
    const commandResult = await commands[commandName]?.({ message, guildId, args })
    guildStatus[guildId] = 'cooling-down'
    setTimeout(() => {
      delete guildStatus[guildId]
    }, 3000)

    if (!commandResult) {
      return
    }
    if (!commandResult.content && !commandResult.embed) {
      throw new Error('no result content')
    }
    await sendResponse(message, commandResult)

    if (commandResult.isSyntaxError) {
      cache.syntaxErrorsCounts[message.author.id] = (cache.syntaxErrorsCounts[message.author.id] || 0) + 1
      if ((cache.syntaxErrorsCounts[message.author.id] || 0) > 8) {
        await database
          .ref(`/banned/${message.author.id}`)
          .set(`[${timeFormatter({ guildId, time: message.createdTimestamp })}] too many syntax errors`)
        await sendResponse(message, {
          content: ':lock: 無法正確使用機器人指令嗎？歡迎加入客服群組尋求協助！',
        })
      }
    } else {
      cache.syntaxErrorsCounts[message.author.id] = 0
    }
  } catch (error: any) {
    await sendResponse(message, {
      content: ':fire: 好像發生了點問題請稍後再試，如果狀況還是沒有改善請加入開發群組回報狀況',
      error,
    })
  }
}

export default handleMessage
