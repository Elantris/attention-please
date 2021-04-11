import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import checkCronjob from './utils/checkCronjob'
import handleMessage, { sendLog } from './utils/handleMessage'
import { handleReactionAdd, handleReactionRemove } from './utils/handleReaction'
import { loggerHook } from './utils/hooks'
import remindCronJob from './utils/remindCronJob'

const client = new Client()

client.on('message', handleMessage)
client.on('raw', packet => {
  try {
    if (packet.t === 'MESSAGE_REACTION_ADD') {
      handleReactionAdd(client, {
        userId: packet.d.user_id,
        guildId: packet.d.guild_id,
        channelId: packet.d.channel_id,
        messageId: packet.d.message_id,
        emoji: packet.d.emoji.name,
      })
    } else if (packet.t === 'MESSAGE_REACTION_REMOVE') {
      handleReactionRemove(client, {
        userId: packet.d.user_id,
        guildId: packet.d.guild_id,
        channelId: packet.d.channel_id,
        messageId: packet.d.message_id,
        emoji: packet.d.emoji.name,
      })
    }
  } catch (error) {
    sendLog(client, { error })
  }
})

client.on('ready', () => {
  client.user?.setActivity('Version 2021.04.11 | https://discord.gg/Ctwz4BB')
  loggerHook.send(
    '[`TIME`] USER_TAG'.replace('TIME', moment().format('HH:mm:ss')).replace('USER_TAG', client.user?.tag || ''),
  )
})

let intervalLock = false
client.setInterval(async () => {
  intervalLock = true
  const now = Date.now()
  await checkCronjob(client, now)
  await remindCronJob(client, now)
  intervalLock = false
}, 20000)

client.login(config.DISCORD.TOKEN)
