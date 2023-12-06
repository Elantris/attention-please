import {
  APIEmbed,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  escapeMarkdown,
  Message,
  MessageCreateOptions,
  SlashCommandBuilder,
} from 'discord.js'
import { writeFileSync } from 'fs'
import { DateTime } from 'luxon'
import { join } from 'path'
import {
  CommandProps,
  isInArray,
  JobProps,
  memberStatusLabels,
  MemberStatusType,
  repeatLabels,
  RepeatType,
  ResultProps,
} from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getAllJobs from '../utils/getAllJobs'
import getReactionStatus from '../utils/getReactionStatus'
import parseTime from '../utils/parseTime'
import splitMessage from '../utils/splitMessage'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check reactions count by mentioned members of the message.')
    .setDescriptionLocalizations({
      'zh-TW': '查看一則訊息中被標記的成員是否有按表情回應',
    })
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Link or ID of the target message.')
        .setDescriptionLocalizations({
          'zh-TW': '目標訊息，複製訊息連結或 ID',
        })
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Time in format: YYYY-MM-DD HH:mm. Example: 2023-01-02 03:04')
        .setDescriptionLocalizations({
          'zh-TW': '指定結算時間，格式為 YYYY-MM-DD HH:mm，例如 2023-01-02 03:04',
        }),
    )
    .addStringOption(option =>
      option
        .setName('repeat')
        .setDescription('Set the interval of periodical check command.')
        .setDescriptionLocalizations({ 'zh-TW': '設定重複的結算週期' })
        .addChoices(
          { name: '1 day', name_localizations: { 'zh-TW': '一天（24 小時）' }, value: 'day' },
          { name: '1 week', name_localizations: { 'zh-TW': '一週（7 天）' }, value: 'week' },
          { name: '1 month', name_localizations: { 'zh-TW': '一月（下個月的同一日期）' }, value: 'month' },
          { name: '1 season', name_localizations: { 'zh-TW': '一季（三個月後的同一日期）' }, value: 'season' },
        ),
    )
    .setDMPermission(false),
  new ContextMenuCommandBuilder().setName('check').setType(ApplicationCommandType.Message).setDMPermission(false),
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
    repeat?: RepeatType
    isTimeModified?: boolean
  } = {}

  if (interaction.isChatInputCommand()) {
    options.time = parseTime({ guildId, time: interaction.options.getString('time') })

    options.target = await fetchTargetMessage({
      guild,
      search: interaction.options.getString('target', true),
    })

    const repeat = interaction.options.getString('repeat') || ''
    if (isInArray(repeat, repeatLabels)) {
      options.repeat = repeat
    }
  } else if (interaction.isMessageContextMenuCommand()) {
    if (interaction.targetMessage.inGuild()) {
      options.target = interaction.targetMessage
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
      // 5 minutes
      if (interaction.createdTimestamp - options.time < 300000) {
        options.time = DateTime.now().plus({ minutes: 1 }).startOf('minute').toMillis()
        options.isTimeModified = true
      } else {
        throw new Error('INVALID_CHECK_TIME', {
          cause: {
            TIME: timeFormatter({ time: options.time, guildId, format: 'yyyy-MM-dd HH:mm' }),
            TIMESTAMP: `${Math.floor(options.time / 1000)}`,
          },
        })
      }
    }

    const jobId = `check_${options.target.id}`
    const isDuplicated = !!cache.jobs[jobId]

    if (!isDuplicated) {
      let existedJobsCount = 0
      for (const jobId in cache.jobs) {
        const job = cache.jobs[jobId]
        if (job && job.clientId === clientMember.id && jobId.startsWith('check_') && job.command.guildId === guildId) {
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
      },
      target: {
        messageId: options.target.id,
        channelId: options.target.channel.id,
      },
      retryTimes: 0,
    }
    if (options.repeat) {
      job.repeat = options.repeat
    }
    await database.ref(`/jobs/${jobId}`).set(job)

    return {
      content: translate(isDuplicated ? 'check.text.checkJobUpdated' : 'check.text.checkJobCreated', { guildId })
        .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
        .replace('{JOB_ID}', jobId),
      embed: {
        description: translate('check.text.checkJobDetail', { guildId })
          .replace('{WARNINGS}', options.isTimeModified ? translate('check.text.isTimeModifiedWarning') : '')
          .replace('{CHECK_JOBS}', getAllJobs(clientMember.id, guild, 'check'))
          .trim(),
      },
    }
  }

  return await getCheckResult(options.target)
}

