import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  escapeMarkdown,
  Message,
  SlashCommandBuilder,
} from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, JobProps, MemberStatusType, ResultProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getAllJobs from '../utils/getAllJobs'
import getReactionStatus from '../utils/getReactionStatus'
import parseTime from '../utils/parseTime'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('raffle')
    .setDescription('Random pick reacted and mentioned members from the message.')
    .setDescriptionLocalizations({
      'zh-TW': '從一則訊息中被標記的人當中抽出有點選表情回應的成員',
    })
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Link or ID of target message.')
        .setDescriptionLocalizations({
          'zh-TW': '目標訊息，複製訊息連結或 ID',
        })
        .setRequired(true),
    )
    .addIntegerOption(option =>
      option
        .setName('count')
        .setDescription('The count of picked members.')
        .setDescriptionLocalizations({
          'zh-TW': '中獎人數',
        })
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Time in format: YYYY-MM-DD HH:mm. Example: 2022-09-01 01:23')
        .setDescriptionLocalizations({
          'zh-TW': '指定結算時間，格式為 YYYY-MM-DD HH:mm，例如 2022-09-01 01:23',
        }),
    )
    .setDMPermission(false),
  new ContextMenuCommandBuilder().setName('raffle').setType(ApplicationCommandType.Message).setDMPermission(false),
]

const exec: CommandProps['exec'] = async interaction => {
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
        if (job && job.clientId === clientMember.id && jobId.startsWith('raffle_') && job.command.guildId === guildId) {
          existedJobsCount += 1
        }
      }
      if (existedJobsCount > 2) {
        throw new Error('MAX_JOB_LIMIT', {
          cause: {
            ALL_JOBS: getAllJobs(clientMember.id, guild, 'all'),
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
          getAllJobs(clientMember.id, guild, 'raffle'),
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
  const reactionStatus = await getReactionStatus(message)
  const memberNames: Record<MemberStatusType, string[]> = {
    reacted: [],
    absent: [],
    locked: [],
    irrelevant: [],
    leaved: [],
  }
  for (const memberId in reactionStatus) {
    memberNames[reactionStatus[memberId].status].push(reactionStatus[memberId].name)
  }
  const allMembersCount = memberNames.reacted.length + memberNames.absent.length + memberNames.locked.length
  if (allMembersCount === 0) {
    throw new Error('NO_MENTIONED_MEMBER', {
      cause: {
        MESSAGE_LINK: message.url,
      },
    })
  }

  const reactedMemberCount = memberNames.reacted.length
  if (reactedMemberCount === 0) {
    return {
      content: translate('error.text.NO_RAFFLE_PARTICIPANT', { guildId }),
      embed: {
        description: translate('error.help.NO_RAFFLE_PARTICIPANT', { guildId }),
      },
    }
  }

  for (let i = 0; i < reactedMemberCount - 1; i++) {
    const choose = Math.floor(Math.random() * i)
    ;[memberNames.reacted[i], memberNames.reacted[choose]] = [memberNames.reacted[choose], memberNames.reacted[i]]
  }
  const raffleCount = options?.count || 100
  const luckyMemberNames = memberNames.reacted.splice(0, raffleCount)

  const filePath = join(__dirname, '../../files/', `raffle-${message.id}.txt`)
  writeFileSync(
    filePath,
    translate('raffle.text.raffleResultFile', { guildId })
      .replace('{GUILD_NAME}', message.guild.name)
      .replace('{CHANNEL_NAME}', message.channel.name)
      .replace('{TIME}', timeFormatter({ time: raffleAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
      .replace('{MESSAGE_URL}', message.url)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
      .replace('{LUCKY_COUNT}', `${luckyMemberNames.length}`)
      .replace('{MISSED_COUNT}', `${memberNames.reacted.length}`)
      .replace('{ABSENT_COUNT}', `${memberNames.absent.length}`)
      .replace('{LOCKED_COUNT}', `${memberNames.locked.length}`)
      .replace('{IRRELEVANT_COUNT}', `${memberNames.irrelevant.length}`)
      .replace('{LEAVED_COUNT}', `${memberNames.leaved.length}`)
      .replace('{PERCENTAGE}', ((reactedMemberCount * 100) / allMembersCount).toFixed(2))
      .replace('{LUCKY_MEMBERS}', luckyMemberNames.map((v, i) => `${i + 1}. ${v}`).join('\n'))
      .replace('{REACTED_MEMBERS}', memberNames.reacted.map((v, i) => `${i + 1}. ${v}`).join('\n'))
      .replace('{ABSENT_MEMBERS}', memberNames.absent.join('\r\n'))
      .replace('{LOCKED_MEMBERS}', memberNames.locked.join('\r\n'))
      .replace('{IRRELEVANT_MEMBERS}', memberNames.irrelevant.join('\r\n'))
      .replace('{LEAVED_MEMBERS}', memberNames.leaved.join('\r\n'))
      .trim(),
    'utf8',
  )

  return {
    content: translate('raffle.text.raffleResult', { guildId })
      .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{PERCENTAGE}', ((reactedMemberCount * 100) / allMembersCount).toFixed(2))
      .trim(),
    embed: {
      description: translate('raffle.text.raffleResultDetail', { guildId })
        .replace('{TIME}', timeFormatter({ time: raffleAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{FROM_NOW}', `<t:${Math.floor(raffleAt / 1000)}:R>`)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{MESSAGE_URL}', message.url)
        .replace('{RAFFLE_COUNT}', `${options?.count ?? 100}`)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
        .replace('{LUCKY_COUNT}', `${luckyMemberNames.length}`)
        .replace('{MISSED_COUNT}', `${memberNames.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${memberNames.absent.length}`)
        .replace('{LOCKED_COUNT}', `${memberNames.locked.length}`)
        .replace('{IRRELEVANT_COUNT}', `${memberNames.irrelevant.length}`)
        .replace('{LEAVED_COUNT}', `${memberNames.leaved.length}`)
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
