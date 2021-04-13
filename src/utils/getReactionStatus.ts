import { DMChannel, EmbedFieldData, Message, Util } from 'discord.js'
import { CommandResultProps } from '../types'
import cache from './cache'

const getReactionStatus: (message: Message) => Promise<CommandResultProps> = async message => {
  if (message.channel instanceof DMChannel || !message.guild) {
    return {
      content: '',
    }
  }

  const members = await message.guild.members.fetch()
  const channel = message.channel
  const reactionStatus: {
    [UserID: string]: {
      name: string
      emoji: string[]
    }
  } = {}

  members
    .filter(
      member =>
        !member.user.bot &&
        !!channel.permissionsFor(member)?.has('VIEW_CHANNEL') &&
        !!channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'),
    )
    .filter(
      member =>
        message.mentions.everyone ||
        message.mentions.users.has(member.id) ||
        message.mentions.roles.some(role => role.members.has(member.id)),
    )
    .each(member => {
      reactionStatus[member.id] = {
        name: Util.escapeMarkdown(member.displayName.slice(0, 16)),
        emoji: [],
      }
    })

  if (Object.keys(reactionStatus).length === 0) {
    return {
      content: ':x: 這則訊息沒有被標記的人、或是被標記的人都沒有權限看到這則訊息',
    }
  }

  const reactions = message.reactions.cache.array()
  for (const reaction of reactions) {
    const users = await reaction.users.fetch()
    users.each(user => {
      if (!reactionStatus[user.id]) {
        return
      }
      reactionStatus[user.id].emoji.push(reaction.emoji.name)
    })
  }

  const allMembersCount = Object.keys(reactionStatus).length
  const reactedMembers: {
    id: string
    name: string
  }[] = Object.keys(reactionStatus)
    .filter(userId => reactionStatus[userId].emoji.length !== 0)
    .sort()
    .map(userId => ({
      id: userId,
      name: reactionStatus[userId].name,
    }))
  const absentMembers: {
    id: string
    name: string
  }[] = Object.keys(reactionStatus)
    .filter(userId => reactionStatus[userId].emoji.length === 0)
    .sort()
    .map(userId => ({
      id: userId,
      name: reactionStatus[userId].name,
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
      description: '結算目標：[訊息連結](MESSAGE_URL)'.replace('MESSAGE_URL', message.url),
      fields,
    },
  }
}

export default getReactionStatus
