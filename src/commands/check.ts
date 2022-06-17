import { EmbedFieldData, FileOptions, Message, Util } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, CommandResultProps, JobProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getReactionStatus from '../utils/getReactionStatus'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const commandCheck: CommandProps = async ({ message, guildId, args }) => {
  const { targetMessage, time, response } = await fetchTargetMessage({ message, guildId, args })
  if (!targetMessage?.guild || response) {
    return {
      response,
    }
  }

  if (time) {
    if (time < message.createdTimestamp) {
      return await makeCheckLists(targetMessage, { passedCheckAt: time })
    }

    let existedJobsCount = 0
    for (const jobId in cache.jobs) {
      if (cache.jobs[jobId] && cache.jobs[jobId]?.command.guildId === guildId) {
        existedJobsCount += 1
      }
    }
    if (existedJobsCount > 8) {
      return {
        response: {
          content: translate('check.error.checkJobLimit', { guildId }),
          embed: {
            description: translate('check.error.checkJobLimitHelp', { guildId }),
          },
        },
      }
    }

    const duplicatedJobId = Object.keys(cache.jobs).find(
      jobId => cache.jobs[jobId]?.target?.messageId === targetMessage.id,
    )
    const job: JobProps = {
      clientId: message.client.user?.id || '',
      executeAt: time,
      type: 'check',
      target: {
        messageId: targetMessage.id,
        channelId: targetMessage.channel.id,
      },
      command: {
        messageId: message.id,
        guildId: guildId,
        channelId: message.channel.id,
        userId: message.author.id,
      },
      retryTimes: 0,
    }
    if (duplicatedJobId) {
      await database.ref(`/jobs/${duplicatedJobId}`).remove()
    }
    await database.ref(`/jobs/${message.id}`).set(job)

    return {
      response: {
        content: (duplicatedJobId
          ? translate('check.text.checkJobUpdated', { guildId })
          : translate('check.text.checkJobCreated', { guildId })
        )
          .replace('GUILD_NAME', message.guild?.name || guildId)
          .replace('MESSAGE_ID', targetMessage.id),
        embed: {
          description: translate('check.text.checkJobDetail', { guildId })
            .replace('TIME', timeFormatter({ guildId, time }))
            .replace('FROM_NOW', `<t:${Math.floor(time / 1000)}:R>`)
            .replace('TARGET_URL', targetMessage.url)
            .replace('COMMAND_URL', message.url),
        },
      },
    }
  }

  return await makeCheckLists(targetMessage)
}

export const makeCheckLists: (
  message: Message,
  options?: {
    passedCheckAt?: number
  },
) => Promise<CommandResultProps> = async (message, options) => {
  if (message.channel.type === 'DM' || !message.guild) {
    throw new Error('Invalid Message')
  }
  const guildId = message.guild.id

  const checkAt = Date.now()
  const mentionedMembers = await getReactionStatus(message)
  const allMembersCount = Object.keys(mentionedMembers).length

  if (allMembersCount === 0) {
    return {
      response: {
        content: translate('system.error.noMentionedMember', { guildId }),
        embed: {
          description: translate('system.error.noMentionedMemberHelp', { guildId }),
        },
      },
    }
  }

  const absentMemberIds: string[] = []
  const reactedMemberNames: string[] = []
  const absentMemberNames: string[] = []
  const lockedMemberNames: string[] = []

  for (const memberId in mentionedMembers) {
    if (mentionedMembers[memberId].status === 'reacted') {
      reactedMemberNames.push(mentionedMembers[memberId].name)
    } else if (mentionedMembers[memberId].status === 'absent') {
      absentMemberIds.push(memberId)
      absentMemberNames.push(mentionedMembers[memberId].name)
    } else if (mentionedMembers[memberId].status === 'locked') {
      lockedMemberNames.push(mentionedMembers[memberId].name)
    }
  }

  reactedMemberNames.sort((a, b) => a.localeCompare(b))
  absentMemberNames.sort((a, b) => a.localeCompare(b))
  lockedMemberNames.sort((a, b) => a.localeCompare(b))

  const fields: EmbedFieldData[] = []
  const files: FileOptions[] = []
  if (allMembersCount > 200) {
    const filePath = join(__dirname, '../../tmp/', `${message.id}.txt`)
    writeFileSync(
      filePath,
      translate('check.text.checkResultFullDetail', { guildId })
        .replace('GUILD_NAME', message.guild.name)
        .replace('CHANNEL_NAME', message.channel.name)
        .replace('TIME', timeFormatter({ guildId, time: checkAt }))
        .replace('MESSAGE_URL', message.url)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('REACTED_COUNT', `${reactedMemberNames.length}`)
        .replace('ABSENT_COUNT', `${absentMemberIds.length}`)
        .replace('LOCKED_COUNT', `${lockedMemberNames.length}`)
        .replace('PERCENTAGE', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
        .replace('REACTED_MEMBERS', reactedMemberNames.join('\r\n'))
        .replace('ABSENT_MEMBERS', absentMemberNames.join('\r\n'))
        .replace('LOCKED_MEMBERS', lockedMemberNames.join('\r\n')),
      { encoding: 'utf8' },
    )
    files.push({
      attachment: filePath,
      name: `${message.id}.txt`,
    })
  } else {
    cache.settings[guildId]?.showReacted !== false &&
      reactedMemberNames.length &&
      Util.splitMessage(reactedMemberNames.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('\n'), {
        maxLength: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: translate('check.text.reactedMembersList', { guildId }).replace('PAGE', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
    cache.settings[guildId]?.showAbsent !== false &&
      absentMemberNames.length &&
      Util.splitMessage(absentMemberNames.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('\n'), {
        maxLength: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: translate('check.text.absentMembersList', { guildId }).replace('PAGE', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
    cache.settings[guildId]?.showLocked !== false &&
      lockedMemberNames.length &&
      Util.splitMessage(lockedMemberNames.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('\n'), {
        maxLength: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: translate('check.text.lockedMembersList', { guildId }).replace('PAGE', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
  }

  const isMentionAbsentEnabled = !!cache.modules.mentionAbsent?.[guildId]
  const warnings: string[] = []
  if (lockedMemberNames.length) {
    warnings.push(
      translate('check.text.lockedMembersWarning', { guildId }).replace('COUNT', 'lockedMemberNames.length'),
    )
  }
  if (options?.passedCheckAt) {
    warnings.push(
      translate('check.text.checkTimePassedWarning', { guildId }).replace(
        'TIMESTAMP',
        `${Math.floor(options.passedCheckAt / 1000)}`,
      ),
    )
  }

  return {
    response: {
      content: translate('check.text.checkResult', { guildId })
        .replace('REACTED_COUNT', `${reactedMemberNames.length}`)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('PERCENTAGE', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
        .replace('MENTIONS', isMentionAbsentEnabled ? absentMemberIds.map(memberId => `<@${memberId}>`).join(' ') : '')
        .trim(),
      embed: {
        description: translate('check.text.checkResultDetail', { guildId })
          .replace('TIME', timeFormatter({ guildId, time: checkAt }))
          .replace('FROM_NOW', `<t:${Math.floor(checkAt / 1000)}:R>`)
          .replace('MESSAGE_URL', message.url)
          .replace('ALL_COUNT', `${allMembersCount}`)
          .replace('REACTED_COUNT', `${reactedMemberNames.length}`)
          .replace('ABSENT_COUNT', `${absentMemberNames.length}`)
          .replace('WARNINGS', warnings.join('\n'))
          .trim(),
        fields,
      },
      files,
    },
  }
}

export default commandCheck
