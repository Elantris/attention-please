import { DateTime } from 'luxon'
import cache from './cache'
import timeFormatter from './timeFormatter'

const parseTime: (options: { guildId: string; time: string | null }) => number = ({ time, guildId }) => {
  if (!time) {
    return 0
  }

  const numbers = time.match(/\d+/g)?.map(v => parseInt(v)) || []
  const targetTime = new Date(numbers[0] ?? 0, (numbers[1] ?? 1) - 1, numbers[2] ?? 0, numbers[3] ?? 0, numbers[4] ?? 0)
  if (!Number.isSafeInteger(targetTime.getTime())) {
    throw new Error('INVALID_TIME_FORMAT', {
      cause: {
        TIME: timeFormatter({ guildId, format: 'yyyy-MM-dd HH:mm' }),
        USER_INPUT: time,
      },
    })
  }

  const offset = cache.settings[guildId].offset ?? 8
  const diff = offset - 8
  return DateTime.fromJSDate(targetTime).minus({ hour: diff }).toMillis()
}

export default parseTime
