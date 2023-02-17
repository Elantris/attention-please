import { Guild, GuildTextBasedChannel, Message } from 'discord.js'
import { translate } from './translation'

const fetchTargetMessage: (options: { guild: Guild; search: string }) => Promise<Message<true>> = async ({
  guild,
  search,
}) => {
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
  } else if (/^\d+-\d+$/.test(search)) {
    // channel id - message id
    const [channelId, messageId] = search.split('-')
    target.channelId = channelId
    target.messageId = messageId
  } else if (/^\d+$/.test(search)) {
    // message id
    target.messageId = search
  }

  if (!target.messageId) {
    throw new Error('INVALID_MESSAGE_FORMAT')
  }

  if (target.channelId) {
    const targetChannel = guild.channels.cache.get(target.channelId)
    const clientMember = guild.members.cache.get(guild.client.user.id)

    if (targetChannel?.isTextBased() && clientMember) {
      if (!targetChannel.permissionsFor(clientMember).has(['ViewChannel', 'ReadMessageHistory'])) {
        throw new Error('NO_PERMISSION_IN_CHANNEL', {
          cause: {
            CHANNEL_ID: target.channelId,
            PERMISSIONS: ['ViewChannel', 'ReadMessageHistory']
              .map((v, i) => `${i + 1}. ${translate(`permission.label.${v}`, { guildId: guild.id })}`)
              .join('\n'),
          },
        })
      }
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
    throw new Error('UNKNOWN_MESSAGE', {
      cause: {
        USER_INPUT: search,
      },
    })
  }

  if (
    !target.message.mentions.everyone &&
    !target.message.mentions.roles.size &&
    !target.message.mentions.members?.size
  ) {
    throw new Error('NO_MENTIONED_MEMBER', {
      cause: {
        MESSAGE_LINK: target.message.url,
      },
    })
  }

  return target.message
}

export default fetchTargetMessage
