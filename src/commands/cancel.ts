import { escapeMarkdown, SlashCommandBuilder } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import getAllJobs from '../utils/getAllJobs'
import { translate } from '../utils/translation'

const build: CommandProps['build'] = new SlashCommandBuilder()
  .setName('cancel')
  .setDescription('取消預約結算')
  .setDescriptionLocalizations({
    'en-US': 'Cancel check job.',
  })
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('預約結算 ID')
      .setDescriptionLocalizations({
        'en-US': 'Check job ID.',
      })
      .setRequired(true),
  )
  .toJSON()

const exec: CommandProps['exec'] = async interaction => {
  const clientId = interaction.client.user?.id
  const guildId = interaction.guildId
  const guild = interaction.guild
  if (!interaction.isChatInputCommand() || !clientId || !guildId || !guild) {
    return
  }

  const jobId = interaction.options.getString('id', true)
  const job = cache.jobs[jobId]
  if (!job) {
    return {
      content: translate('cancel.error.jobNotFound', { guildId }),
      embed: {
        description: getAllJobs(clientId, guild, 'check'),
      },
    }
  }

  await database.ref(`/jobs/${jobId}`).remove()
  return {
    content: translate('cancel.text.cancelJob', { guildId })
      .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
      .replace('{JOB_ID}', jobId),
    embed: {
      description: getAllJobs(clientId, guild, 'check'),
    },
  }
}

const command: CommandProps = {
  build,
  exec,
}

export default command
