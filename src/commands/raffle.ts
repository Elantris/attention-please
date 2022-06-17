import { EmbedFieldData, FileOptions, Message, Util } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, CommandResultProps, JobProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getReactionStatus from '../utils/getReactionStatus'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const commandRaffle: CommandProps = async ({ message, guildId, args }) => {
  const { targetMessage, time, response } = await fetchTargetMessage({ message, guildId, args })
  if (!targetMessage?.guild || response) {
    return {
      response,
    }
  }

  if (time) {
    if (time < message.createdTimestamp) {
      return {
        response: {
          content: translate('raffle.error.raffleJobTime', { guildId }),
          embed: {
            description: translate('raffle.error.raffleJobTimeHelp', { guildId }).replace(
              'TIMESTAMP',
              `${Math.floor(time / 1000)}`,
            ),
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
      type: 'raffle',
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
          ? translate('raffle.text.raffleJobUpdated', { guildId })
          : translate('raffle.text.raffleJobCreated', { guildId })
        )
          .replace('GUILD_NAME', message.guild?.name || guildId)
          .replace('MESSAGE_ID', targetMessage.id),
        embed: {
          description: translate('raffle.text.raffleJobDetail', { guildId })
            .replace('TIME', timeFormatter({ guildId, time }))
            .replace('FROM_NOW', `<t:${Math.floor(time / 1000)}:R>`)
            .replace('TARGET_URL', targetMessage.url)
            .replace('COMMAND_URL', message.url),
        },
      },
    }
  }

  return await makeRaffleLists(targetMessage)
}

export const makeRaffleLists: (message: Message) => Promise<CommandResultProps> = async message => {
  if (message.channel.type === 'DM' || !message.guild) {
    throw new Error('Invalid Message')
  }
  const guildId = message.guild.id

  const raffleAt = Date.now()
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
  const raffleCount = cache.settings[message.guild.id]?.raffle || 30

  const reactedMemberIds: string[] = []
  for (const memberId in mentionedMembers) {
    if (mentionedMembers[memberId].status === 'reacted') {
      reactedMemberIds.push(memberId)
    }
  }
  const reactedMemberCount = reactedMemberIds.length

  if (reactedMemberCount === 0) {
    return {
      response: {
        content: translate('raffle.error.noReactedMembers', { guildId }),
        embed: {
          description: translate('raffle.error.noReactedMembersHelp', { guildId }),
        },
      },
    }
  }

  for (let i = reactedMemberCount - 1; i > 0; i--) {
    const choose = Math.floor(Math.random() * i)
    ;[reactedMemberIds[choose], reactedMemberIds[i]] = [reactedMemberIds[i], reactedMemberIds[choose]]
  }
  const winningMemberIds = reactedMemberIds.splice(0, raffleCount)

  const fields: EmbedFieldData[] = []
  const files: FileOptions[] = []
  if (allMembersCount > 100 && raffleCount > 100) {
    const filePath = join(__dirname, '../../tmp/', `${message.id}.txt`)
    writeFileSync(
      filePath,
      translate('raffle.text.raffleResultFullDetail', { guildId })
        .replace('GUILD_NAME', message.guild.name)
        .replace('CHANNEL_NAME', message.channel.name)
        .replace('TIME', timeFormatter({ guildId: message.guild.id, time: raffleAt }))
        .replace('MESSAGE_URL', message.url)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('REACTED_COUNT', `${reactedMemberCount}`)
        .replace('PERCENTAGE', ((reactedMemberCount * 100) / allMembersCount).toFixed(2))
        .replace(
          'WINNING_MEMBERS',
          winningMemberIds
            .map((memberId, index) => `${index + 1}. ${mentionedMembers[memberId].name} ${memberId}`)
            .join('\r\n'),
        )
        .replace('REACTED_MEMBERS', reactedMemberIds.map(memberId => mentionedMembers[memberId].name).join('\r\n')),
      { encoding: 'utf8' },
    )
    files.push({
      attachment: filePath,
      name: `${message.id}.txt`,
    })
  } else {
    Util.splitMessage(
      winningMemberIds.map(memberId => Util.escapeMarkdown(mentionedMembers[memberId].name.slice(0, 16))).join('\n'),
      { maxLength: 1000 },
    ).forEach((content, index) => {
      fields.push({
        name: translate('raffle.text.winningMembersList', { guildId }).replace('PAGE', `${index + 1}`),
        value: content.replace(/\n/g, '、'),
      })
    })
    reactedMemberIds.length &&
      Util.splitMessage(
        reactedMemberIds.map(memberId => Util.escapeMarkdown(mentionedMembers[memberId].name.slice(0, 16))).join('\n'),
        { maxLength: 1000 },
      ).forEach((content, index) => {
        fields.push({
          name: translate('raffle.text.unluckyMembersList', { guildId }).replace('PAGE', `${index + 1}`),
          value: content.replace(/\n/g, '、'),
        })
      })
  }

  return {
    response: {
      content: translate('raffle.text.raffleResult', { guildId })
        .replace('REACTED_COUNT', `${reactedMemberCount}`)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('PERCENTAGE', ((reactedMemberCount * 100) / allMembersCount).toFixed(2)),
      embed: {
        description: translate('raffle.text.raffleResultDetail', { guildId })
          .replace('TIME', timeFormatter({ guildId: message.guild.id, time: raffleAt }))
          .replace('FROM_NOW', `<t:${Math.floor(raffleAt / 1000)}:R>`)
          .replace('MESSAGE_URL', message.url)
          .replace('ALL_COUNT', `${allMembersCount}`)
          .replace('REACTED_COUNT', `${reactedMemberCount}`)
          .replace('LUCKY_COUNT', `${winningMemberIds.length}`)
          .replace('MISSED_COUNT', `${reactedMemberIds.length}`)
          .trim(),
        fields,
      },
      files,
    },
  }
}

export default commandRaffle
