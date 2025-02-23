import { escapeMarkdown, Guild } from 'discord.js'
import cache from './helper/cache.js'
import timeFormatter from './utils/timeFormatter.js'

export const handleGuildCreate = async (guild: Guild) => {
  if (!cache.isReady) {
    return
  }

  const count = {
    textChannels: 0,
    voiceChannels: 0,
    threads: 0,
    members: 0,
    bots: 0,
  }

  guild.channels.cache.forEach((channel) => {
    if (channel.isVoiceBased()) {
      count.voiceChannels++
    } else if (channel.isThread()) {
      count.threads++
    } else if (channel.isTextBased()) {
      count.textChannels++
    }
  })

  await guild.members.fetch()
  const owner = await guild.fetchOwner()
  guild.members.cache.forEach((member) => {
    if (member.user.bot) {
      count.bots++
    } else {
      count.members++
    }
  })

  cache.logChannel?.send({
    content: '[`{TIME}`] Guild Create'.replace('{TIME}', timeFormatter({ time: guild.joinedTimestamp })),
    embeds: [
      {
        description:
          'Guild: `{GUILD_ID}` {GUILD_NAME} <t:{GUILD_FROM_NOW}:R> ({GUILD_COUNT})\nOwner: `{OWNER_ID}` {OWNER_NAME} <t:{OWNER_FROM_NOW}:R>\nChannels: {CHANNELS_COUNT}\nMembers: {MEMBERS_COUNT}'
            .replace('{GUILD_ID}', guild.id)
            .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
            .replace('{GUILD_FROM_NOW}', `${Math.floor(guild.createdTimestamp / 1000)}`)
            .replace('{GUILD_COUNT}', `${guild.client.guilds.cache.size}`)
            .replace('{OWNER_ID}', owner.id)
            .replace('{OWNER_NAME}', escapeMarkdown(owner.user.tag))
            .replace('{OWNER_FROM_NOW}', `${Math.floor(owner.user.createdTimestamp / 1000)}`)
            .replace(
              '{CHANNELS_COUNT}',
              `Text(${count.textChannels})/ Thread(${count.threads}) / Voice(${count.voiceChannels})`,
            )
            .replace('{MEMBERS_COUNT}', `Member(${count.members}) / Bot(${count.bots})`),
      },
    ],
  })
}

export const handleGuildDelete = async (guild: Guild) => {
  await cache.logChannel?.send({
    content: '[`{TIME}`] Guild Delete.'.replace('{TIME}', timeFormatter()),
    embeds: [
      {
        description: 'Guild: `{GUILD_ID}` {GUILD_NAME} ({GUILD_COUNT})'
          .replace('{GUILD_ID}', guild.id)
          .replace('{GUILD_NAME}', escapeMarkdown(guild?.name || guild.id))
          .replace('{GUILD_COUNT}', `${guild.client.guilds.cache.size}`),
      },
    ],
  })
}
