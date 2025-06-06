import {
  ContextMenuCommandBuilder,
  escapeMarkdown,
  InteractionContextType,
  Message,
  SlashCommandBuilder,
} from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import cache, { database } from '../helper/cache.js'
import getAllJobs from '../helper/getAllJobs.js'
import parseTime from '../helper/parseTime.js'
import { CommandProps, JobProps, reactionStatusLabels, ResultProps } from '../types.js'
import fetchTargetMessage from '../utils/fetchTargetMessage.js'
import getReactionStatusGroup from '../utils/getReactionStatusGroup.js'
import timeFormatter from '../utils/timeFormatter.js'
import toPercentage from '../utils/toPercentage.js'
import { translate } from '../utils/translation.js'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('raffle')
    .setDescription('Random pick reacted and mentioned members from the message.')
    .setDescriptionLocalizations({
      'zh-TW': '從一則訊息中被標記的人當中抽出有點選表情回應的成員',
    })
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('Link or ID of target message.')
        .setDescriptionLocalizations({
          'zh-TW': '目標訊息，複製訊息連結或 ID',
        })
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('The count of picked members.')
        .setDescriptionLocalizations({
          'zh-TW': '中獎人數',
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('time').setDescription('Time in format: YYYY-MM-DD HH:mm').setDescriptionLocalizations({
        'zh-TW': '指定結算時間，格式為 YYYY-MM-DD HH:mm',
      }),
    )
    .setContexts(InteractionContextType.Guild),
  new ContextMenuCommandBuilder().setName('raffle').setType(3).setContexts(InteractionContextType.Guild),
]

const exec: CommandProps['exec'] = async (interaction) => {
  const { guild, guildId, channel } = interaction
  const clientMember = guild?.members.cache.get(interaction.client.user.id)
  if (!guildId || !guild || !channel || channel.isDMBased() || !clientMember) {
    return
  }

  const options: {
    target?: Message<true>
    time?: number
    count?: number
  } = {}

  if (interaction.isChatInputCommand()) {
    options.time = parseTime({ guildId, time: interaction.options.getString('time') })

    options.count = interaction.options.getInteger('count', true)
    if (options.count < 1) {
      throw new Error('INVALID_RAFFLE_COUNT')
    }

    options.target = await fetchTargetMessage({
      guild,
      search: interaction.options.getString('target', true),
    })
  } else if (interaction.isMessageContextMenuCommand()) {
    if (interaction.targetMessage.inGuild()) {
      options.target = interaction.targetMessage
      options.count = 100
    }
  }

  if (!options.target) {
    return
  }

  if (options.time) {
    if (!channel.permissionsFor(clientMember).has('SendMessages')) {
      throw new Error('NO_PERMISSION_IN_CHANNEL', {
        cause: {
          CHANNEL_ID: channel.id,
        },
      })
    }

    if (options.time < interaction.createdTimestamp) {
      throw new Error('INVALID_RAFFLE_TIME', {
        cause: {
          TIME: timeFormatter({ time: options.time, guildId, format: 'yyyy-MM-dd HH:mm' }),
          TIMESTAMP: `${Math.floor(options.time / 1000)}`,
        },
      })
    }

    const jobId = `raffle_${options.target.id}`
    const isDuplicated = !!cache.jobs[jobId]

    if (!isDuplicated) {
      let existedJobsCount = 0
      for (const jobId in cache.jobs) {
        const job = cache.jobs[jobId]
        if (job && job.clientId === clientMember.id && job.command.guildId === guildId) {
          existedJobsCount += 1
        }
      }
      if (existedJobsCount > 2) {
        throw new Error('MAX_JOB_LIMIT', {
          cause: {
            ALL_JOBS: getAllJobs(clientMember.id, guild),
          },
        })
      }
    }

    const job: JobProps = {
      clientId: clientMember.id,
      executeAt: options.time,
      command: {
        guildId,
        channelId: channel.id,
        userId: interaction.user.id,
        raffleCount: options.count,
      },
      target: {
        messageId: options.target.id,
        channelId: options.target.channel.id,
      },
      retryTimes: 0,
    }
    await database.ref(`/jobs/${jobId}`).set(job)

    return {
      content: translate(isDuplicated ? 'raffle.text.raffleJobUpdated' : 'raffle.text.raffleJobCreated', { guildId })
        .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
        .replace('{JOB_ID}', jobId),
      embed: {
        description: translate('raffle.text.raffleJobDetail', { guildId }).replace(
          '{RAFFLE_JOBS}',
          getAllJobs(clientMember.id, guild),
        ),
      },
    }
  }

  return getRaffleResult(options.target, { count: options.count })
}

