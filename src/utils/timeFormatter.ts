import { DateTime } from 'luxon'
import cache from '../helper/cache.js'

const timeFormatter: (options?: { time?: number | null; guildId?: string; format?: string }) => string = (options) =>
  DateTime.fromMillis(options?.time || Date.now())
    .setZone('utc')
    .plus({ hour: cache.settings[options?.guildId || '']?.offset ?? 8 })
    .toFormat(options?.format || 'yyyy-MM-dd HH:mm:ss')

export default timeFormatter
