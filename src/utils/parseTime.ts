import { DateTime } from 'luxon'
import { ResultProps } from '../types'
import cache from './cache'
import timeFormatter from './timeFormatter'
import { translate } from './translation'

const parseTime: (options: { guildId: string; time: string | null }) => {
  time?: number
  response?: ResultProps
} = ({ time, guildId }) => {
  if (!time) {
    return {}
  }

  const offset = cache.settings[guildId].offset ?? 8

  const targetTime = DateTime.fromFormat(`${time} ${offset >= 0 ? '+' : ''}${offset}`, 'yyyy-MM-dd HH:mm Z')
  if (!targetTime.isValid) {
    return {
      response: {
        content: translate('system.error.timeFormat', { guildId }),
        embed: {
          description: translate('system.error.timeFormatHelp', { guildId })
            .replace('{TIME}', timeFormatter({ guildId, format: 'yyyy-MM-dd HH:mm' }))
            .replace('{USER_INPUT}', time),
        },
      },
    }
  }

  return {
    time: targetTime.toMillis(),
  }
}

export default parseTime
