import { DateTime } from 'luxon'
import cache from './cache'

const timeFormatter: (options?: { time?: number | null; guildId?: string; format?: string }) => string = (options) => {
  const offset = cache.settings[options?.guildId || '']?.offset ?? 8
  const diff = offset - 8
  return DateTime.fromMillis(options?.time || Date.now())
    .plus({ hour: diff })
    .toFormat(options?.format || 'yyyy-MM-dd HH:mm:ss')
}

export default timeFormatter
