import { Client, DMChannel } from 'discord.js'
import moment from 'moment'
import database, { cache } from './database'
import getReactionStatus from './getReactionStatus'
import { sendLog } from './handleMessage'
import { loggerHook } from './hooks'

const remindCronjob: (client: Client) => Promise<void> = async client => {
  const remindJobQueue = cache.remindJobs
  const now = Date.now()

  for (const jobId in remindJobQueue) {
    if (jobId.includes('_') || remindJobQueue[jobId].remindAt > now) {
      continue
    }

    try {
      const targetChannel = await client.channels.fetch(remindJobQueue[jobId].channelId)
      const responseChannel = await client.channels.fetch(remindJobQueue[jobId].responseChannelId)
      if (
        !targetChannel.isText() ||
        !responseChannel.isText() ||
        targetChannel instanceof DMChannel ||
        responseChannel instanceof DMChannel
      ) {
        throw new Error('Invalid channels')
      }

      const targetMessage = await targetChannel.messages.fetch(remindJobQueue[jobId].messageId)
      const responseMessage = await responseChannel.send(await getReactionStatus(targetMessage))

      loggerHook.send(
        '[`TIME`] `JOB_ID`: `GUILD_ID`/`CHANNEL_ID` [`REMIND_AT`]\nRESPONSE_CONTENT'
          .replace('TIME', moment(responseMessage.createdTimestamp).format('HH:mm:ss'))
          .replace('JOB_ID', jobId)
          .replace('GUILD_ID', remindJobQueue[jobId].guildId)
          .replace('CHANNEL_ID', remindJobQueue[jobId].channelId)
          .replace('REMIND_AT', moment(remindJobQueue[jobId].remindAt).format('YYYY-MM-DD HH:mm:ss'))
          .replace('RESPONSE_CONTENT', responseMessage.content),
        { embeds: responseMessage.embeds },
      )
      database.ref(`/remindJobs/${jobId}`).remove()
    } catch {
      if (remindJobQueue[jobId].retryTimes > 3) {
        database.ref(`/remindJobs/${jobId}`).remove()
        continue
      }
      await database.ref(`/remindJobs/${jobId}/retryTimes`).set(remindJobQueue[jobId].retryTimes + 1)
    }
  }
}

export default remindCronjob
