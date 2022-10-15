import { Client } from 'discord.js'
import appConfig from './appConfig'
import { handleGuildCreate, handleGuildDelete } from './handleGuild'
import handleInteraction from './handleInteraction'
import handleReady from './handleReady'

const client = new Client({
  intents: ['Guilds', 'GuildMembers'],
})

client.on('interactionCreate', interaction => handleInteraction(interaction))
client.on('ready', client => handleReady(client))
client.on('guildCreate', guild => handleGuildCreate(guild))
client.on('guildDelete', guild => handleGuildDelete(guild))

client.login(appConfig.DISCORD.TOKEN)
