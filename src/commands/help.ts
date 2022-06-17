import { CommandProps } from '../types'
import cache from '../utils/cache'
import { translate } from '../utils/translation'

const commandHelp: CommandProps = async ({ guildId }) => {
  const prefix = cache.settings[guildId]?.prefix || 'ap!'

  return {
    response: {
      content: translate('help.text.summary', { guildId })
        .replace('PREFIX', prefix)
        .replace('MANUAL', 'https://hackmd.io/@eelayntris/attention-please')
        .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
    },
  }
}

export default commandHelp
