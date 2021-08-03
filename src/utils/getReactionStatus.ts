import { DMChannel, EmbedFieldData, Message, Util } from 'discord.js'
import moment from 'moment'
import { CommandResultProps } from '../types'
import cache from './cache'

const getReactionStatus: (
  message: Message,
  options?: {
    passedCheckAt?: string
  },
) => Promise<CommandResultProps> = async (message, options) => {
  if (message.channel instanceof DMChannel || !message.guild) {
    return {
      content: ':x:',
      isSyntaxError: true,
    }
  }

  const guildId = message.guild.id

  const mentionedMembers: {
    [UserID: string]: {
      isReacted: boolean
      displayName: string
    }
  } = {}
  if (message.mentions.everyone) {
    for (const memberId in cache.displayNames[guildId]) {
      mentionedMembers[memberId] = {
        isReacted: false,
        displayName: cache.displayNames[guildId]?.[memberId] || '',
      }
    }
  } else {
    message.mentions.users
      ?.filter(user => !user.bot)
      .forEach(user => {
        mentionedMembers[user.id] = {
          isReacted: false,
          displayName: cache.displayNames[guildId]?.[user.id] || user.username,
        }
      })

    for (const memberId in cache.displayNames[guildId]) {
      if (mentionedMembers[memberId]) {
        continue
      }
      if (message.mentions.roles.some(role => !!cache.memberRoles[guildId]?.[memberId]?.includes(role.id))) {
        mentionedMembers[memberId] = {
          isReacted: false,
          displayName: cache.displayNames[guildId]?.[memberId] || '',
        }
      }
    }
  }

  if (Object.keys(mentionedMembers).length === 0) {
    return {
      content: ':x: 這則訊息沒有標記的對象，請選擇一個有「@身份組」或「@成員」的訊息',
      isSyntaxError: true,
    }
  }

  const countAt = moment()
    .utcOffset(cache.settings[guildId]?.timezone || 8)
    .format('YYYY-MM-DD HH:mm')
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

  const reactedMemberIds = [
    ...Object.keys(mentionedMembers)
      .filter(memberId => mentionedMembers[memberId].isReacted && mentionedMembers[memberId].displayName)
      .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName)),
    ...Object.keys(mentionedMembers)
      .filter(memberId => mentionedMembers[memberId].isReacted && !mentionedMembers[memberId].displayName)
      .sort(),
  ]
  const absentMemberIds = [
    ...Object.keys(mentionedMembers)
      .filter(memberId => !mentionedMembers[memberId].isReacted && mentionedMembers[memberId].displayName)
      .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName)),
    ...Object.keys(mentionedMembers)
      .filter(memberId => !mentionedMembers[memberId].isReacted && !mentionedMembers[memberId].displayName)
      .sort(),
  ]

  const showReacted = cache.settings[message.guild.id]?.showReacted ?? false
  const showAbsent = cache.settings[message.guild.id]?.showAbsent ?? true
  const mentionAbsent = cache.settings[message.guild.id]?.mentionAbsent ?? false

  const fields: EmbedFieldData[] = []
  if (showAbsent) {
    fields.push(
      ...absentMemberIds
        .reduce<string[][]>((accumulator, memberId, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(
            Util.escapeMarkdown(mentionedMembers[memberId].displayName.slice(0, 16)) || `<@${memberId}>`,
          )
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:x: 未簽到名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  }
  if (showReacted) {
    fields.push(
      ...reactedMemberIds
        .reduce<string[][]>((accumulator, memberId, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(
            Util.escapeMarkdown(mentionedMembers[memberId].displayName.slice(0, 16)) || `<@${memberId}>`,
          )
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:white_check_mark: 簽到名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  }

  const warnings: string[] = []
  const channel = message.channel
  const noPermissionMembers = (await message.guild.members.fetch({ user: absentMemberIds })).filter(
    member =>
      !channel.permissionsFor(member)?.has('VIEW_CHANNEL') ||
      !channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'),
  )
  if (noPermissionMembers.size) {
    warnings.push(`:warning: 被標記的成員當中有 ${noPermissionMembers.size} 人沒有權限看到這則訊息`)
  }
  if (options?.passedCheckAt) {
    warnings.push(`:warning: 指定的時間已經過了大約 ${options.passedCheckAt}`)
  }

  return {
    content: ':bar_chart: 已簽到：REACTED_MEMBERS / ALL_MEMBERS (**PERCENTAGE%**)\nMENTIONS'
      .replace('REACTED_MEMBERS', `${reactedMemberIds.length}`)
      .replace('ALL_MEMBERS', `${Object.keys(mentionedMembers).length}`)
      .replace('PERCENTAGE', `${((reactedMemberIds.length * 100) / Object.keys(mentionedMembers).length).toFixed(2)}`)
      .replace('MENTIONS', mentionAbsent ? absentMemberIds.map(memberId => `<@${memberId}>`).join(' ') : '')
      .trim(),
    embed: {
      title: '加入 eeBots Support（公告、更新）',
      url: 'https://discord.gg/Ctwz4BB',
      color: 0xff922b,
      description:
        '結算時間：`TIME`\n結算目標：[訊息連結](TARGET_URL)\n標記人數：ALL_MEMBERS\n回應人數：REACTED_MEMBERS\n\nWARNINGS'
          .replace('TIME', countAt)
          .replace('TARGET_URL', message.url)
          .replace('ALL_MEMBERS', `${Object.keys(mentionedMembers).length}`)
          .replace('REACTED_MEMBERS', `${reactedMemberIds.length}`)
          .replace('WARNINGS', warnings.join('\n'))
          .trim(),
      fields,
    },
  }
}

export default getReactionStatus
