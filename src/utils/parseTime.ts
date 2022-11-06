import { DateTime } from 'luxon'
import cache from './cache'
import timeFormatter from './timeFormatter'

const parseTime: (options: { guildId: string; time: string | null }) => number = ({ time, guildId }) => {
  if (!time) {
    return 0
  }

  const offset = cache.settings[guildId].offset ?? 8

  const targetTime = DateTime.fromFormat(`${time} ${offset >= 0 ? '+' : ''}${offset}`, 'yyyy-MM-dd HH:mm Z')
  if (!targetTime.isValid) {
    throw new Error('INVALID_TIME_FORMAT', {
      cause: {
        TIME: timeFormatter({ guildId, format: 'yyyy-MM-dd HH:mm' }),
        USER_INPUT: time,
      },
    })
  }

  return targetTime.toMillis()
}

export default parseTime
