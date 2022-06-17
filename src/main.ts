import { Client } from 'discord.js'
import config from './config'
import { loggerHook } from './utils/cache'
import executeJobs from './utils/executeJobs'
import handleMessage from './utils/handleMessage'
import { handleRaw } from './utils/handleReaction'
import timeFormatter from './utils/timeFormatter'

const client = new Client({
  intents: [
    'GUILDS',
    'GUILD_MEMBERS',
    'GUILD_EMOJIS_AND_STICKERS',
    'GUILD_MESSAGES',
    'GUILD_MESSAGE_REACTIONS',
    'DIRECT_MESSAGES',
    'DIRECT_MESSAGE_REACTIONS',
  ],
})

client.on('messageCreate', handleMessage)
client.on('raw', packet => handleRaw(client, packet))
client.on('ready', () => {
  loggerHook.send(
    '`TIME` USER_TAG'
      .replace('TIME', timeFormatter({ format: 'yyyy-MM-dd HH:mm:ss' }))
      .replace('USER_TAG', client.user?.tag || ''),
  )

  setInterval(() => {
    client.user?.setActivity(`on ${client.guilds.cache.size} guilds.`)
    executeJobs(client)
  }, 10000)
})

client.login(config.DISCORD.TOKEN)
