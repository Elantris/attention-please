import { DateTime } from 'luxon'
import cache from './cache'

const timeFormatter: (options?: { guildId?: string; time?: number | null; format?: string }) => string = options =>
  DateTime.fromMillis(options?.time || Date.now())
    .setZone((options?.guildId && cache.settings[options.guildId]?.timezone) || 'Asia/Taipei')
    .toFormat(options?.format || 'yyyy-MM-dd HH:mm')

export default timeFormatter
