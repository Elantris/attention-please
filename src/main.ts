import { Client } from 'discord.js'
import appConfig from './appConfig'
import handleGuild from './handleGuild'
import handleInteraction from './handleInteraction'
import handleReady from './handleReady'

const client = new Client({
  intents: ['Guilds', 'GuildMembers'],
})

client.on('interactionCreate', interaction => handleInteraction(interaction))
client.on('ready', client => handleReady(client))
client.on('guildCreate', guild => handleGuild(guild, 'create'))
client.on('guildDelete', guild => handleGuild(guild, 'delete'))

client.login(appConfig.DISCORD.TOKEN)
