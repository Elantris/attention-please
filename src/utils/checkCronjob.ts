import { Client, DMChannel } from 'discord.js'
import moment from 'moment'
import cache, { database } from './cache'
import getReactionStatus from './getReactionStatus'
import { sendLog, sendResponse } from './handleMessage'

const checkCronjob = async (client: Client, now: number) => {
  for (const jobId in cache.checkJobs) {
    const checkJob = cache.checkJobs[jobId]
    if (
      jobId === '_' ||
      !checkJob ||
      checkJob.clientId !== client.user?.id ||
      checkJob.checkAt > now ||
      checkJob.retryTimes > 3
    ) {
      continue
    }

    try {
      const guild = await client.guilds.fetch(checkJob.guildId)
      const channel = guild.channels.cache.get(checkJob.channelId)
      const responseChannel = guild.channels.cache.get(checkJob.responseChannelId)

      if (!channel?.isText() || !responseChannel?.isText()) {
        throw new Error('Invalid channel')
      }

      const targetMessage = await channel.messages.fetch(checkJob.messageId)
      const commandMessage = await responseChannel.messages.fetch(jobId)

      await sendResponse(commandMessage, await getReactionStatus(targetMessage))

      await database.ref(`/checkJobs/${jobId}`).remove()
    } catch (error) {
      await database.ref(`/checkJobs/${jobId}/retryTimes`).set(checkJob.retryTimes + 1)

      sendLog(client, {
        content: '[`TIME`] Execute check job `JOB_ID`'
          .replace('TIME', moment(now).format('HH:MM:ss'))
          .replace('JOB_ID', jobId),
        guildId: checkJob.guildId,
        channelId: checkJob.channelId,
        error,
      })
    }
  }
}

export default checkCronjob
