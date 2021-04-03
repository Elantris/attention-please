import { Client, DMChannel } from 'discord.js'
import database, { cache } from './database'
import getReactionStatus from './getReactionStatus'
import { sendResponse } from './handleMessage'

const remindCronjob: (client: Client) => Promise<void> = async client => {
  const now = Date.now()

  for (const jobId in cache.remindJobs) {
    const remindJob = cache.remindJobs[jobId]
    if (jobId === '_' || !remindJob || remindJob.isTest || remindJob.remindAt > now) {
      continue
    }

    try {
      const targetChannel = await client.channels.fetch(remindJob.channelId)
      const responseChannel = await client.channels.fetch(remindJob.responseChannelId)
      if (
        !targetChannel.isText() ||
        !responseChannel.isText() ||
        targetChannel instanceof DMChannel ||
        responseChannel instanceof DMChannel
      ) {
        throw new Error('Invalid channels')
      }
      const targetMessage = await targetChannel.messages.fetch(remindJob.messageId)
      const commandMessage = await responseChannel.messages.fetch(jobId)

      await sendResponse(commandMessage, await getReactionStatus(targetMessage))
      database.ref(`/remindJobs/${jobId}`).remove()
    } catch {
      if (remindJob.retryTimes > 3) {
        database.ref(`/remindJobs/${jobId}`).remove()
        continue
      }
      await database.ref(`/remindJobs/${jobId}/retryTimes`).set(remindJob.retryTimes + 1)
    }
  }
}

export default remindCronjob
