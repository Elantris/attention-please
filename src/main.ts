import { Client } from 'discord.js'
import { gunzip } from 'zlib'
import config from './config'
import checkCronjob from './utils/checkCronjob'
import handleMessage from './utils/handleMessage'
import { handleRaw } from './utils/handleReaction'
import { loggerHook } from './utils/hooks'
import remindCronJob from './utils/remindCronJob'
import timeFormatter from './utils/timeFormatter'

const client = new Client()

client.on('message', message => handleMessage(message))
client.on('raw', packet => handleRaw(client, packet))
client.on('ready', () => {
  loggerHook.send('`TIME` USER_TAG'.replace('TIME', timeFormatter()).replace('USER_TAG', client.user?.tag || ''))
})

const locks = {
  checkJob: false,
  remindJob: false,
}

client.setInterval(async () => {
  if (!locks.checkJob) {
    locks.checkJob = true
    await checkCronjob(client, Date.now())
    locks.checkJob = false
  }
}, 10000)

client.setInterval(async () => {
  if (!locks.remindJob) {
    locks.remindJob = true
    await remindCronJob(client, Date.now())
    locks.remindJob = false
  }
}, 10000)

client.setInterval(async () => {
  client.user?.setActivity('Version 2021.10.01 | https://discord.gg/Ctwz4BB')
}, 60000)

client.login(config.DISCORD.TOKEN)
