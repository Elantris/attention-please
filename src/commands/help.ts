import { CommandProps } from '../types'
import { cache } from '../utils/database'

const commandHelp: CommandProps = async (message, { guildId, args }) => {
  return {
    content: ':question: Attention Please 目前伺服器指令前綴：`PREFIX`\n<https://github.com/Elantris/attention-please>'.replace(
      'PREFIX',
      cache.settings[guildId]?.prefix || 'ap!',
    ),
  }
}

export default commandHelp
