import { EmbedFieldData, FileOptions, Message, Util } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, CommandResultProps, JobProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getReactionStatus from '../utils/getReactionStatus'
import timeFormatter from '../utils/timeFormatter'

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
          content: ':x: 預約抽獎的開獎時間必須設定在未來',
          embed: {
            description: `:warning: 指定的時間在 <t:${Math.floor(time / 1000)}:R>`,
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
          ? ':alarm_clock: **GUILD_NAME** 變更 `MESSAGE_ID` 抽獎時間'
          : ':alarm_clock: **GUILD_NAME** 建立 `MESSAGE_ID` 預約抽獎'
        )
          .replace('GUILD_NAME', message.guild?.name || guildId)
          .replace('MESSAGE_ID', targetMessage.id),
        embed: {
          description:
            '預約抽獎：`TIME` (FROM_NOW)\n抽獎目標：[訊息連結](TARGET_URL)\n\n刪除 [指令訊息](COMMAND_URL) 即可取消預約抽獎'
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

  const raffleAt = Date.now()
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
        content: ':x: 目前有抽獎資格的成員都還沒有參加抽獎',
        embed: {
          description: '被標記到的人具有抽獎資格，按下任意表情符號回應即可參加抽獎',
        },
      },
    }
  }

  for (let i = reactedMemberCount - 1; i > 0; i--) {
    const choose = Math.floor(Math.random() * i)
    ;[reactedMemberIds[choose], reactedMemberIds[i]] = [reactedMemberIds[i], reactedMemberIds[choose]]
  }
  const luckyMemberIds = reactedMemberIds.splice(0, raffleCount)

  const fields: EmbedFieldData[] = []
  const files: FileOptions[] = []
  if (allMembersCount > 100 && raffleCount > 100) {
    const filePath = join(__dirname, '../../tmp/', `${message.id}.txt`)
    writeFileSync(
      filePath,
      'GUILD_NAME / CHANNEL_NAME\r\n抽獎時間：TIME\r\n訊息連結：MESSAGE_URL\r\n標記人數：ALL_COUNT\r\n參與人數：REACTED_COUNT (PERCENTAGE%)\r\n\r\n中獎順序：\r\nLUCKY_MEMBERS\r\n\r\n無緣名單：\r\nREACTED_MEMBERS'
        .replace('GUILD_NAME', message.guild.name)
        .replace('CHANNEL_NAME', message.channel.name)
        .replace('TIME', timeFormatter({ guildId: message.guild.id, time: raffleAt }))
        .replace('MESSAGE_URL', message.url)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('REACTED_COUNT', `${reactedMemberCount}`)
        .replace('PERCENTAGE', ((reactedMemberCount * 100) / allMembersCount).toFixed(2))
        .replace(
          'LUCKY_MEMBERS',
          luckyMemberIds
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
      luckyMemberIds.map(memberId => Util.escapeMarkdown(mentionedMembers[memberId].name.slice(0, 16))).join('\n'),
      { maxLength: 1000 },
    ).forEach((content, index) => {
      fields.push({
        name: `:tada: 中獎名單 第 ${index + 1} 頁`,
        value: content.replace(/\n/g, '、'),
      })
    })
    reactedMemberIds.length &&
      Util.splitMessage(
        reactedMemberIds.map(memberId => Util.escapeMarkdown(mentionedMembers[memberId].name.slice(0, 16))).join('\n'),
        { maxLength: 1000 },
      ).forEach((content, index) => {
        fields.push({
          name: `:sob: 無緣名單 第 ${index + 1} 頁`,
          value: content.replace(/\n/g, '、'),
        })
      })
  }

  return {
    response: {
      content: ':confetti_ball: 抽獎參與人數：REACTED_COUNT / ALL_COUNT (**PERCENTAGE%**)'
        .replace('REACTED_COUNT', `${reactedMemberCount}`)
        .replace('ALL_COUNT', `${allMembersCount}`)
        .replace('PERCENTAGE', ((reactedMemberCount * 100) / allMembersCount).toFixed(2)),
      embed: {
        description:
          '抽獎時間：`TIME` (FROM_NOW)\n抽獎目標：[訊息連結](MESSAGE_URL)\n標記人數：ALL_COUNT\n參與人數：REACTED_COUNT\n中獎人數：LUCKY_COUNT\n無緣人數：MISSED_COUNT'
            .replace('TIME', timeFormatter({ guildId: message.guild.id, time: raffleAt }))
            .replace('FROM_NOW', `<t:${Math.floor(raffleAt / 1000)}:R>`)
            .replace('MESSAGE_URL', message.url)
            .replace('ALL_COUNT', `${allMembersCount}`)
            .replace('REACTED_COUNT', `${reactedMemberCount}`)
            .replace('LUCKY_COUNT', `${luckyMemberIds.length}`)
            .replace('MISSED_COUNT', `${reactedMemberIds.length}`)
            .trim(),
        fields,
      },
      files,
    },
  }
}

export default commandRaffle
