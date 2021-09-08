import { Client } from 'discord.js'
import cache, { database } from './cache'
import getReactionStatus from './getReactionStatus'
import sendLog from './sendLog'

const checkCronjob = async (client: Client, now: number) => {
  for (const jobId in cache.checkJobs) {
    const checkJob = cache.checkJobs[jobId]
    if (
      jobId === '_' ||
      !checkJob ||
      checkJob.clientId !== client.user?.id ||
      checkJob.checkAt > now ||
      checkJob.retryTimes > 2
    ) {
      continue
    }

    try {
      const guild = await client.guilds.fetch(checkJob.guildId)
      const targetChannel = guild.channels.cache.get(checkJob.channelId)
      const responseChannel = guild.channels.cache.get(checkJob.responseChannelId)

      if (!targetChannel?.isText() || !responseChannel?.isText()) {
        throw new Error('channel not found')
      }

      const targetMessage = await targetChannel.messages.fetch(checkJob.messageId)
      const commandMessage = await responseChannel.messages.fetch(jobId)
      const responseMessages = await responseChannel.send(await getReactionStatus(targetMessage), {
        split: { char: ' ' },
      })

      sendLog(client, {
        commandMessage,
        responseMessage: responseMessages[responseMessages.length - 1],
        color: 0xffc078,
        time: now,
        content: 'Execute check job `JOB_ID`'.replace('JOB_ID', jobId),
      })

      await database.ref(`/checkJobs/${jobId}`).remove()
    } catch (error: any) {
      if (checkJob.retryTimes > 2) {
        sendLog(client, {
          time: now,
          content: 'Failed to execute check job `JOB_ID`'.replace('JOB_ID', jobId),
          guildId: checkJob.guildId,
          channelId: checkJob.channelId,
          userId: checkJob.userId,
          error,
        })
        await database.ref(`/checkJobs/${jobId}`).remove()
      } else {
        await database.ref(`/checkJobs/${jobId}/retryTimes`).set(checkJob.retryTimes + 1)
      }
    }
  }
}

export default checkCronjob