export const getRaffleResult: (
  message: Message<true>,
  options?: {
    count?: number
  },
) => Promise<ResultProps | void> = async (message, options) => {
  const guildId = message.guild.id
  const raffleAt = Date.now()

  const reactionStatusGroup = await getReactionStatusGroup(message)
  const targetMembersCount =
    reactionStatusGroup.reacted.length + reactionStatusGroup.absent.length + reactionStatusGroup.locked.length
  const reactedMemberCount = reactionStatusGroup.reacted.length

  for (const reactionStatus of reactionStatusLabels) {
    for (let i = reactionStatusGroup[reactionStatus].length - 1; i !== -1; i--) {
      const choose = Math.floor(Math.random() * (i + 1))
      ;[reactionStatusGroup[reactionStatus][i], reactionStatusGroup[reactionStatus][choose]] = [
        reactionStatusGroup[reactionStatus][choose],
        reactionStatusGroup[reactionStatus][i],
      ]
    }
  }

  const raffleCount = options?.count || 100
  const luckyMemberNames = reactionStatusGroup.reacted.splice(0, raffleCount)

  const filePath = join(import.meta.dirname, '../../files/', `raffle-${message.id}.txt`)
  writeFileSync(
    filePath,
    translate('raffle.text.raffleResultFile', { guildId })
      .replace('{GUILD_NAME}', message.guild.name)
      .replace('{CHANNEL_NAME}', message.channel.name)
      .replace('{TIME}', timeFormatter({ time: raffleAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
      .replace('{MESSAGE_URL}', message.url)
      .replace('{ALL_COUNT}', `${targetMembersCount}`)
      .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
      .replace('{LUCKY_COUNT}', `${luckyMemberNames.length}`)
      .replace('{MISSED_COUNT}', `${reactionStatusGroup.reacted.length}`)
      .replace('{ABSENT_COUNT}', `${reactionStatusGroup.absent.length}`)
      .replace('{LOCKED_COUNT}', `${reactionStatusGroup.locked.length}`)
      .replace('{IRRELEVANT_COUNT}', `${reactionStatusGroup.irrelevant.length}`)
      .replace('{LEAVED_COUNT}', `${reactionStatusGroup.leaved.length}`)
      .replace('{PERCENTAGE}', toPercentage(reactedMemberCount / targetMembersCount))
      .replace('{LUCKY_MEMBERS}', luckyMemberNames.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{REACTED_MEMBERS}', reactionStatusGroup.reacted.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{ABSENT_MEMBERS}', reactionStatusGroup.absent.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{LOCKED_MEMBERS}', reactionStatusGroup.locked.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{IRRELEVANT_MEMBERS}', reactionStatusGroup.irrelevant.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{LEAVED_MEMBERS}', reactionStatusGroup.leaved.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .trim(),
    'utf8',
  )

  return {
    content: translate('raffle.text.raffleResult', { guildId })
      .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
      .replace('{ALL_COUNT}', `${targetMembersCount}`)
      .replace('{PERCENTAGE}', toPercentage(reactedMemberCount / targetMembersCount))
      .trim(),
    embed: {
      description: translate('raffle.text.raffleResultDetail', { guildId })
        .replace('{TIME}', timeFormatter({ time: raffleAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{FROM_NOW}', `<t:${Math.floor(raffleAt / 1000)}:R>`)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{MESSAGE_URL}', message.url)
        .replace('{RAFFLE_COUNT}', `${options?.count ?? 100}`)
        .replace('{ALL_COUNT}', `${targetMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
        .replace('{LUCKY_COUNT}', `${luckyMemberNames.length}`)
        .replace('{MISSED_COUNT}', `${reactionStatusGroup.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${reactionStatusGroup.absent.length}`)
        .replace('{LOCKED_COUNT}', `${reactionStatusGroup.locked.length}`)
        .replace('{IRRELEVANT_COUNT}', `${reactionStatusGroup.irrelevant.length}`)
        .replace('{LEAVED_COUNT}', `${reactionStatusGroup.leaved.length}`)
        .trim(),
    },
    files: [
      {
        attachment: filePath,
        name: `raffle-${message.id}.txt`,
      },
    ],
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
