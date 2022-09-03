import { Client } from 'discord.js'
import appConfig from './appConfig'
import handleInteraction from './handleInteraction'
import handleReady from './handleReady'

const client = new Client({
  intents: ['Guilds', 'GuildMembers'],
})

client.on('interactionCreate', interaction => handleInteraction(interaction))
client.on('ready', client => handleReady(client))

client.login(appConfig.DISCORD.TOKEN)
