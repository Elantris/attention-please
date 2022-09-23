import { Guild, GuildTextBasedChannel, Message } from 'discord.js'
import { ResultProps } from '../types'
import { translate } from './translation'

const fetchTargetMessage: (options: { guild: Guild; search: string }) => Promise<{
  message?: Message<true>
  response?: ResultProps
}> = async ({ guild, search }) => {
  const target: {
    channelId?: string
    messageId?: string
    message?: Message<true>
  } = {}

  if (/^https:\/\/\S*\/channels\/\d+\/\d+\/\d+$/.test(search)) {
    // full message link
    const [channelId, messageId] = search.split('/').slice(-2)
    target.channelId = channelId
    target.messageId = messageId
  } else if (/^\d+\-\d+$/.test(search)) {
    // channel id - message id
    const [channelId, messageId] = search.split('-')
    target.channelId = channelId
    target.messageId = messageId
  } else if (/^\d+$/.test(search)) {
    // message id
    target.messageId = search
  }

  if (!target.messageId) {
    return {
      response: {
        content: translate('system.error.messageFormat', { guildId: guild.id }),
        embed: {
          description: translate('system.error.messageFormatHelp', { guildId: guild.id }),
        },
      },
    }
  }

  if (target.channelId) {
    const targetChannel = guild.channels.cache.get(target.channelId)
    if (targetChannel?.isTextBased()) {
      try {
        target.message = await targetChannel.messages.fetch(target.messageId)
      } catch {}
    }
  } else {
    const guildChannels: GuildTextBasedChannel[] = []
    guild.channels.cache.forEach(channel => {
      if (channel.isTextBased()) {
        guildChannels.push(channel)
      }
    })
    for (const channel of guildChannels) {
      try {
        target.message = await channel.messages.fetch(target.messageId)
        break
      } catch {}
    }
  }

  if (!target.message) {
    return {
      response: {
        content: translate('system.error.unknownMessage', { guildId: guild.id }),
        embed: {
          description: translate('system.error.unknownMessageHelp', { guildId: guild.id }).replace(
            '{USER_INPUT}',
            search,
          ),
        },
      },
    }
  }

  if (
    !target.message.mentions.everyone &&
    !target.message.mentions.roles.size &&
    !target.message.mentions.members?.size
  ) {
    return {
      response: {
        content: translate('system.error.noMentionedMember', { guildId: guild.id }),
        embed: {
          description: translate('system.error.noMentionedMemberHelp', { guildId: guild.id }).replace(
            '{MESSAGE_LINK}',
            target.message.url,
          ),
        },
      },
    }
  }

  return {
    message: target.message,
  }
}

export default fetchTargetMessage
