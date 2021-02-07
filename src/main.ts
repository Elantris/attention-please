import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleCommand from './utils/handleMessage'
import { loggerHook } from './utils/hooks'
import remindCronjob from './utils/remindCronJob'

const startedAt = Date.now()
const client = new Client({
  ws: {
    intents: [
      'GUILDS',
      'GUILD_MEMBERS',
      'GUILD_EMOJIS',
      'GUILD_PRESENCES',
      'GUILD_MESSAGES',
      'GUILD_MESSAGE_REACTIONS',
    ],
  },
})

client.on('message', handleCommand)

client.on('ready', () => {
  const readyAt = Date.now()
  loggerHook.send(
    '[`TIME`] USER_TAG is online! (**PREPARING_TIME**ms)'
      .replace('TIME', moment(readyAt).format('HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || '')
      .replace('PREPARING_TIME', `${readyAt - startedAt}`),
  )
})

client.setInterval(async () => {
  await remindCronjob(client)
}, 60000)

client.login(config.DISCORD.TOKEN)
