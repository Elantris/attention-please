import { Client, Events, GatewayIntentBits } from 'discord.js'
import appConfig from './appConfig.js'
import { handleGuildCreate, handleGuildDelete } from './handleGuild.js'
import handleInteraction from './handleInteraction.js'
import handleReady from './handleReady.js'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
})

client.on(Events.InteractionCreate, handleInteraction)
client.on(Events.ClientReady, handleReady)
client.on(Events.GuildCreate, handleGuildCreate)
client.on(Events.GuildDelete, handleGuildDelete)

client.login(appConfig.DISCORD.TOKEN)
