import { Client, DMChannel } from 'discord.js'
import database, { cache } from './database'
import getReactionStatus from './getReactionStatus'
import { sendResponse } from './handleMessage'

const checkCronjob: (client: Client) => Promise<void> = async client => {
  const now = Date.now()

  for (const jobId in cache.checkJobs) {
    const checkJob = cache.checkJobs[jobId]
    if (jobId === '_' || !checkJob || checkJob.checkAt > now || checkJob.client !== client.user?.tag) {
      continue
    }

    try {
      const targetChannel = await client.channels.fetch(checkJob.channelId)
      const responseChannel = await client.channels.fetch(checkJob.responseChannelId)
      if (
        !targetChannel.isText() ||
        !responseChannel.isText() ||
        targetChannel instanceof DMChannel ||
        responseChannel instanceof DMChannel
      ) {
        throw new Error('Invalid channels')
      }
      const targetMessage = await targetChannel.messages.fetch(checkJob.messageId)
      const commandMessage = await responseChannel.messages.fetch(jobId)

      await sendResponse(commandMessage, await getReactionStatus(targetMessage))
      database.ref(`/checkJobs/${jobId}`).remove()
    } catch {
      if (checkJob.retryTimes > 3) {
        database.ref(`/checkJobs/${jobId}`).remove()
        continue
      }
      await database.ref(`/checkJobs/${jobId}/retryTimes`).set(checkJob.retryTimes + 1)
    }
  }
}

export default checkCronjob
