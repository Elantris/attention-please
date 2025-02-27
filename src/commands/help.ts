import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { CommandProps } from '../types.js'
import { translate } from '../utils/translation.js'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Manuals of Attention Please.')
    .setDescriptionLocalizations({
      'zh-TW': 'Attention Please 使用說明',
    })
    .setContexts(InteractionContextType.Guild),
]

const exec: CommandProps['exec'] = async (interaction) => {
  const { guildId } = interaction
  if (!guildId) {
    return
  }

  return {
    content: translate('help.text.summary', { guildId }),
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
