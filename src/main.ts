import { Client } from 'discord.js'
import config from './config'

const client = new Client()

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`)
})

client.login(config.DISCORD.TOKEN)
