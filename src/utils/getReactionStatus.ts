import { DMChannel, EmbedFieldData, FileOptions, Message, Util } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandResultProps } from '../types'
import cache from './cache'
import notEmpty from './notEmpty'
import timeFormatter from './timeFormatter'

const getReactionStatus: (
  message: Message,
  options?: {
    passedCheckAt?: number
  },
) => Promise<CommandResultProps> = async (message, options) => {
  if (message.channel instanceof DMChannel || !message.guild) {
    return {
      content: ':x:',
      isSyntaxError: true,
    }
  }

  const countAt = Date.now()
  await message.guild.members.fetch()

  const mentionedMembers: {
    [UserID: string]: {
      isReacted: boolean
      displayName: string
    }
  } = {}
  if (message.mentions.everyone) {
    message.guild.members.cache.each(member => {
      if (member.user.bot) {
        return
      }
      mentionedMembers[member.id] = {
        isReacted: false,
        displayName: member.displayName,
      }
    })
  } else {
    message.mentions.members?.each(member => {
      if (member.user.bot) {
        return
      }
      mentionedMembers[member.id] = {
        isReacted: false,
        displayName: member.displayName,
      }
    })

    message.mentions.roles.each(role => {
      role.members.each(member => {
        if (member.user.bot) {
          return
        }
        mentionedMembers[member.id] = {
          isReacted: false,
          displayName: member.displayName,
        }
      })
    })
  }

  if (Object.keys(mentionedMembers).length === 0) {
    return {
      content: ':x: 這則訊息沒有標記的對象，請選擇一個有「@身份組」或「@成員」的訊息',
      isSyntaxError: true,
    }
  }

  const messageReactions = message.reactions.cache.array()
  for (const messageReaction of messageReactions) {
    const users = (await messageReaction.users.fetch()).array()
    for (const user of users) {
      if (!mentionedMembers[user.id]) {
        continue
      }
      mentionedMembers[user.id].isReacted = true
    }
  }

  const reactedMemberIds = Object.keys(mentionedMembers).filter(memberId => mentionedMembers[memberId].isReacted)
  const absentMemberIds = Object.keys(mentionedMembers).filter(memberId => !mentionedMembers[memberId].isReacted)

  const nameListDisplay = cache.settings[message.guild.id]?.display || 'absent'
  const isMentionAbsentEnabled = !!cache.modules.mentionAbsent?.[message.guild.id]

  const fields: EmbedFieldData[] = []
  const files: FileOptions[] = []
  if (Object.keys(mentionedMembers).length > 300) {
    const filePath = join(__dirname, '../../tmp/', `${message.id}.txt`)
    writeFileSync(
      filePath,
      `GUILD_NAME / CHANNEL_NAME\r\n結算時間：TIME\r\n訊息連結：MESSAGE_URL\r\n標記人數：ALL_MEMBERS\r\n簽到人數：REACTED_MEMBERS_COUNT (PERCENTAGE%)\r\n\r\n缺席名單：\r\nABSENT_MEMBERS\r\n\r\n簽到名單：\r\nREACTED_MEMBERS`
        .replace('GUILD_NAME', message.guild.name)
        .replace('CHANNEL_NAME', message.channel.name)
        .replace('TIME', timeFormatter({ guildId: message.guild.id, time: countAt }))
        .replace('MESSAGE_URL', message.url)
        .replace('ALL_MEMBERS', `${Object.keys(mentionedMembers).length}`)
        .replace('REACTED_MEMBERS_COUNT', `${reactedMemberIds.length}`)
        .replace('PERCENTAGE', ((reactedMemberIds.length * 100) / Object.keys(mentionedMembers).length).toFixed(2))
        .replace(
          'ABSENT_MEMBERS',
          absentMemberIds
            .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName))
            .map(memberId => mentionedMembers[memberId].displayName)
            .join('\r\n'),
        )
        .replace(
          'REACTED_MEMBERS',
          reactedMemberIds
            .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName))
            .map(memberId => mentionedMembers[memberId].displayName)
            .join('\r\n'),
        ),
      { encoding: 'utf8' },
    )
    files.push({
      attachment: filePath,
      name: `${message.id}.txt`,
    })
  } else if (nameListDisplay === 'absent') {
    fields.push(
      ...absentMemberIds
        .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName))
        .reduce<string[][]>((accumulator, memberId, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(Util.escapeMarkdown(mentionedMembers[memberId].displayName.slice(0, 16)))
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:x: 缺席名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  } else if (nameListDisplay === 'reacted') {
    fields.push(
      ...reactedMemberIds
        .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName))
        .reduce<string[][]>((accumulator, memberId, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(Util.escapeMarkdown(mentionedMembers[memberId].displayName.slice(0, 16)))
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:white_check_mark: 簽到名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  }

  const channel = message.channel
  const noPermissionMembers = absentMemberIds
    .map(memberId => message.guild?.members.cache.get(memberId))
    .filter(notEmpty)
    .filter(
      member =>
        !channel.permissionsFor(member)?.has('VIEW_CHANNEL') ||
        !channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'),
    )
  const warnings: string[] = []
  if (noPermissionMembers.length) {
    warnings.push(`:warning: 被標記的成員當中有 ${noPermissionMembers.length} 人沒有權限看到這則訊息`)
  }
  if (options?.passedCheckAt) {
    warnings.push(`:warning: 指定的時間在 <t:${Math.floor(options.passedCheckAt / 1000)}:R>`)
  }

  return {
    content: ':bar_chart: 已簽到：REACTED_MEMBERS / ALL_MEMBERS (**PERCENTAGE%**)\nMENTIONS'
      .replace('REACTED_MEMBERS', `${reactedMemberIds.length}`)
      .replace('ALL_MEMBERS', `${Object.keys(mentionedMembers).length}`)
      .replace('PERCENTAGE', `${((reactedMemberIds.length * 100) / Object.keys(mentionedMembers).length).toFixed(2)}`)
      .replace('MENTIONS', isMentionAbsentEnabled ? absentMemberIds.map(memberId => `<@${memberId}>`).join(' ') : '')
      .trim(),
    files,
    embed: {
      title: '加入 eeBots Support（公告、更新）',
      url: 'https://discord.gg/Ctwz4BB',
      color: '#ff922b',
      description:
        '結算時間：`TIME` (FROM_NOW)\n結算目標：[訊息連結](TARGET_URL)\n標記人數：ALL_MEMBERS\n回應人數：REACTED_MEMBERS\n缺席人數：ABSENT_MEMBERS\n\nWARNINGS'
          .replace('TIME', timeFormatter({ guildId: message.guild.id, time: countAt }))
          .replace('FROM_NOW', `<t:${Math.floor(countAt / 1000)}:R>`)
          .replace('TARGET_URL', message.url)
          .replace('ALL_MEMBERS', `${Object.keys(mentionedMembers).length}`)
          .replace('REACTED_MEMBERS', `${reactedMemberIds.length}`)
          .replace('ABSENT_MEMBERS', `${absentMemberIds.length}`)
          .replace('WARNINGS', warnings.join('\n'))
          .trim(),
      fields,
    },
  }
}

export default getReactionStatus
