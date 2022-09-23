import { escapeMarkdown, Message, SlashCommandBuilder } from 'discord.js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { CommandProps, JobProps, ResultProps } from '../types'
import cache, { database } from '../utils/cache'
import fetchTargetMessage from '../utils/fetchTargetMessage'
import getAllJobs from '../utils/getAllJobs'
import getReactionStatus from '../utils/getReactionStatus'
import parseTime from '../utils/parseTime'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const build = new SlashCommandBuilder()
  .setName('raffle')
  .setDescription('從一則訊息中被標記的人當中抽出有點選表情回應的成員')
  .setDescriptionLocalizations({
    'en-US': 'Random pick reacted and mentioned members from a message.',
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
  .addIntegerOption(option =>
    option
      .setName('count')
      .setDescription('中獎人數')
      .setDescriptionLocalizations({
        'en-US': 'The count of picked members.',
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
    message?: Message<true>
    time?: number
    count?: number
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

    const count = interaction.options.getInteger('count', true)
    if (count < 1) {
      return {
        content: translate('raffle.error.raffleCount', { guildId }),
      }
    }

    target.message = messageResult.message
    target.time = timeResult.time
    target.count = count
  }

  if (!target.message) {
    return
  }

  if (target.time) {
    if (target.time < interaction.createdTimestamp) {
      return {
        content: translate('raffle.error.raffleJobTime', { guildId }),
        embed: {
          description: translate('raffle.error.raffleJobTimeHelp', { guildId }).replace(
            '{TIMESTAMP}',
            `${Math.floor(target.time / 1000)}`,
          ),
        },
      }
    }

    const jobId = `raffle_${target.message.id}`
    const isDuplicated = !!cache.jobs[jobId]

    if (!isDuplicated) {
      let existedJobsCount = 0
      for (const jobId in cache.jobs) {
        const job = cache.jobs[jobId]
        if (job && job.clientId === clientId && jobId.startsWith('raffle_') && job.command.guildId === guildId) {
          existedJobsCount += 1
        }
      }
      if (existedJobsCount > 4) {
        return {
          content: translate('raffle.error.raffleJobLimit', { guildId }),
          embed: {
            description: translate('raffle.error.raffleJobLimitHelp', { guildId }).replace(
              '{RAFFLE_JOBS}',
              getAllJobs(clientId, guild, 'raffle'),
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
        raffleCount: target.count,
      },
      target: {
        messageId: target.message.id,
        channelId: target.message.channel.id,
      },
      retryTimes: 0,
    }
    await database.ref(`/jobs/${jobId}`).set(job)

    return {
      content: translate(isDuplicated ? 'raffle.text.raffleJobUpdated' : 'raffle.text.raffleJobCreated', { guildId })
        .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
        .replace('{JOB_ID}', jobId),
      embed: {
        description: translate('raffle.text.raffleJobDescription', { guildId })
          .replace('{JOB_ID}', jobId)
          .replace('{TIME}', timeFormatter({ time: target.time, guildId, format: 'yyyy-MM-dd HH:mm' }))
          .replace('{FROM_NOW}', `<t:${Math.floor(target.time / 1000)}:R>`)
          .replace('{TARGET_URL}', target.message.url)
          .replace('{RAFFLE_JOBS}', getAllJobs(clientId, guild, 'raffle')),
      },
    }
  }

  return getRaffleResult(target.message, { count: target.count })
}

export const getRaffleResult: (
  message: Message<true>,
  options?: {
    count?: number
  },
) => Promise<ResultProps | void> = async (message, options) => {
  const guildId = message.guild.id
  const raffleAt = Date.now()
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

  const reactedMemberCount = reactedMemberNames.length
  if (reactedMemberCount === 0) {
    return {
      content: translate('raffle.error.noReactedMembers', { guildId }),
      embed: {
        description: translate('raffle.error.noReactedMembersHelp', { guildId }),
      },
    }
  }

  for (let i = 0; i < reactedMemberCount - 1; i++) {
    const choose = Math.floor(Math.random() * i)
    ;[reactedMemberNames[i], reactedMemberNames[choose]] = [reactedMemberNames[choose], reactedMemberNames[i]]
  }
  const raffleCount = options?.count || 30
  const luckyMemberNames = reactedMemberNames.splice(0, raffleCount)

  const filePath = join(__dirname, '../../files/', `${message.id}.txt`)
  writeFileSync(
    filePath,
    translate('raffle.text.raffleResultFile', { guildId })
      .replace('{GUILD_NAME}', message.guild.name)
      .replace('{CHANNEL_NAME}', message.channel.name)
      .replace('{TIME}', timeFormatter({ time: raffleAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
      .replace('{MESSAGE_URL}', message.url)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{REACTED_COUNT}', `${reactedMemberNames.length}`)
      .replace('{PERCENTAGE}', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
      .replace('{LUCKY_MEMBERS}', luckyMemberNames.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{REACTED_MEMBERS}', reactedMemberNames.map((v, i) => `${i + 1}. ${v}`).join('\r\n'))
      .replace('{ABSENT_MEMBERS}', absentMemberNames.join('\r\n'))
      .replace('{LOCKED_MEMBERS}', lockedMemberNames.join('\r\n')),
    { encoding: 'utf8' },
  )

  const warnings: string[] = []
  if (lockedMemberNames.length) {
    warnings.push(
      translate('check.text.lockedMembersWarning', { guildId }).replace('{COUNT}', `${lockedMemberNames.length}`),
    )
  }

  return {
    content: translate('raffle.text.raffleResult', { guildId })
      .replace('{REACTED_COUNT}', `${reactedMemberNames.length}`)
      .replace('{ALL_COUNT}', `${allMembersCount}`)
      .replace('{PERCENTAGE}', ((reactedMemberNames.length * 100) / allMembersCount).toFixed(2))
      .trim(),
    embed: {
      description: translate('raffle.text.raffleResultDescription', { guildId })
        .replace('{TIME}', timeFormatter({ time: raffleAt, guildId, format: 'yyyy-MM-dd HH:mm' }))
        .replace('{FROM_NOW}', `<t:${Math.floor(raffleAt / 1000)}:R>`)
        .replace('{MESSAGE_URL}', message.url)
        .replace('{ALL_COUNT}', `${allMembersCount}`)
        .replace('{REACTED_COUNT}', `${reactedMemberCount}`)
        .replace('{LUCKY_COUNT}', `${luckyMemberNames.length}`)
        .replace('{MISSED_COUNT}', `${reactedMemberNames.length}`)
        .replace('{ABSENT_COUNT}', `${absentMemberNames.length}`)
        .replace('{WARNINGS}', warnings.join('\n'))
        .trim(),
    },
    files: [
      {
        attachment: filePath,
        name: `raffle-${message.id}.txt`,
      },
    ],
  }
}

const command: CommandProps = {
  build,
  exec,
}

export default command
