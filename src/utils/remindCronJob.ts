import { Client, NewsChannel, TextChannel, Util } from 'discord.js'
import moment from 'moment'
import cache, { database } from './cache'
import { sendLog } from './handleMessage'

const remindCronJob = async (client: Client, now: number) => {
  for (const jobId in cache.remindJobs) {
    const remindJob = cache.remindJobs[jobId]
    if (jobId === '_' || !remindJob || remindJob.remindAt > now || remindJob.clientId !== client.user?.id) {
      continue
    }

    try {
      const user = await client.users.fetch(remindJob.userId)
      const guild = await client.guilds.fetch(remindJob.guildId)
      const channel = await client.channels.fetch(remindJob.channelId)
      if (!(channel instanceof TextChannel) && !(channel instanceof NewsChannel)) {
        throw new Error('channel not found')
      }
      const message = await channel.messages.fetch(remindJob.messageId)

      await user.send(
        '`TIME` GUILD_NAME / CHANNEL_NAME / **MEMBER_NAME**\nMESSAGE_URL\nMESSAGE_CONTENT'
          .replace('TIME', moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm'))
          .replace('GUILD_NAME', Util.escapeMarkdown(guild.name))
          .replace('CHANNEL_NAME', Util.escapeMarkdown(channel.name))
          .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || ''))
          .replace(
            'MESSAGE_URL',
            `https://discord.com/channels/${remindJob.guildId}/${remindJob.channelId}/${remindJob.messageId}`,
          )
          .replace('MESSAGE_CONTENT', message.content),
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
