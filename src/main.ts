import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleCommand from './utils/handleMessage'
import { loggerHook } from './utils/hooks'
import remindCronjob from './utils/remindCronJob'

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
  client.user?.setActivity('Updated at 2021.03.10 | https://discord.gg/Ctwz4BB')
  loggerHook.send(
    '[`TIME`] USER_TAG is online!'
      .replace('TIME', moment().format('HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || ''),
  )
})

client.setInterval(async () => {
  await remindCronjob(client)
}, 60000)

client.login(config.DISCORD.TOKEN)
