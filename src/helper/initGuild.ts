import { Client } from 'discord.js'
import { reactionStatusLabels } from '../types.js'
import cache, { database } from './cache.js'

const initGuild = async (client: Client, guildId: string) => {
  if (Date.now() < (cache.isInit[guildId] || 0)) {
    return
  }

  const guild = client.guilds.cache.get(guildId)
  if (!guild) {
    return
  }

  await guild.members.fetch()
  await guild.roles.fetch()
  cache.settings[guildId] = (await database.ref(`/settings/${guildId}`).once('value')).val() || {}
  cache.isInit[guildId] = Date.now() + 600000

  for (const reactionStatus of reactionStatusLabels) {
    cache.settings[guildId][reactionStatus] = cache.settings[guildId][reactionStatus] ?? true
  }
}

export default initGuild
