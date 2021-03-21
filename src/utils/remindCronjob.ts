import { Client, DMChannel } from 'discord.js'
import database, { cache } from './database'
import getReactionStatus from './getReactionStatus'
import { sendResponse } from './handleMessage'

const remindCronjob: (client: Client) => Promise<void> = async client => {
  const jobs = cache.remindJobs
  const now = Date.now()

  for (const jobId in jobs) {
    if (jobId === '_' || jobs[jobId].remindAt > now || jobs[jobId].isTest) {
      continue
    }

    try {
      const targetChannel = await client.channels.fetch(jobs[jobId].channelId)
      const responseChannel = await client.channels.fetch(jobs[jobId].responseChannelId)
      if (
        !targetChannel.isText() ||
        !responseChannel.isText() ||
        targetChannel instanceof DMChannel ||
        responseChannel instanceof DMChannel
      ) {
        throw new Error('Invalid channels')
      }
      const targetMessage = await targetChannel.messages.fetch(jobs[jobId].messageId)
      const commandMessage = await responseChannel.messages.fetch(jobId)

      await sendResponse(commandMessage, await getReactionStatus(targetMessage))
      database.ref(`/remindJobs/${jobId}`).remove()
    } catch {
      if (jobs[jobId].retryTimes > 3) {
        database.ref(`/remindJobs/${jobId}`).remove()
        continue
      }
      await database.ref(`/remindJobs/${jobId}/retryTimes`).set(jobs[jobId].retryTimes + 1)
    }
  }
}

export default remindCronjob
