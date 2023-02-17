import { Guild } from 'discord.js'
import cache from './cache'
import timeFormatter from './timeFormatter'
import { translate } from './translation'

const getAllJobs = (clientId: string, guild: Guild, type: 'check' | 'raffle' | 'all') => {
  const jobs: {
    id: string
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
      executeAt: job.executeAt,
    })
  }

  jobs.sort((a, b) => a.executeAt - b.executeAt)

  return translate('cancel.text.allJobs', { guildId: guild.id }).replace(
    '{ALL_JOBS}',
    jobs
      .map((job, index) =>
        '{NUMBER}. `{JOB_ID}`: `{TIME}` {FROM_NOW}'
          .replace('{NUMBER}', `${index + 1}`)
          .replace('{JOB_ID}', job.id)
          .replace('{TIME}', timeFormatter({ time: job.executeAt, guildId: guild.id, format: 'yyyy-MM-dd HH:mm' }))
          .replace('{FROM_NOW}', `<t:${Math.floor(job.executeAt / 1000)}:R>`),
      )
      .join('\n') || translate('cancel.text.empty', { guildId: guild.id }),
  )
}

export default getAllJobs
