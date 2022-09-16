import { ChannelType, ChatInputCommandInteraction, Interaction } from 'discord.js'
import OpenColor from 'open-color'
import cache, { commands } from './utils/cache'
import colorFormatter from './utils/colorFormatter'
import initGuild from './utils/initGuild'
import sendLog from './utils/sendLog'
import timeFormatter from './utils/timeFormatter'
import { translate } from './utils/translation'

const handleInteraction = async (interaction: Interaction) => {
  const guildId = interaction.guildId
  const guild = interaction.guild
  if (!guildId || !guild || cache.isCooling[guildId] || cache.isProcessing[guildId]) {
    return
  }

  cache.isProcessing[guildId] = true

  try {
    await initGuild(interaction.client, guildId)
  } catch (error: any) {
    cache.logChannel?.send({
      content: '[`{TIME}`] Error: init guild {GUILD_ID}'
        .replace('{TIME}', timeFormatter({ time: interaction.createdTimestamp }))
        .replace('{GUILD_ID}', guildId),
      embeds: [
        {
          color: colorFormatter(OpenColor.red[5]),
          description: '```{ERROR}```'.replace('{ERROR}', error),
        },
      ],
    })
    cache.isProcessing[guildId] = false
    return
  }

  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction)
    }
  } catch (error: any) {
    cache.logChannel?.send({
      content: '[`{TIME}`] Error: `{COMMAND}`'
        .replace('{TIME}', timeFormatter({ time: interaction.createdTimestamp }))
        .replace('{COMMAND}', `${interaction}`),
      embeds: [
        {
          color: colorFormatter(OpenColor.red[5]),
          description: '```{ERROR}```'.replace('{ERROR}', error),
        },
      ],
    })
  }

  cache.isProcessing[guildId] = false

  cache.isCooling[guildId] = true
  setTimeout(() => {
    cache.isCooling[guildId] = false
  }, 5000)
}

const handleChatInputCommand = async (interaction: ChatInputCommandInteraction) => {
  const guildId = interaction.guildId
  const guild = interaction.guild
  const channel = interaction.channel
  const createdTimestamp = interaction.createdTimestamp
  if (!guildId || !guild || !channel || channel.type === ChannelType.DM) {
    return
  }

  if (interaction.commandName === 'check') {
    await interaction.deferReply()
  }

  const commandResult = await commands[interaction.commandName]?.exec(interaction)
  if (!commandResult) {
    return
  }

  const responseOptions = {
    content: commandResult.content,
    embeds: commandResult.embed
      ? [
          {
            color: colorFormatter(OpenColor.orange[5]),
            title: translate('system.text.support', { guildId }),
            url: 'https://discord.gg/Ctwz4BB',
            footer: { text: 'Version 2022-09-14' },
            ...commandResult.embed,
          },
        ]
      : undefined,
    files: commandResult.files,
  }
  const responseMessage =
    interaction.commandName === 'check'
      ? await interaction.editReply(responseOptions)
      : await interaction.reply({
          ...responseOptions,
          fetchReply: true,
        })

  await sendLog({
    command: {
      createdAt: interaction.createdTimestamp,
      content: `${interaction}`,
      guildId,
      guildName: guild.name,
      channelId: interaction.channelId,
      channelName: channel.name,
      userId: interaction.user.id,
      userName: interaction.user.tag,
    },
    result: {
      createdAt: responseMessage.editedTimestamp || responseMessage.createdTimestamp,
      content: commandResult.content,
      embed: commandResult.embed,
      files: commandResult.files,
    },
  })
}

export default handleInteraction
