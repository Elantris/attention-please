import { Message } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps, CommandResultProps } from '../types'
import cache, { database } from './cache'
import getHint from './getHint'
import sendLog from './sendLog'

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
    if (!commandResult || (!commandResult.content && !commandResult.embed)) {
      throw new Error('No result content.')
    }
    await sendResponse(message, commandResult)

    if (commandResult.isSyntaxError) {
      cache.syntaxErrorsCounts[message.author.id] = (cache.syntaxErrorsCounts[message.author.id] || 0) + 1
      if ((cache.syntaxErrorsCounts[message.author.id] || 0) > 16) {
        database
          .ref(`/banned/${message.author.id}`)
          .set(`[${moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm')}] too many syntax errors`)
        await sendResponse(message, {
          content: ':lock: 錯誤使用指令太多次，請加入客服群組說明原因以解鎖機器人使用權',
        })
      }
    } else {
      cache.syntaxErrorsCounts[message.author.id] = 0
    }
  } catch (error) {
    await sendResponse(message, {
      content: ':fire: 好像發生了點問題，請加入開發群組回報狀況\nhttps://discord.gg/Ctwz4BB',
      error,
    })
  }

  guildStatus[guildId] = 'cooling-down'
  setTimeout(() => {
    delete guildStatus[guildId]
  }, 3000)
}

const sendResponse = async (commandMessage: Message, result: CommandResultProps) => {
  try {
    const responseMessages = await commandMessage.channel.send(result.content, {
      split: { char: ' ' },
      embed: {
        title: '加入 eeBots Support（公告、更新）',
        url: 'https://discord.gg/Ctwz4BB',
        color: 0xff922b,
        footer: { text: `💡 ${getHint()}` },
        ...result.embed,
      },
    })

    for (const i in responseMessages) {
      const responseMessage = responseMessages[i]

      await sendLog(commandMessage.client, {
        content:
          i === '0'
            ? '[`TIME`] COMMAND_CONTENT\nRESPONSE_CONTENT'
                .replace('TIME', moment(commandMessage.createdTimestamp).format('HH:mm:ss'))
                .replace('COMMAND_CONTENT', commandMessage.content)
                .replace('RESPONSE_CONTENT', responseMessage.content)
                .trim()
                .slice(0, 2000)
            : responseMessage.content,
        embeds: responseMessage.embeds,
        error: result.error,
        guildId: commandMessage.guild?.id,
        channelId: commandMessage.channel.id,
        userId: commandMessage.author.id,
        processTime: responseMessage.createdTimestamp - commandMessage.createdTimestamp,
        noSystemStatus: i !== '0',
      })
    }
  } catch (error) {
    sendLog(commandMessage.client, {
      content: '[`TIME`] COMMAND_CONTENT\nError: send responses failed'
        .replace('TIME', moment(commandMessage.createdTimestamp).format('HH:mm:ss'))
        .replace('COMMAND_CONTENT', commandMessage.content),
      error: error,
      guildId: commandMessage.guild?.id,
      channelId: commandMessage.channel.id,
      userId: commandMessage.author.id,
    })
  }
}

export default handleMessage
