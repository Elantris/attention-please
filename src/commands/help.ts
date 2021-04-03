import { CommandProps } from '../types'
import { cache } from '../utils/database'

const commandHelp: CommandProps = async ({ guildId }) => {
  return {
    content: ':question: Attention Please\n指令前綴：`PREFIX`\n說明文件：<MANUAL>\n開發群組：DISCORD'
      .replace('PREFIX', cache.settings[guildId]?.prefix || 'ap!')
      .replace('MANUAL', 'https://hackmd.io/@eelayntris/attention-please')
      .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
  }
}

export default commandHelp
