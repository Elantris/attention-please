import { Client, Events, GatewayIntentBits } from 'discord.js'
import appConfig from './appConfig'
import { handleGuildCreate, handleGuildDelete } from './handleGuild'
import handleInteraction from './handleInteraction'
import handleReady from './handleReady'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
})

client.on(Events.InteractionCreate, interaction => handleInteraction(interaction))
client.on(Events.ClientReady, client => handleReady(client))
client.on(Events.GuildCreate, guild => handleGuildCreate(guild))
client.on(Events.GuildDelete, guild => handleGuildDelete(guild))

client.login(appConfig.DISCORD.TOKEN)
