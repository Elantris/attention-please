import { escapeMarkdown, SlashCommandBuilder } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import getAllJobs from '../utils/getAllJobs'
import { translate } from '../utils/translation'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Cancel check job.')
    .setDescriptionLocalizations({
      'zh-TW': '取消預約結算',
    })
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('Job ID')
        .setDescriptionLocalizations({
          'zh-TW': '預約 ID',
        })
        .setRequired(true),
    )
    .toJSON(),
]

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
    throw new Error('JOB_NOT_FOUND', {
      cause: {
        ALL_JOBS: getAllJobs(clientId, guild, 'all'),
      },
    })
  }

  await database.ref(`/jobs/${jobId}`).remove()
  return {
    content: translate('cancel.text.cancelJob', { guildId })
      .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
      .replace('{JOB_ID}', jobId),
    embed: {
      description: getAllJobs(clientId, guild, 'all'),
    },
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
