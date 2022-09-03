import { DateTime } from 'luxon'

const timeFormatter: (options?: { time?: number | null; guildId?: string; format?: string }) => string = options =>
  DateTime.fromMillis(options?.time || Date.now()).toFormat(options?.format || 'yyyy-MM-dd HH:mm')

export default timeFormatter
