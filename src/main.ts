import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleCommand from './utils/handleMessage'
import { loggerHook } from './utils/hooks'
import remindCronjob from './utils/remindCronJob'

const client = new Client()

client.on('message', handleCommand)

client.on('ready', () => {
  client.user?.setActivity('Version 2021.03.21 | https://discord.gg/Ctwz4BB')
  loggerHook.send(
    '[`TIME`] USER_TAG'.replace('TIME', moment().format('HH:mm:ss')).replace('USER_TAG', client.user?.tag || ''),
  )
})

client.setInterval(async () => {
  await remindCronjob(client)
}, 20000)

client.login(config.DISCORD.TOKEN)
