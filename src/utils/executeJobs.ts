import { ChannelType, Client } from 'discord.js'
import OpenColor from 'open-color'
import { getCheckResult } from '../commands/check'
import cache, { database } from './cache'
import colorFormatter from './colorFormatter'
import initGuild from './initGuild'
import sendLog from './sendLog'
import { translate } from './translation'

let lock = 0

const executeJobs = async (client: Client) => {
  if (lock) {
    return
  }
  lock = 1

  for (const jobId in cache.jobs) {
    const executeAt = Date.now()
    const job = cache.jobs[jobId]

    if (!job || job.clientId !== client.user?.id || job.executeAt > executeAt) {
      continue
    }

    try {
      if (!cache.isInit[job.command.guildId]) {
        initGuild(client, job.command.guildId)
      }

      const targetGuild = client.guilds.cache.get(job.command.guildId)
      const targetChannel = client.channels.cache.get(job.target.channelId)
      const commandChannel = client.channels.cache.get(job.command.channelId)
      if (
        !targetGuild ||
        !targetChannel?.isTextBased() ||
        !commandChannel?.isTextBased() ||
        commandChannel.type === ChannelType.DM
      ) {
        throw new Error('Channel is not found')
      }
      const targetMessage = await targetChannel.messages.fetch(job.target.messageId)

      const jobType = jobId.split('_')[0]
      if (jobType === 'check') {
        const commandResult = await getCheckResult(targetMessage)
        if (!commandResult) {
          throw new Error('No command result')
        }
        const responseMessage = await commandChannel.send({
          content: commandResult.content,
          embeds: commandResult.embed
            ? [
                {
                  color: colorFormatter(OpenColor.orange[5]),
                  title: translate('system.text.support', { guildId: job.command.guildId }),
                  url: 'https://discord.gg/Ctwz4BB',
                  footer: { text: 'Version 2022-08-31' },
                  ...commandResult.embed,
                },
              ]
            : undefined,
          files: commandResult.files,
        })
        await database.ref(`/jobs/${jobId}`).remove()
        await sendLog({
          time: executeAt,
          processTime: responseMessage.createdTimestamp - executeAt,
          command: 'Execute job {JOB_ID}'.replace('{JOB_ID}', jobId),
          content: commandResult.content,
          embeds: commandResult.embed ? [commandResult.embed] : undefined,
          files: commandResult.files,
          guildId: job.command.guildId,
          guildName: client.guilds.cache.get(job.command.guildId)?.name,
          channelId: job.command.channelId,
          channelName: commandChannel.name,
          userId: job.command.userId,
          userName: client.users.cache.get(job.command.userId)?.tag,
        })
      } else if (jobType === 'raffle') {
      }
    } catch (error: any) {
      if (job.retryTimes > 1) {
        const commandChannel = client.channels.cache.get(job.command.channelId)
        await sendLog({
          time: job.executeAt,
          processTime: Date.now() - executeAt,
          command: `${jobId}`,
          content: 'ERROR to execute job {JOB_ID}'.replace('{JOB_ID}', jobId),
          guildId: job.command.guildId,
          guildName: client.guilds.cache.get(job.command.guildId)?.name,
          channelId: job.command.channelId,
          channelName: commandChannel?.type === ChannelType.DM ? undefined : commandChannel?.name || undefined,
          userId: job.command.userId,
          userName: client.users.cache.get(job.command.userId)?.tag,
          error,
        })
        await database.ref(`/jobs/${jobId}`).remove()
      } else {
        await database.ref(`/jobs/${jobId}/retryTimes`).set(job.retryTimes + 1)
      }
    }
  }

  lock = 0
}

export default executeJobs
