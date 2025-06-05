import {
  APIEmbed,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  escapeMarkdown,
  InteractionContextType,
  Message,
  SlashCommandBuilder,
} from 'discord.js'
import { writeFileSync } from 'fs'
import { DateTime } from 'luxon'
import { join } from 'path'
import cache, { database } from '../helper/cache.js'
import getAllJobs from '../helper/getAllJobs.js'
import parseTime from '../helper/parseTime.js'
import {
  CommandProps,
  isInArray,
  JobProps,
  reactionStatusLabels,
  repeatLabels,
  RepeatType,
  ResultProps,
} from '../types.js'
import fetchTargetMessage from '../utils/fetchTargetMessage.js'
import getReactionStatus from '../utils/getReactionStatusGroup.js'
import splitMessage from '../utils/splitMessage.js'
import timeFormatter from '../utils/timeFormatter.js'
import toPercentage from '../utils/toPercentage.js'
import { translate } from '../utils/translation.js'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check reactions count by mentioned members of the message.')
    .setDescriptionLocalizations({
      'zh-TW': '查看一則訊息中被標記的成員是否有按表情回應',
    })
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('Target Message Link.')
        .setDescriptionLocalizations({
          'zh-TW': '請貼上目標訊息連結',
        })
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('time').setDescription('Time in format: YYYY-MM-DD HH:mm').setDescriptionLocalizations({
        'zh-TW': '指定結算時間，格式為 YYYY-MM-DD HH:mm',
      }),
    )
    .addStringOption((option) =>
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
    .setContexts(InteractionContextType.Guild),
  new ContextMenuCommandBuilder()
    .setName('check')
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild),
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
          .replace('{WARNINGS}', options.isTimeModified ? translate('check.text.jobTimeModifiedWarning') : '')
          .replace('{CHECK_JOBS}', getAllJobs(clientMember.id, guild))
          .trim(),
      },
    }
  }

  return await getCheckResult(options.target)
}

export const getCheckResult: (message: Message<true>) => Promise<ResultProps | void> = async (message) => {
  const guildId = message.guild.id
  const checkAt = Date.now()
  const reactionStatusGroup = await getReactionStatus(message)
  const allMembersCount =
    reactionStatusGroup.reacted.length + reactionStatusGroup.absent.length + reactionStatusGroup.locked.length

  const checkLength = cache.settings[guildId].length ?? 100
  const fields: APIEmbed['fields'] = []
  const files: {
    attachment: string
    name: string
  }[] = []
  for (const reactionStatus of reactionStatusLabels) {
    reactionStatusGroup[reactionStatus].sort((a, b) => a.localeCompare(b))
  }
  if (allMembersCount > checkLength) {
    const filePath = join(import.meta.dirname, '../../files/', `check-${message.id}.txt`)
    writeFileSync(
      filePath,
      translate('check.text.checkResultFile', { guildId })
        .replace('{GUILD_NAME}', message.guild.name)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{TIME}', timeFormatter({ time: checkAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactionStatusGroup.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${reactionStatusGroup.absent.length}`)
        .replace('{LOCKED_COUNT}', `${reactionStatusGroup.locked.length}`)
        .replace('{IRRELEVANT_COUNT}', `${reactionStatusGroup.irrelevant.length}`)
        .replace('{LEAVED_COUNT}', `${reactionStatusGroup.leaved.length}`)
        .replace('{PERCENTAGE}', toPercentage(reactionStatusGroup.reacted.length / allMembersCount))
        .replace('{REACTED_MEMBERS}', reactionStatusGroup.reacted.join('\r\n'))
        .replace('{ABSENT_MEMBERS}', reactionStatusGroup.absent.join('\r\n'))
        .replace('{LOCKED_MEMBERS}', reactionStatusGroup.locked.join('\r\n'))
        .replace('{IRRELEVANT_MEMBERS}', reactionStatusGroup.irrelevant.join('\r\n'))
        .replace('{LEAVED_MEMBERS}', reactionStatusGroup.leaved.join('\r\n'))
        .trim(),
      'utf8',
    )
    files.push({
      attachment: filePath,
      name: `check-${message.id}.txt`,
    })
  } else {
    for (const reactionStatus of reactionStatusLabels) {
      if (cache.settings[guildId]?.[reactionStatus] === false || !reactionStatusGroup[reactionStatus].length) {
        continue
      }
      splitMessage(reactionStatusGroup[reactionStatus].map((name) => escapeMarkdown(name)).join('\n'), {
        length: 1000,
      }).forEach((content) => {
        fields.push({
          name: translate(`check.text.${reactionStatus}MembersList`, { guildId }),
          value: content.replace(/\n/g, '、'),
        })
      })
    }
  }

  return {
    content: translate('check.text.checkResult', { guildId })
      .replace('{REACTED_COUNT}', `${reactionStatusGroup.reacted.length}`)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{PERCENTAGE}', toPercentage(reactionStatusGroup.reacted.length / allMembersCount))
      .trim(),
    embed: {
      description: translate('check.text.checkResultDetail', { guildId })
        .replace('{TIME}', timeFormatter({ time: checkAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{FROM_NOW}', `<t:${Math.floor(checkAt / 1000)}:R>`)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactionStatusGroup.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${reactionStatusGroup.absent.length}`)
        .replace('{LOCKED_COUNT}', `${reactionStatusGroup.locked.length}`)
        .replace('{IRRELEVANT_COUNT}', `${reactionStatusGroup.irrelevant.length}`)
        .replace('{LEAVED_COUNT}', `${reactionStatusGroup.leaved.length}`)
        .trim(),
      fields,
    },
    files,
    meta: {
      isReactionEmpty: reactionStatusGroup.reacted.length === 0,
    },
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
