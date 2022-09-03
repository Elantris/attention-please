import { Client } from 'discord.js'
import cache, { database } from './cache'

const initGuild = async (client: Client, guildId: string) => {
  const guild = client.guilds.cache.get(guildId)
  if (!guild) {
    return
  }

  await guild.members.fetch()
  cache.settings[guildId] = (await database.ref(`/settings/${guildId}`).once('value')).val() || {}
  cache.isInit[guildId] = true
}

export default initGuild
