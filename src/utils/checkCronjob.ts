import { Client } from 'discord.js'
import cache, { database } from './cache'
import getReactionStatus from './getReactionStatus'
import sendLog from './sendLog'

const checkCronjob = async (client: Client, now: number) => {
  for (const jobId in cache.checkJobs) {
    const checkJob = cache.checkJobs[jobId]
    if (jobId === '_' || !checkJob || checkJob.clientId !== client.user?.id || checkJob.checkAt > now) {
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
      const result = await getReactionStatus(targetMessage)
      const responseMessages = await responseChannel.send(result.content, {
        files: result.files,
        embed: result.embed,
        split: { char: ' ' },
      })

      sendLog(client, {
        color: '#ffc078',
        time: now,
        content: 'Execute check job `JOB_ID`\nRESPONSE_CONTENT'
          .replace('JOB_ID', jobId)
          .replace('RESPONSE_CONTENT', responseMessages[responseMessages.length - 1].content),
        embeds: responseMessages[responseMessages.length - 1].embeds,
        guildId: commandMessage.guild?.id,
        channelId: commandMessage.channel.id,
        userId: commandMessage.author.id,
      })

      await database.ref(`/checkJobs/${jobId}`).remove()
    } catch (error: any) {
      if (checkJob.retryTimes > 1) {
        sendLog(client, {
          color: '#ff6b6b',
          time: now,
          content: 'Failed to execute check job `JOB_ID`'.replace('JOB_ID', jobId),
          guildId: checkJob.guildId,
          channelId: checkJob.responseChannelId,
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
