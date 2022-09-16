import { escapeMarkdown, Guild } from 'discord.js'
import cache from './utils/cache'
import initGuild from './utils/initGuild'
import timeFormatter from './utils/timeFormatter'

const handleGuild = async (guild: Guild, action: 'create' | 'delete') => {
  if (!cache.isReady) {
    return
  }

  await initGuild(guild.client, guild.id)

  const count = {
    textChannels: 0,
    voiceChannels: 0,
    threads: 0,
    members: 0,
    bots: 0,
  }

  guild.channels.cache.forEach(channel => {
    if (channel.isVoiceBased()) {
      count.voiceChannels++
    } else if (channel.isThread()) {
      count.threads++
    } else if (channel.isTextBased()) {
      count.textChannels++
    }
  })

  guild.members.cache.forEach(member => {
    if (member.user.bot) {
      count.bots++
    } else {
      count.members++
    }
  })

  const owner = await guild.fetchOwner()

  cache.logChannel?.send({
    content: (action === 'create' ? '[`{TIME}`] Joined new guild.' : '[`{TIME}`] Leaved guild.').replace(
      '{TIME}',
      timeFormatter({ time: guild.joinedTimestamp }),
    ),
    embeds: [
      {
        description:
          'Guild: `{GUILD_ID}` **{GUILD_NAME}**\nCreated: `{CREATED_AT}` <t:{FROM_NOW}:R>\nOwner: `{OWNER_ID}` {OWNER_NAME} <t:{OWNER_FROM_NOW}:R>\nChannels: {CHANNELS_COUNT}\nMembers: {MEMBERS_COUNT}'
            .replace('{GUILD_ID}', guild.id)
            .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
            .replace('{CREATED_AT}', timeFormatter({ time: guild.createdTimestamp }))
            .replace('{FROM_NOW}', `${Math.floor(guild.createdTimestamp / 1000)}`)
            .replace('{OWNER_ID}', owner.id)
            .replace('{OWNER_NAME}', escapeMarkdown(owner.user.tag))
            .replace('{OWNER_FROM_NOW}', `${Math.floor(owner.user.createdTimestamp / 1000)}`)
            .replace(
              '{CHANNELS_COUNT}',
              `Text(${count.textChannels})/ Thread(${count.threads}) / Voice(${count.voiceChannels})`,
            )
            .replace('{MEMBERS_COUNT}', `Member${count.members} / Bot(${count.bots})`),
      },
    ],
  })
}

export default handleGuild
