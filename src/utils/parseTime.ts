import { DateTime } from 'luxon'
import cache from './cache'
import timeFormatter from './timeFormatter'

const parseTime: (options: { guildId: string; time: string | null }) => number = ({ time, guildId }) => {
  if (!time) {
    return 0
  }

  const numbers = time.match(/\d+/g)?.map((v) => parseInt(v)) || []
  const targetTime = new Date(numbers[0] ?? 0, (numbers[1] ?? 1) - 1, numbers[2] ?? 0, numbers[3] ?? 0, numbers[4] ?? 0)
  if (!Number.isSafeInteger(targetTime.getTime()) || numbers[0] < 2024) {
    throw new Error('INVALID_TIME_FORMAT', {
      cause: {
        TIME: timeFormatter({ guildId, format: 'yyyy-MM-dd HH:mm' }),
        USER_INPUT: time,
      },
    })
  }

  const target = {
    year: `${targetTime.getFullYear()}`,
    month: `${targetTime.getMonth() + 1}`.padStart(2, '0'),
    date: `${targetTime.getDate()}`.padStart(2, '0'),
    hours: `${targetTime.getHours()}`.padStart(2, '0'),
    minutes: `${targetTime.getMinutes()}`.padStart(2, '0'),
    offset: `${cache.settings[guildId].offset ?? 8}`.padStart(2, '0'),
  }
  return DateTime.fromISO(
    `${target.year}-${target.month}-${target.date}T${target.hours}:${target.minutes}+${target.offset}:00`,
  ).toMillis()
}

export default parseTime
