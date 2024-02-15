import { Guild, GuildTextBasedChannel, Message } from 'discord.js'
import appConfig from '../appConfig'
import initGuild from './initGuild'

const fetchTargetMessage: (options: { guild: Guild; search: string }) => Promise<Message<true>> = async ({
  guild,
  search,
}) => {
  const target: {
    guildId?: string
    channelId?: string
    messageId?: string
    message?: Message<true>
  } = {}

  if (/^https:\/\/\S*\/channels\/\d+\/\d+\/\d+$/.test(search)) {
    // full message link
    const [guildId, channelId, messageId] = search.split('/').slice(-3)
    target.guildId = guildId
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

  const targetGuild =
    guild.id === appConfig.DISCORD.ADMIN_GUILD_ID && target.guildId
      ? guild.client.guilds.cache.get(target.guildId)
      : guild

  if (!targetGuild) {
    throw new Error('UNKNOWN_MESSAGE', {
      cause: {
        USER_INPUT: search,
      },
    })
  }

  await initGuild(guild.client, targetGuild.id)

  if (target.channelId) {
    const targetChannel = targetGuild.channels.cache.get(target.channelId)
    const clientMember = targetGuild.members.cache.get(targetGuild.client.user.id)

    if (targetChannel?.isTextBased() && clientMember) {
      if (!targetChannel.permissionsFor(clientMember).has(['ViewChannel', 'ReadMessageHistory'])) {
        throw new Error('NO_PERMISSION_IN_CHANNEL', {
          cause: {
            CHANNEL_ID: target.channelId,
          },
        })
      }
      try {
        target.message = await targetChannel.messages.fetch({
          message: target.messageId,
          cache: false,
          force: true,
        })
      } catch {}
    }
  } else {
    const guildChannels: GuildTextBasedChannel[] = []
    targetGuild.channels.cache.forEach((channel) => {
      if (channel.isTextBased()) {
        guildChannels.push(channel)
      }
    })
    if (guildChannels.length > 10) {
      throw new Error('TOO_MANY_TEXT_CHANNELS')
    }
    for (const channel of guildChannels) {
      try {
        target.message = await channel.messages.fetch({
          message: target.messageId,
          cache: false,
          force: true,
        })
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
