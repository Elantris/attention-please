import { CommandProps } from '../types'
import { cache } from '../utils/database'

const commandHelp: CommandProps = async (message, { guildId, args }) => {
  return {
    content: ':question: Attention Please\n指令前綴：`PREFIX`\n說明文件：<GITHUB>\n開發群組：DISCORD'
      .replace('PREFIX', cache.settings[guildId]?.prefix || 'ap!')
      .replace('GITHUB', 'https://github.com/Elantris/attention-please')
      .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
  }
}

export default commandHelp
