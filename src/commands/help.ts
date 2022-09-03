import { SlashCommandBuilder } from 'discord.js'
import { CommandProps } from '../types'
import { translate } from '../utils/translation'

const build: CommandProps['build'] = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Attention Please 使用說明')
  .setDescriptionLocalizations({
    'en-US': 'Manuals of Attention Please.',
  })
  .toJSON()

const exec: CommandProps['exec'] = async interaction => {
  const guildId = interaction.guildId
  if (!guildId) {
    return
  }

  return {
    content: translate('help.text.summary', { guildId })
      .replace('{MANUAL}', 'https://hackmd.io/@eelayntris/attention-please')
      .replace('{DISCORD}', 'https://discord.gg/Ctwz4BB'),
  }
}

const command: CommandProps = {
  build,
  exec,
}

export default command
