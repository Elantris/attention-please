import { DMChannel, EmbedFieldData, Message, Util } from 'discord.js'
import { CommandResultProps } from '../types'
import cache from './cache'

const getReactionStatus: (message: Message) => Promise<CommandResultProps> = async message => {
  if (message.channel instanceof DMChannel || !message.guild) {
    return {
      content: ':x:',
      isSyntaxError: true,
    }
  }

  const reactionStatus: {
    [UserID in string]?: {
      name: string
      emoji: string[]
    }
  } = {}
  const members = await message.guild.members.fetch()
  members
    .filter(
      member =>
        message.mentions.everyone ||
        message.mentions.users.has(member.id) ||
        message.mentions.roles.some(role => role.members.has(member.id)),
    )
    .filter(member => !member.user.bot)
    .sort()
    .each(member => {
      reactionStatus[member.id] = {
        name: Util.escapeMarkdown(member.displayName.slice(0, 16)),
        emoji: [],
      }
    })

  if (Object.keys(reactionStatus).length === 0) {
    return {
      content: ':x: 這則訊息沒有標記的對象',
    }
  }

  const reactions = message.reactions.cache.array()
  for (const reaction of reactions) {
    const users = await reaction.users.fetch()
    users
      .filter(user => !!reactionStatus[user.id])
      .each(user => {
        reactionStatus[user.id]?.emoji.push(reaction.emoji.name)
      })
  }

  const allMembersCount = Object.keys(reactionStatus).length
  const reactedMembers: {
    id: string
    name: string
  }[] = Object.keys(reactionStatus)
    .filter(userId => reactionStatus[userId]?.emoji.length)
    .map(userId => ({
      id: userId,
      name: reactionStatus[userId]?.name || userId,
    }))
  const absentMembers: {
    id: string
    name: string
  }[] = Object.keys(reactionStatus)
    .filter(userId => !reactionStatus[userId]?.emoji.length)
    .map(userId => ({
      id: userId,
      name: reactionStatus[userId]?.name || userId,
    }))

  const showReacted = !!cache.settings[message.guild.id]?.showReacted
  const showAbsent = cache.settings[message.guild.id]?.showAbsent ?? true
  const mentionAbsent = !!cache.settings[message.guild.id]?.mentionAbsent

  const fields: EmbedFieldData[] = []
  if (showAbsent) {
    fields.push(
      ...absentMembers
        .reduce<string[][]>((accumulator, member, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(member.name)
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:warning: 未簽到名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  }
  if (showReacted) {
    fields.push(
      ...reactedMembers
        .reduce<string[][]>((accumulator, member, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(member.name)
          return accumulator
        }, [])
        .map((memberNames, index) => ({
          name: `:white_check_mark: 簽到名單 第 ${index + 1} 頁`,
          value: memberNames.join('、'),
        })),
    )
  }

  return {
    content: ':bar_chart: 已簽到：REACTED_MEMBERS / ALL_MEMBERS (**PERCENTAGE%**)\nMENTIONS'
      .replace('REACTED_MEMBERS', `${reactedMembers.length}`)
      .replace('ALL_MEMBERS', `${allMembersCount}`)
      .replace('PERCENTAGE', `${((reactedMembers.length * 100) / allMembersCount).toFixed(2)}`)
      .replace('MENTIONS', mentionAbsent ? absentMembers.map(member => `<@!${member.id}>`).join(' ') : '')
      .trim(),
    embed: {
      description: '結算目標：[訊息連結](MESSAGE_URL)\n標記人數：ALL_MEMBERS\n回應人數：REACTED_MEMBERS'
        .replace('MESSAGE_URL', message.url)
        .replace('ALL_MEMBERS', `${allMembersCount}`)
        .replace('REACTED_MEMBERS', `${reactedMembers.length}`),
      fields,
    },
  }
}

export default getReactionStatus
