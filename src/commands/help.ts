import { CommandProps } from '../types'
import { cache } from '../utils/database'

const commandHelp: CommandProps = async (message, { guildId, args }) => {
  return {
    content: ':question: Attention Please 目前指令前綴：`PREFIX`\n<GITHUB>\nJoin eeBots Support DISCORD'
      .replace('PREFIX', cache.settings[guildId]?.prefix || 'ap!')
      .replace('GITHUB', 'https://github.com/Elantris/attention-please')
      .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
  }
}

export default commandHelp
