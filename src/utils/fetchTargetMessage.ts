import { Message, TextChannel, Util } from 'discord.js'
import { DateTime } from 'luxon'
import { ResponseProps } from '../types'
import cache from './cache'
import timeFormatter from './timeFormatter'
import { translate } from './translation'

const fetchTargetMessage: (options: { message: Message; guildId: string; args: string[] }) => Promise<{
  targetMessage?: Message
  time?: number
  response?: ResponseProps
}> = async ({ message, guildId, args }) => {
  const search = message.reference?.messageId || args[1]
  if (!search) {
    return {
      response: {
        content: translate('system.error.unknownMessage', { guildId }),
        embed: {
          description: translate('system.error.unknownMessageHelp', { guildId }),
        },
      },
    }
  }

  const options: {
    channelId?: string
    messageId?: string
    time?: string
  } = {}

  if (message.reference?.messageId) {
    // reply reference
    options.channelId = message.reference.channelId
    options.messageId = message.reference.messageId
    options.time = args.slice(1).join(' ')
  } else if (/^https:\/\/\S*\/channels\/\d+\/\d+\/\d+$/.test(search)) {
    // full message link
    const [channelId, messageId] = search.split('/').slice(-2)
    options.channelId = channelId
    options.messageId = messageId
    options.time = args.slice(2).join(' ')
  } else if (/^\d+\-\d+$/.test(search)) {
    // channel id - message id
    const [channelId, messageId] = search.split('-')
    options.channelId = channelId
    options.messageId = messageId
    options.time = args.slice(2).join(' ')
  } else if (/^\d+$/.test(search)) {
    // message id
    options.messageId = search
    options.time = args.slice(2).join(' ')
  }

  if (!options.messageId) {
    return {
      response: {
        content: translate('system.error.targetMessageSyntax', { guildId }),
        embed: {
          description: translate('system.error.targetMessageSyntaxHelp', { guildId }),
        },
      },
    }
  }

  let targetMessage: Message | undefined = undefined
  if (options.channelId) {
    const targetChannel = message.client.channels.cache.get(options.channelId)
    if (targetChannel instanceof TextChannel) {
      targetMessage = await targetChannel.messages.fetch(options.messageId)
    }
  } else {
    const guildChannels: TextChannel[] = []
    message.guild?.channels.cache.forEach(channel => {
      if (channel instanceof TextChannel) {
        guildChannels.push(channel)
      }
    })
    for (const channel of guildChannels) {
      try {
        targetMessage = await channel.messages.fetch(options.messageId)
        break
      } catch {}
    }
  }

  if (targetMessage?.guild?.id !== guildId) {
    return {
      response: {
        content: translate('system.error.notFoundMessage', { guildId }),
        embed: {
          description: translate('system.error.notFoundMessageHelp', { guildId }),
        },
      },
    }
  }

  if (!targetMessage.mentions.everyone && !targetMessage.mentions.roles.size && !targetMessage.mentions.members?.size) {
    return {
      response: {
        content: translate('system.error.noMentionedMember', { guildId }),
        embed: {
          description: translate('system.error.noMentionedMemberHelp', { guildId }),
        },
      },
    }
  }

  let time: number | undefined = undefined
  if (options.time) {
    time = DateTime.fromFormat(options.time, 'yyyy-MM-dd HH:mm', {
      zone: cache.settings[guildId]?.timezone || 'Asia/Taipei',
    }).toMillis()

    if (Number.isNaN(time)) {
      return {
        response: {
          content: translate('system.error.timeFormatSyntax', { guildId }),
          embed: {
            description: translate('system.error.timeFormatSyntaxHelp, {guildId}')
              .replace('USER_INPUT', Util.escapeMarkdown(options.time))
              .replace('TIME', timeFormatter({ guildId, time: message.createdTimestamp })),
          },
        },
      }
    }
  }

  return {
    targetMessage,
    time,
  }
}

export default fetchTargetMessage
