import { escapeMarkdown, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import cache, { database } from '../helper/cache.js'
import getAllJobs from '../helper/getAllJobs.js'
import { CommandProps } from '../types.js'
import { translate } from '../utils/translation.js'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Cancel check job.')
    .setDescriptionLocalizations({
      'zh-TW': '取消預約結算或預約抽獎',
    })
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('Job ID')
        .setDescriptionLocalizations({
          'zh-TW': '預約 ID',
        })
        .setRequired(true),
    )
    .setContexts(InteractionContextType.Guild),
]

const exec: CommandProps['exec'] = async (interaction) => {
  const clientId = interaction.client.user.id
  const { guildId, guild } = interaction
  if (!interaction.isChatInputCommand() || !clientId || !guildId || !guild) {
    return
  }

  const jobId = interaction.options.getString('id', true)
  const job = cache.jobs[jobId]
  if (!job || job.command.guildId !== guildId) {
    throw new Error('JOB_NOT_FOUND', {
      cause: {
        ALL_JOBS: getAllJobs(clientId, guild),
      },
    })
  }

  await database.ref(`/jobs/${jobId}`).remove()
  return {
    content: translate('cancel.text.cancelJob', { guildId })
      .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
      .replace('{JOB_ID}', jobId),
    embed: {
      description: getAllJobs(clientId, guild),
    },
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
