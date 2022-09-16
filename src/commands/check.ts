import { APIEmbed, ChannelType, escapeMarkdown, Message, MessageOptions, SlashCommandBuilder } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, JobProps, ResultProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getAllJobs from '../utils/getAllJobs'
import getReactionStatus from '../utils/getReactionStatus'
import parseTime from '../utils/parseTime'
import splitMessage from '../utils/splitMessage'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const build: CommandProps['build'] = new SlashCommandBuilder()
  .setName('check')
  .setDescription('查看一則訊息中被標記的成員是否有按表情回應')
  .setDescriptionLocalizations({
    'en-US': 'Check reactions of mentioned members in a message.',
  })
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('目標訊息，複製訊息連結或 ID')
      .setDescriptionLocalizations({
        'en-US': 'Link or ID of target message.',
      })
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName('time')
      .setDescription('指定結算時間，格式為 YYYY-MM-DD HH:mm，例如 2022-09-01 01:23')
      .setDescriptionLocalizations({
        'en-US': 'Time in format: YYYY-MM-DD HH:mm. Example: 2022-09-01 01:23',
      }),
  )
  .toJSON()

const exec: CommandProps['exec'] = async interaction => {
  const clientId = interaction.client.user?.id
  const guildId = interaction.guildId
  const guild = interaction.guild
  if (!clientId || !guildId || !guild || !interaction.channelId) {
    return
  }

  const target: {
    message?: Message
    time?: number
  } = {}

  if (interaction.isChatInputCommand()) {
    const messageResult = await fetchTargetMessage({
      guild: interaction.guild,
      search: interaction.options.getString('message', true),
    })
    if (messageResult.response) {
      return messageResult.response
    }

    const timeResult = parseTime({ guildId, time: interaction.options.getString('time') })
    if (timeResult.response) {
      return timeResult.response
    }

    target.message = messageResult.message
    target.time = timeResult.time
  } else if (interaction.isMessageContextMenuCommand()) {
    target.message = interaction.targetMessage
  }

  if (!target.message) {
    return
  }

  if (target.time) {
    if (target.time < interaction.createdTimestamp) {
      return await getCheckResult(target.message, { passedCheckAt: target.time })
    }

    const jobId = `check_${target.message.id}`
    const isDuplicated = !!cache.jobs[jobId]

    if (!isDuplicated) {
      let existedJobsCount = 0
      for (const jobId in cache.jobs) {
        const job = cache.jobs[jobId]
        if (job && job.clientId === clientId && jobId.startsWith('check_') && job.command.guildId === guildId) {
          existedJobsCount += 1
        }
      }
      if (existedJobsCount > 4) {
        return {
          content: translate('check.error.checkJobLimit', { guildId }),
          embed: {
            description: translate('check.error.checkJobLimitHelp', { guildId }).replace(
              '{CHECK_JOBS}',
              getAllJobs(clientId, guild, 'check'),
            ),
          },
        }
      }
    }

    const job: JobProps = {
      clientId: interaction.client.user?.id || '',
      executeAt: target.time,
      command: {
        guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
      },
      target: {
        messageId: target.message.id,
        channelId: target.message.channel.id,
      },
      retryTimes: 0,
    }
    await database.ref(`/jobs/${jobId}`).set(job)

    return {
      content: (isDuplicated
        ? translate('check.text.checkJobUpdated', { guildId })
        : translate('check.text.checkJobCreated', { guildId })
      )
        .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
        .replace('{JOB_ID}', jobId),
      embed: {
        description: translate('check.text.checkJobDescription', { guildId })
          .replace('{TIME}', timeFormatter({ time: target.time, guildId, format: 'yyyy-MM-dd HH:mm' }))
          .replace('{FROM_NOW}', `<t:${Math.floor(target.time / 1000)}:R>`)
          .replace('{TARGET_URL}', target.message.url)
          .replace('{JOB_ID}', jobId)
          .replace('{CHECK_JOBS}', getAllJobs(clientId, guild, 'check')),
      },
    }
  }

  return await getCheckResult(target.message)
}

