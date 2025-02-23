import { Client } from 'discord.js'
import { DateTime } from 'luxon'
import OpenColor from 'open-color' with { type: 'json' }
import { getCheckResult } from '../commands/check.js'
import { getRaffleResult } from '../commands/raffle.js'
import { JobProps } from '../types.js'
import colorFormatter from '../utils/colorFormatter.js'
import fetchTargetMessage from '../utils/fetchTargetMessage.js'
import timeFormatter from '../utils/timeFormatter.js'
import { translate } from '../utils/translation.js'
import cache, { database } from './cache.js'
import initGuild from './initGuild.js'
import sendLog from './sendLog.js'

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
        throw new Error('CHANNEL_NOT_FOUND')
      }

      const targetMessage = await fetchTargetMessage({
        guild: targetGuild,
        search: `${targetChannel.id}-${job.target.messageId}`,
      })
      const jobType = jobId.split('_')[0]
      const commandResult =
        jobType === 'check'
          ? await getCheckResult(targetMessage)
          : jobType === 'raffle'
            ? await getRaffleResult(targetMessage, { count: job.command.raffleCount || 100 })
            : undefined
      if (!commandResult) {
        throw new Error('NO_COMMAND_RESULT')
      }

      const warnings: string[] = []

      if (job.repeat) {
        const newRetryTimes = commandResult.meta?.isReactionEmpty ? job.retryTimes + 1 : 0
        if (newRetryTimes >= 3) {
          warnings.push(translate('check.text.jobIsRemovedWarning', { guildId: job.command.guildId }))
          await database.ref(`/jobs/${jobId}`).remove()
        } else {
          const repeatAt = DateTime.fromMillis(job.executeAt)
            .plus(job.repeat === 'season' ? { month: 3 } : { [job.repeat]: 1 })
            .toMillis()
          const newJob: JobProps = {
            ...job,
            executeAt: repeatAt,
            retryTimes: newRetryTimes,
          }
          try {
            await targetMessage.reactions.removeAll()
            await database.ref(`/jobs/${jobId}`).set(newJob)
            warnings.push(
              translate('check.text.newRepeatedJob', { guildId: job.command.guildId }).replace(
                '{REPEAT_AT}',
                timeFormatter({ time: repeatAt, guildId: job.command.guildId, format: 'yyyy-MM-dd HH:mm' }),
              ),
            )
          } catch {
            warnings.push(translate('check.text.jobRenewFailedWarning', { guildId: job.command.guildId }))
            await database.ref(`/jobs/${jobId}`).remove()
          }
        }
      } else {
        await database.ref(`/jobs/${jobId}`).remove()
      }

      if (warnings.length && commandResult.embed?.description) {
        commandResult.embed.description += `\n${warnings.join('\n')}`
      }

      const responseMessage = await commandChannel.send({
        content: commandResult.content,
        embeds: commandResult.embed
          ? [
              {
                color: colorFormatter(OpenColor.orange[5]),
                title: translate('system.text.support', { guildId: job.command.guildId }),
                url: 'https://discord.gg/Ctwz4BB',
                footer: { text: cache.footer },
                ...commandResult.embed,
              },
            ]
          : undefined,
        files: commandResult.files,
      })

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
    } catch (error) {
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
            content: 'Error to execute job.',
          },
          error: error instanceof Error ? error : undefined,
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
