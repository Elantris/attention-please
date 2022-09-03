import { DateTime } from 'luxon'
import { ResultProps } from '../types'
import timeFormatter from './timeFormatter'
import { translate } from './translation'

const getTime: (options: { guildId: string; time: string | null }) => {
  time?: number
  response?: ResultProps
} = ({ time, guildId }) => {
  if (!time) {
    return {}
  }

  const targetTime = DateTime.fromFormat(time, 'yyyy-MM-dd HH:mm')
  if (!targetTime.isValid) {
    return {
      response: {
        content: translate('system.error.timeFormat', { guildId }).replace('{TIME}', timeFormatter({ guildId })),
        embed: {
          description: translate('system.error.timeFormatHelp', { guildId }),
        },
      },
    }
  }

  return { time: targetTime.toMillis() }
}

export default getTime
