import { Message } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import { CommandProps } from '../types'
import cache from './cache'
import executeResult from './executeResult'

const guildStatus: { [GuildID in string]?: 'processing' | 'cooling-down' } = {}
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

  const args = message.content.replace(/\s+/g, ' ').split(' ')
  const commandName = isMentioned ? 'help' : args[0].slice(prefix.length)
  if (!commands[commandName]) {
    return
  }

  if (guildStatus[guildId]) {
    if (guildStatus[guildId] === 'processing') {
      await executeResult(message, {
        response: {
          content: ':star2: 指令處理中，你需要再等一等...',
          embed: {
            description: '上一個指令還沒有完全執行完畢，請耐心等待執行結果',
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
        content: ':fire: 好像發生了點問題請稍後再試，如果狀況還是沒有改善請加入開發群組回報狀況',
        embed: {
          description: '1. 請檢查是否機器人擁有正確的權限\n2. 回報問題時如果能附上截圖更能幫助開發者釐清狀況',
        },
      },
      error,
    })
  }
}

export default handleMessage
