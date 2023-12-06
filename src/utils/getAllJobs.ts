import { Guild } from 'discord.js'
import { RepeatType } from '../types'
import cache from './cache'
import timeFormatter from './timeFormatter'
import { translate } from './translation'

const getAllJobs = (clientId: string, guild: Guild, type: 'check' | 'raffle' | 'all') => {
  const jobs: {
    id: string
    targetMessageUrl: string
    repeat?: RepeatType
    executeAt: number
  }[] = []

  for (const jobId in cache.jobs) {
    const job = cache.jobs[jobId]
    if (!job || job.clientId !== clientId || job.command.guildId !== guild.id) {
      continue
    }
    if (type !== 'all' && !jobId.startsWith(type)) {
      continue
    }
    jobs.push({
      id: jobId,
      targetMessageUrl: `https://https://discord.com/channels/${guild.id}/${job.target.channelId}/${job.target.messageId}`,
      executeAt: job.executeAt,
      repeat: job.repeat,
    })
  }

  jobs.sort((a, b) => a.executeAt - b.executeAt)

  return (
    jobs
      .map(job =>
        translate('cancel.text.job', { guildId: guild.id })
          .replace('{JOB_ID}', job.id)
          .replace('{TIME}', timeFormatter({ time: job.executeAt, guildId: guild.id, format: 'yyyy-MM-dd HH:mm' }))
          .replace('{FROM_NOW}', `<t:${Math.floor(job.executeAt / 1000)}:R>`)
          .replace('{TARGET_URL}', job.targetMessageUrl)
          .replace(
            '{REPEAT_PERIOD}',
            translate(job.repeat ? `check.label.${job.repeat}` : 'check.label.noRepeat', { guildId: guild.id }),
          ),
      )
      .join('\n\n') || translate('cancel.text.empty', { guildId: guild.id })
  )
}

export default getAllJobs