export const getCheckResult: (
  message: Message<true>,
  options?: {
    repeatAt?: number
    retryTimes?: number
  },
) => Promise<ResultProps | void> = async (message, options) => {
  const guildId = message.guild.id
  const checkAt = Date.now()
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

  const checkLength = cache.settings[guildId].length ?? 100
  const fields: APIEmbed['fields'] = []
  const files: MessageCreateOptions['files'] = []
  for (const memberStatus of memberStatusLabels) {
    memberNames[memberStatus].sort((a, b) => a.localeCompare(b))
  }
  if (allMembersCount > checkLength) {
    const filePath = join(__dirname, '../../files/', `check-${message.id}.txt`)
    writeFileSync(
      filePath,
      translate('check.text.checkResultFile', { guildId })
        .replace('{GUILD_NAME}', message.guild.name)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{TIME}', timeFormatter({ time: checkAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${memberNames.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${memberNames.absent.length}`)
        .replace('{LOCKED_COUNT}', `${memberNames.locked.length}`)
        .replace('{IRRELEVANT_COUNT}', `${memberNames.irrelevant.length}`)
        .replace('{LEAVED_COUNT}', `${memberNames.leaved.length}`)
        .replace('{PERCENTAGE}', ((memberNames.reacted.length * 100) / allMembersCount).toFixed(2))
        .replace('{REACTED_MEMBERS}', memberNames.reacted.join('\r\n'))
        .replace('{ABSENT_MEMBERS}', memberNames.absent.join('\r\n'))
        .replace('{LOCKED_MEMBERS}', memberNames.locked.join('\r\n'))
        .replace('{IRRELEVANT_MEMBERS}', memberNames.irrelevant.join('\r\n'))
        .replace('{LEAVED_MEMBERS}', memberNames.leaved.join('\r\n'))
        .trim(),
      'utf8',
    )
    files.push({
      attachment: filePath,
      name: `check-${message.id}.txt`,
    })
  } else {
    for (const memberStatus of memberStatusLabels) {
      if (cache.settings[guildId]?.[memberStatus] === false || !memberNames[memberStatus].length) {
        continue
      }
      splitMessage(memberNames[memberStatus].map(name => escapeMarkdown(name)).join('\n'), { length: 1000 }).forEach(
        content => {
          fields.push({
            name: translate(`check.text.${memberStatus}MembersList`, { guildId }),
            value: content.replace(/\n/g, '、'),
          })
        },
      )
    }
  }

  const warnings: string[] = []
  if ((options?.retryTimes ?? 0) > 1 && memberNames.reacted.length === 0) {
    warnings.push(translate('check.text.jobIsRemoved', { guildId }))
  } else if (options?.repeatAt) {
    warnings.push(
      translate('check.text.newRepeatedJob', { guildId }).replace(
        '{REPEAT_AT}',
        timeFormatter({ time: options.repeatAt, guildId, format: 'yyyy-MM-dd HH:mm' }),
      ),
    )
  }

  return {
    content: translate('check.text.checkResult', { guildId })
      .replace('{REACTED_COUNT}', `${memberNames.reacted.length}`)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{PERCENTAGE}', ((memberNames.reacted.length * 100) / allMembersCount).toFixed(2))
      .trim(),
    embed: {
      description: translate('check.text.checkResultDetail', { guildId })
        .replace('{TIME}', timeFormatter({ time: checkAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{FROM_NOW}', `<t:${Math.floor(checkAt / 1000)}:R>`)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${memberNames.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${memberNames.absent.length}`)
        .replace('{LOCKED_COUNT}', `${memberNames.locked.length}`)
        .replace('{IRRELEVANT_COUNT}', `${memberNames.irrelevant.length}`)
        .replace('{LEAVED_COUNT}', `${memberNames.leaved.length}`)
        .replace('{WARNINGS}', warnings.join('\n'))
        .trim(),
      fields,
    },
    files,
    meta: {
      isReactionEmpty: memberNames.reacted.length === 0,
    },
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
