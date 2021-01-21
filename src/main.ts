import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleCommand from './utils/handleCommand'
import { loggerHook } from './utils/hooks'

const client = new Client({
  ws: {
    intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_PRESENCES', 'GUILD_MEMBERS'],
  },
})

client.on('message', async message => {
  if (message.author.bot || !message.guild || !message.content.startsWith('ar!')) {
    return
  }

  handleCommand(message)
})

const start = Date.now()
client.on('ready', () => {
  loggerHook.send(
    '[`TIME`] USER_TAG is online! (**PREPARING_TIMEms**)'
      .replace('TIME', moment().format('HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || '')
      .replace('PREPARING_TIME', `${Date.now() - start}`),
  )
})

client.login(config.DISCORD.TOKEN)
