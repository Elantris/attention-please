import { Client, NewsChannel, TextChannel } from 'discord.js'
import moment from 'moment'
import database, { cache } from './database'
import { sendLog } from './handleMessage'

const remindCronJob = async (client: Client, now: number) => {
  for (const jobId in cache.remindJobs) {
    const remindJob = cache.remindJobs[jobId]
    if (jobId === '_' || !remindJob || remindJob.remindAt > now || remindJob.clientId !== client.user?.id) {
      continue
    }

    try {
      const targetUser = await client.users.fetch(remindJob.userId)
      const guild = await client.guilds.fetch(remindJob.guildId)
      const channel = await client.channels.fetch(remindJob.channelId)
      if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
        throw new Error('channel not found')
      }

      await targetUser.send(
        'GUILD_NAME / CHANNEL_NAME (DURATION)\nMESSAGE_URL'
          .replace('GUILD_NAME', guild.name)
          .replace('CHANNEL_NAME', channel.name)
          .replace('DURATION', moment(remindJob.createdAt).from(now))
          .replace(
            'MESSAGE_URL',
            `https://discord.com/channels/${remindJob.guildId}/${remindJob.channelId}/${remindJob.messageId}`,
          ),
      )
      await database.ref(`/remindJobs/${jobId}`).remove()

      sendLog(client, {
        content: '[`TIME`] `JOB_ID` sent'.replace('TIME', moment(now).format('HH:MM:ss')).replace('JOB_ID', jobId),
        guildId: remindJob.guildId,
        channelId: remindJob.channelId,
        userId: remindJob.userId,
      })
    } catch {
      if (remindJob.retryTimes > 3) {
        await database.ref(`/remindJobs/${jobId}`).remove()
      } else {
        await database.ref(`/remindJobs/${jobId}/retryTimes`).set(remindJob.retryTimes + 1)
      }
    }
  }
}

export default remindCronJob
