import { Client } from 'discord.js'
import OpenColor from 'open-color'
import { getCheckResult } from '../commands/check'
import { getRaffleResult } from '../commands/raffle'
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
      await initGuild(client, job.command.guildId)

      const targetGuild = client.guilds.cache.get(job.command.guildId)
      const targetChannel = targetGuild?.channels.cache.get(job.target.channelId)
      const commandChannel = targetGuild?.channels.cache.get(job.command.channelId)
      if (!targetGuild || !targetChannel?.isTextBased() || !commandChannel?.isTextBased()) {
        throw new Error('Channel is not found')
      }
      const targetMessage = await targetChannel.messages.fetch(job.target.messageId)

      const jobType = jobId.split('_')[0]

      const commandResult =
        jobType === 'check'
          ? await getCheckResult(targetMessage)
          : jobType === 'raffle'
          ? await getRaffleResult(targetMessage, { count: job.command.raffleCount || 30 })
          : undefined
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
                footer: { text: 'Version 2022-09-24' },
                ...commandResult.embed,
              },
            ]
          : undefined,
        files: commandResult.files,
      })
      await database.ref(`/jobs/${jobId}`).remove()
      await sendLog({
        command: {
          createdAt: executeAt,
          content: `Execute job ${jobId}`,
          guildId: job.command.guildId,
          guildName: client.guilds.cache.get(job.command.guildId)?.name,
          channelId: job.command.channelId,
          channelName: commandChannel.name,
          userId: job.command.userId,
          userName: client.users.cache.get(job.command.userId)?.tag,
        },
        result: {
          createdAt: responseMessage.createdTimestamp,
          content: commandResult.content,
          embed: commandResult.embed,
          files: commandResult.files,
        },
      })
    } catch (error: any) {
      if (job.retryTimes > 1) {
        const guild = client.guilds.cache.get(job.command.guildId)
        const commandChannel = guild?.channels.cache.get(job.command.channelId)
        await sendLog({
          command: {
            createdAt: executeAt,
            content: `Execute job ${jobId}`,
            guildId: job.command.guildId,
            guildName: guild?.name,
            channelId: job.command.channelId,
            channelName: commandChannel?.name,
            userId: job.command.userId,
            userName: client.users.cache.get(job.command.userId)?.tag,
          },
          result: {
            createdAt: Date.now(),
            content: 'Error to execute.',
          },
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
