import { EmbedFieldData, FileOptions, Message, Util } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, CommandResultProps, JobProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getReactionStatus from '../utils/getReactionStatus'
import timeFormatter from '../utils/timeFormatter'

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
          content: ':warning: 預約結算數量已達上限',
          embed: {
            description: '為了避免濫用預約結算功能造成運算負擔，每個伺服器只能夠建立有限數量的預約結算',
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
          ? ':alarm_clock: **GUILD_NAME** 變更 `MESSAGE_ID` 結算時間'
          : ':alarm_clock: **GUILD_NAME** 建立 `MESSAGE_ID` 預約結算'
        )
          .replace('GUILD_NAME', message.guild?.name || guildId)
          .replace('MESSAGE_ID', targetMessage.id),
        embed: {
          description:
            '預約結算：`TIME` (FROM_NOW)\n結算目標：[訊息連結](TARGET_URL)\n\n刪除 [指令訊息](COMMAND_URL) 即可取消預約結算'
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

  const checkAt = Date.now()
  const mentionedMembers = await getReactionStatus(message)
  const allMembersCount = Object.keys(mentionedMembers).length

  if (allMembersCount === 0) {
    return {
      response: {
        content: ':x: 這則訊息沒有標記對象',
        embed: {
          description: '請選擇一個有標記對象的訊息，例如：\n1. @everyone\n2. @身份組\n3. @成員',
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
      'GUILD_NAME / CHANNEL_NAME\r\n結算時間：TIME\r\n訊息連結：MESSAGE_URL\r\n標記人數：ALL_COUNT\r\n簽到人數：REACTED_COUNT (PERCENTAGE%)\r\n缺席人數：ABSENT_COUNT\r\n無權人數：LOCKED_COUNT\r\n\r\n簽到名單：\r\nREACTED_MEMBERS\r\n\r\n缺席名單：\r\nABSENT_MEMBERS\r\n\r\n無權名單：\r\nLOCKED_MEMBERS'
        .replace('GUILD_NAME', message.guild.name)
        .replace('CHANNEL_NAME', message.channel.name)
        .replace('TIME', timeFormatter({ guildId: message.guild.id, time: checkAt }))
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
    cache.settings[message.guild.id]?.showReacted !== false &&
      reactedMemberNames.length &&
      Util.splitMessage(reactedMemberNames.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('\n'), {
        maxLength: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: `:white_check_mark: 簽到名單 第${index + 1}頁`,
          value: content.replace(/\n/g, '、'),
        })
      })
    cache.settings[message.guild.id]?.showAbsent !== false &&
      absentMemberNames.length &&
      Util.splitMessage(absentMemberNames.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('\n'), {
        maxLength: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: `:x: 缺席名單 第 ${index + 1} 頁`,
          value: content.replace(/\n/g, '、'),
        })
      })
    cache.settings[message.guild.id]?.showLocked !== false &&
      lockedMemberNames.length &&
      Util.splitMessage(lockedMemberNames.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('\n'), {
        maxLength: 1000,
      }).forEach((content, index) => {
        fields.push({
          name: `:lock: 無權名單 第 ${index + 1} 頁`,
          value: content.replace(/\n/g, '、'),
        })
      })
  }

  const isMentionAbsentEnabled = !!cache.modules.mentionAbsent?.[message.guild.id]
  const warnings: string[] = []
  if (lockedMemberNames.length) {
    warnings.push(`:warning: 被標記的成員當中有 ${lockedMemberNames.length} 人沒有權限看到這則訊息`)
  }
  if (options?.passedCheckAt) {
    warnings.push(`:warning: 指定的時間在 <t:${Math.floor(options.passedCheckAt / 1000)}:R>`)
  }

  return {
    response: {
      content: ':bar_chart: 已簽到：REACTED_COUNT / ALL_COUNT (**PERCENTAGE%**)\nMENTIONS'
        .replace('REACTED_COUNT', `${reactedMemberNames.length}`)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('PERCENTAGE', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
        .replace('MENTIONS', isMentionAbsentEnabled ? absentMemberIds.map(memberId => `<@${memberId}>`).join(' ') : '')
        .trim(),
      embed: {
        description:
          '結算時間：`TIME` (FROM_NOW)\n結算目標：[訊息連結](MESSAGE_URL)\n標記人數：ALL_COUNT\n簽到人數：REACTED_COUNT\n缺席人數：ABSENT_COUNT\n\nWARNINGS'
            .replace('TIME', timeFormatter({ guildId: message.guild.id, time: checkAt }))
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
