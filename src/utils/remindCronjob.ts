import { Client, DMChannel } from 'discord.js'
import moment from 'moment'
import database, { cache } from './database'
import getReactionStatus from './getReactionStatus'
import { loggerHook } from './hooks'

const remindCronjob: (client: Client) => Promise<void> = async client => {
  const remindJobQueue = cache.remind_jobs
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
        targetChannel instanceof DMChannel ||
        !responseChannel.isText() ||
        responseChannel instanceof DMChannel
      ) {
        database.ref(`/remind_jobs/${jobId}`).remove()
        continue
      }

      const targetMessage = await targetChannel.messages.fetch(remindJobQueue[jobId].messageId)
      const responseMessage = await responseChannel.send(await getReactionStatus(targetMessage))
      loggerHook.send(
        '[`TIME`] `GUILD_ID` `MESSAGE_ID` is reminded at `REMIND_AT`\nRESPONSE_CONTENT'
          .replace('TIME', moment(responseMessage.createdTimestamp).format('HH:mm:ss'))
          .replace('GUILD_ID', remindJobQueue[jobId].guildId)
          .replace('MESSAGE_ID', remindJobQueue[jobId].messageId)
          .replace('REMIND_AT', moment(remindJobQueue[jobId].remindAt).format('YYYY-MM-DD HH:mm:ss'))
          .replace('RESPONSE_CONTENT', responseMessage.content),
      )
      database.ref(`/remind_jobs/${jobId}`).remove()
    } catch {
      if (remindJobQueue[jobId].retryTimes > 3) {
        database.ref(`/remind_jobs/${jobId}`).remove()
        continue
      }
      await database.ref(`/remind_jobs/${jobId}/retryTimes`).set(remindJobQueue[jobId].retryTimes + 1)
    }
  }
}

export default remindCronjob