export const getCheckResult: (
  message: Message,
  options?: {
    passedCheckAt?: number
  },
) => Promise<ResultProps | void> = async (message, options) => {
  if (message.channel.type === ChannelType.DM || !message.guild) {
    return
  }

  const guildId = message.guild.id
  const checkAt = Date.now()
  const mentionedMembers = await getReactionStatus(message)
  const allMembersCount = Object.keys(mentionedMembers).length

  if (allMembersCount === 0) {
    return {
      content: translate('system.error.noMentionedMember', { guildId }),
      embed: {
        description: translate('system.error.noMentionedMemberHelp', { guildId }).replace(
          '{MESSAGE_LINK}',
          message.url,
        ),
      },
    }
  }

  const reactedMemberNames: string[] = []
  const absentMemberNames: string[] = []
  const lockedMemberNames: string[] = []
  for (const memberId in mentionedMembers) {
    if (mentionedMembers[memberId].status === 'reacted') {
      reactedMemberNames.push(mentionedMembers[memberId].name)
    } else if (mentionedMembers[memberId].status === 'absent') {
      absentMemberNames.push(mentionedMembers[memberId].name)
    } else if (mentionedMembers[memberId].status === 'locked') {
      lockedMemberNames.push(mentionedMembers[memberId].name)
    }
  }

  reactedMemberNames.sort((a, b) => a.localeCompare(b))
  absentMemberNames.sort((a, b) => a.localeCompare(b))
  lockedMemberNames.sort((a, b) => a.localeCompare(b))

  const fields: APIEmbed['fields'] = []
  const files: MessageOptions['files'] = []
  if (allMembersCount > 200) {
    const filePath = join(__dirname, '../../files/', `${message.id}.txt`)
    writeFileSync(
      filePath,
      translate('check.text.checkResultFile', { guildId })
        .replace('{GUILD_NAME}', message.guild.name)
        .replace('{CHANNEL_NAME}', message.channel.name)
        .replace('{TIME}', timeFormatter({ time: checkAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactedMemberNames.length}`)
        .replace('{ABSENT_COUNT}', `${absentMemberNames.length}`)
        .replace('{LOCKED_COUNT}', `${lockedMemberNames.length}`)
        .replace('{PERCENTAGE}', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
        .replace('{REACTED_MEMBERS}', reactedMemberNames.join('\r\n'))
        .replace('{ABSENT_MEMBERS}', absentMemberNames.join('\r\n'))
        .replace('{LOCKED_MEMBERS}', lockedMemberNames.join('\r\n')),
      { encoding: 'utf8' },
    )
    files.push({
      attachment: filePath,
      name: `${message.id}.txt`,
    })
  } else {
    cache.settings[guildId]?.reacted !== false &&
      reactedMemberNames.length &&
      splitMessage(reactedMemberNames.map(name => escapeMarkdown(name.slice(0, 16))).join('\n'), {
        length: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: translate('check.text.reactedMembersList', { guildId }).replace('{PAGE}', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
    cache.settings[guildId]?.absent !== false &&
      absentMemberNames.length &&
      splitMessage(absentMemberNames.map(name => escapeMarkdown(name.slice(0, 16))).join('\n'), {
        length: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: translate('check.text.absentMembersList', { guildId }).replace('{PAGE}', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
    cache.settings[guildId]?.locked !== false &&
      lockedMemberNames.length &&
      splitMessage(lockedMemberNames.map(name => escapeMarkdown(name.slice(0, 16))).join('\n'), {
        length: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: translate('check.text.lockedMembersList', { guildId }).replace('{PAGE}', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
  }

  const warnings: string[] = []
  if (lockedMemberNames.length) {
    warnings.push(
      translate('check.text.lockedMembersWarning', { guildId }).replace('{COUNT}', `${lockedMemberNames.length}`),
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
      .replace('{REACTED_COUNT}', `${reactedMemberNames.length}`)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{PERCENTAGE}', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
      .trim(),
    embed: {
      description: translate('check.text.checkResultDescription', { guildId })
        .replace('{TIME}', timeFormatter({ time: checkAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{FROM_NOW}', `<t:${Math.floor(checkAt / 1000)}:R>`)
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactedMemberNames.length}`)
        .replace('{ABSENT_COUNT}', `${absentMemberNames.length}`)
        .replace('{WARNINGS}', warnings.join('\n'))
        .trim(),
      fields,
    },
    files,
  }
}

const command: CommandProps = {
  build,
  exec,
}

export default command
