import { ChannelType, Client, REST, Routes } from 'discord.js'
import appConfig from './appConfig'
import cache, { commandBuildData } from './utils/cache'
import executeJobs from './utils/executeJobs'
import timeFormatter from './utils/timeFormatter'

const handleReady = async (client: Client<true>) => {
  const logChannel = client.channels.cache.get(appConfig.DISCORD.LOG_CHANNEL_ID)
  if (logChannel?.type !== ChannelType.GuildText) {
    process.exit(-1)
  }
  cache.logChannel = logChannel

  // register commands
  const rest = new REST({ version: '10' }).setToken(appConfig.DISCORD.TOKEN)
  try {
    await rest.put(Routes.applicationCommands(appConfig.DISCORD.CLIENT_ID), { body: commandBuildData })
  } catch (error) {
    await logChannel.send(
      `\`${timeFormatter()}\` Register slash commands error\n\`\`\`${
        error instanceof Error ? error.stack : error
      }\`\`\``,
    )
  }

  logChannel.send(`\`${timeFormatter()}\` ${client.user.tag}`)

  setInterval(() => {
    client.user?.setActivity(`on ${client.guilds.cache.size} guilds.`)
    executeJobs(client)
  }, 10000)

  cache.isReady = true
}

export default handleReady
