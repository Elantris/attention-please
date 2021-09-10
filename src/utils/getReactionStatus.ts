import { DMChannel, EmbedFieldData, Message, Util } from 'discord.js'
import { CommandResultProps } from '../types'
import cache from './cache'
import notEmpty from './notEmpty'

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

  const reactedMemberIds = Object.keys(mentionedMembers)
    .filter(memberId => mentionedMembers[memberId].isReacted)
    .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName))
  const absentMemberIds = Object.keys(mentionedMembers)
    .filter(memberId => !mentionedMembers[memberId].isReacted)
    .sort((a, b) => mentionedMembers[a].displayName.localeCompare(mentionedMembers[b].displayName))

  const nameListDisplay = cache.settings[message.guild.id]?.display || 'absent'
  const isMentionAbsentEnabled = !!cache.modules.mentionAbsent?.[message.guild.id]

  const fields: EmbedFieldData[] = []
  if (nameListDisplay === 'absent') {
    fields.push(
      ...absentMemberIds
        .reduce<string[][]>((accumulator, memberId, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(Util.escapeMarkdown(mentionedMembers[memberId].displayName.slice(0, 16)))
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:x: 未簽到名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  }
  if (nameListDisplay === 'reacted') {
    fields.push(
      ...reactedMemberIds
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

  const warnings: string[] = []
  const channel = message.channel
  const noPermissionMembers = absentMemberIds
    .map(memberId => message.guild?.members.cache.get(memberId))
    .filter(notEmpty)
    .filter(
      member =>
        !channel.permissionsFor(member)?.has('VIEW_CHANNEL') ||
        !channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'),
    )
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
    embed: {
      title: '加入 eeBots Support（公告、更新）',
      url: 'https://discord.gg/Ctwz4BB',
      color: 0xff922b,
      description:
        '結算時間：TIME\n結算目標：[訊息連結](TARGET_URL)\n標記人數：ALL_MEMBERS\n回應人數：REACTED_MEMBERS\n\nWARNINGS'
          .replace('TIME', `<t:${Math.floor(countAt / 1000)}:F> / <t:${Math.floor(countAt / 1000)}:R>`)
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
