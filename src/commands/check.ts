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
import { join } from 'path'
import { CommandProps, JobProps, MemberStatus, memberStatusLabels, ResultProps } from '../types'
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
        .setDescription('Time in format: YYYY-MM-DD HH:mm. Example: 2022-09-01 01:23')
        .setDescriptionLocalizations({
          'zh-TW': '指定結算時間，格式為 YYYY-MM-DD HH:mm，例如 2022-09-01 01:23',
        }),
    )
    .toJSON(),
  new ContextMenuCommandBuilder().setName('check').setType(ApplicationCommandType.Message),
]

const exec: CommandProps['exec'] = async interaction => {
  const { guild, guildId } = interaction
  const clientMember = guild?.members.cache.get(interaction.client.user.id)
  if (!guildId || !guild || !clientMember || !interaction.channelId) {
    return
  }

  const options: {
    target?: Message<true>
    time?: number
  } = {}

  if (interaction.isChatInputCommand()) {
    options.time = parseTime({ guildId, time: interaction.options.getString('time') })
    options.target = await fetchTargetMessage({
      guild,
      search: interaction.options.getString('target', true),
    })
  } else if (interaction.isMessageContextMenuCommand()) {
    if (interaction.targetMessage.inGuild()) {
      options.target = interaction.targetMessage
    }
  }

  if (!options.target) {
    return
  }

  if (options.time) {
    if (!options.target.channel.permissionsFor(clientMember).has('SendMessages')) {
      throw new Error('NO_PERMISSION_IN_CHANNEL', {
        cause: {
          CHANNEL_ID: options.target.channelId,
          PERMISSIONS: `1. ${translate('permission.label.SendMessages', { guildId })}`,
        },
      })
    }

    if (options.time < interaction.createdTimestamp) {
      return await getCheckResult(options.target, { passedCheckAt: options.time })
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
      if (existedJobsCount > 4) {
        throw new Error('CHECK_JOB_LIMIT', {
          cause: {
            CHECK_JOBS: getAllJobs(clientMember.id, guild, 'check'),
          },
        })
      }
    }

    const job: JobProps = {
      clientId: interaction.client.user?.id || '',
      executeAt: options.time,
      command: {
        guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
      },
      target: {
        messageId: options.target.id,
        channelId: options.target.channel.id,
      },
      retryTimes: 0,
    }
    await database.ref(`/jobs/${jobId}`).set(job)

    return {
      content: translate(isDuplicated ? 'check.text.checkJobUpdated' : 'check.text.checkJobCreated', { guildId })
        .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
        .replace('{JOB_ID}', jobId),
      embed: {
        description: translate('check.text.checkJobDetail', { guildId })
          .replace('{JOB_ID}', jobId)
          .replace('{TIME}', timeFormatter({ time: options.time, guildId, format: 'yyyy-MM-dd HH:mm' }))
          .replace('{FROM_NOW}', `<t:${Math.floor(options.time / 1000)}:R>`)
          .replace('{TARGET_URL}', options.target.url)
          .replace('{CHECK_JOBS}', getAllJobs(clientMember.id, guild, 'check')),
      },
    }
  }

  return await getCheckResult(options.target)
}

export const getCheckResult: (
  message: Message<true>,
  options?: {
    passedCheckAt?: number
  },
) => Promise<ResultProps | void> = async (message, options) => {
  const guildId = message.guild.id
  const checkAt = Date.now()
  const reactionStatus = await getReactionStatus(message)
  const memberNames: Record<MemberStatus, string[]> = {
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
  for (const status of memberStatusLabels) {
    memberNames[status].sort((a, b) => a.localeCompare(b))
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
        .replace('{LEAVED_MEMBERS}', memberNames.leaved.join('\r\n')),
      { encoding: 'utf8' },
    )
    files.push({
      attachment: filePath,
      name: `check-${message.id}.txt`,
    })
  } else {
    for (const memberStatus of memberStatusLabels) {
      if (cache.settings[guildId]?.[status] === false || !memberNames[memberStatus].length) {
        continue
      }
      splitMessage(memberNames[memberStatus].map(name => escapeMarkdown(name)).join('\n'), { length: 1000 }).forEach(
        (content, index) => {
          fields.push({
            name: translate(`check.text.${status}MembersList`, { guildId }).replace('{PAGE}', `${index + 1}`),
            value: content.replace(/\n/g, '、'),
          })
        },
      )
    }
  }

  const warnings: string[] = []
  if (memberNames.locked.length && cache.settings[guildId].locked) {
    warnings.push(
      translate('check.text.lockedMembersWarning', { guildId }).replace('{COUNT}', `${memberNames.locked.length}`),
    )
  }
  if (memberNames.irrelevant.length && cache.settings[guildId].irrelevant) {
    warnings.push(
      translate('check.text.irrelevantMembersWarning', { guildId }).replace(
        '{COUNT}',
        `${memberNames.irrelevant.length}`,
      ),
    )
  }
  if (memberNames.leaved.length && cache.settings[guildId].leaved) {
    warnings.push(
      translate('check.text.leavedMembersWarning', { guildId }).replace('{COUNT}', `${memberNames.leaved.length}`),
    )
  }
  if (options?.passedCheckAt) {
    warnings.push(
      translate('check.text.checkTimePassedWarning', { guildId }).replace(
        '{TIMESTAMP}',
        `${Math.floor(options.passedCheckAt / 1000)}`,
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
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${memberNames.reacted.length}`)
        .replace('{ABSENT_COUNT}', `${memberNames.absent.length}`)
        .replace('{WARNINGS}', warnings.join('\n'))
        .trim(),
      fields,
    },
    files,
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
