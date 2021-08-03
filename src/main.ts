import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import { removeCachedMembers, updateCachedMembers } from './utils/cache'
import checkCronjob from './utils/checkCronjob'
import handleMessage from './utils/handleMessage'
import { handleRaw } from './utils/handleReaction'
import { loggerHook } from './utils/hooks'
import remindCronJob from './utils/remindCronJob'

moment.locale('zh-tw')
const client = new Client()

client.on('message', message => handleMessage(message))
client.on('guildMemberRemove', member => removeCachedMembers(member))
client.on('raw', packet => handleRaw(client, packet))
client.on('ready', () => {
  loggerHook.send(
    '`TIME` USER_TAG'
      .replace('TIME', moment().format('YYYY-MM-DD HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || ''),
  )
})

const locks = {
  checkJob: false,
  remindJob: false,
  updateMember: false,
}

// let intervalLock = false
client.setInterval(async () => {
  const now = Date.now()

  if (!locks.checkJob) {
    locks.checkJob = true
    await checkCronjob(client, now)
    locks.checkJob = false
  }

  if (!locks.remindJob) {
    locks.remindJob = true
    await remindCronJob(client, now)
    locks.remindJob = false
  }
}, 20000)

client.setInterval(async () => {
  client.user?.setActivity('Version 2021.08.04 | https://discord.gg/Ctwz4BB')

  if (!locks.updateMember) {
    locks.updateMember = true
    await updateCachedMembers(client)
    locks.updateMember = false
  }
}, 60000)

client.login(config.DISCORD.TOKEN)
