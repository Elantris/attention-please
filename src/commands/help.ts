import { CommandProps } from '../types'
import cache from '../utils/cache'

const commandHelp: CommandProps = async ({ guildId }) => {
  const prefix = cache.settings[guildId]?.prefix || 'ap!'

  return {
    response: {
      content: ':pushpin: Attention Please\n指令前綴：`PREFIX`\n說明文件：<MANUAL>\n開發群組：DISCORD'
        .replace('PREFIX', prefix)
        .replace('MANUAL', 'https://hackmd.io/@eelayntris/attention-please')
        .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
    },
  }
}

export default commandHelp
