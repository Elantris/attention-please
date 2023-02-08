import {
  ApplicationCommandType,
  ChatInputCommandInteraction,
  Interaction,
  MessageContextMenuCommandInteraction,
} from 'discord.js'
import OpenColor from 'open-color'
import { isKeyValueProps, ResultProps } from './types'
import cache, { commands } from './utils/cache'
import colorFormatter from './utils/colorFormatter'
import initGuild from './utils/initGuild'
import sendLog from './utils/sendLog'
import timeFormatter from './utils/timeFormatter'
import { isTranslateKey, translate } from './utils/translation'

const handleInteraction = async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) {
    return
  }

  const { guildId, guild, channel, createdTimestamp } = interaction
  if (
    !guildId ||
    !guild ||
    !channel ||
    channel.isDMBased() ||
    cache.isCooling[guildId] ||
    cache.isProcessing[guildId]
  ) {
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
    if (interaction.commandName === 'check' || interaction.commandName === 'raffle') {
      await interaction.deferReply()
    }

    const commandResult = await handleCommand(interaction)
    if (!commandResult) {
      cache.isProcessing[guildId] = false
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
              footer: { text: cache.footer },
              ...commandResult.embed,
            },
          ]
        : undefined,
      files: commandResult.files,
    }
    const responseMessage =
      interaction.commandName === 'check' || interaction.commandName === 'raffle'
        ? await interaction.editReply(responseOptions)
        : await interaction.reply({ ...responseOptions, fetchReply: true })

    await sendLog({
      command: {
        createdAt: createdTimestamp,
        content:
          interaction.commandType === ApplicationCommandType.Message
            ? `/${interaction.commandName} target:${interaction.targetMessage.url}`
            : `${interaction}`,
        guildId,
        guildName: guild.name,
        channelId: interaction.channelId,
        channelName: channel.name,
        userId: interaction.user.id,
        userName: interaction.user.tag,
      },
      result: {
        createdAt: Date.now(),
        content: commandResult.content,
        embed: commandResult.embed,
        files: commandResult.files,
      },
      error: commandResult.error,
    })
  } catch (error: any) {
    cache.logChannel?.send({
      content: '[`{TIME}`] Error: `{COMMAND}`'
        .replace('{TIME}', timeFormatter({ time: interaction.createdTimestamp }))
        .replace(
          '{COMMAND}',
          interaction.commandType === ApplicationCommandType.Message
            ? `/${interaction.commandName} target:${interaction.targetMessage.url} (context menu)`
            : `${interaction}`,
        ),
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

const handleCommand: (
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
) => Promise<ResultProps | void> = async interaction => {
  const guildId = interaction.guildId
  if (!guildId) {
    return
  }

  try {
    return await commands[interaction.commandName]?.exec(interaction)
  } catch (error: any) {
    if (!(error instanceof Error)) {
      return
    }

    if (isTranslateKey(`error.text.${error.message}`)) {
      let errorHelp = isTranslateKey(`error.help.${error.message}`)
        ? translate(`error.help.${error.message}`, { guildId })
        : ''
      if (errorHelp && isKeyValueProps(error.cause)) {
        for (const key in error.cause) {
          errorHelp = errorHelp.replace(`{${key}}`, error.cause[key])
        }
      }

      return {
        content: translate(`error.text.${error.message}`, { guildId }),
        embed: errorHelp ? { description: errorHelp } : undefined,
      }
    } else {
      return {
        content: translate('error.text.UNKNOWN_ERROR', { guildId }),
        embed: { description: translate('error.help.UNKNOWN_ERROR', { guildId }) },
        error,
      }
    }
  }
}

export default handleInteraction
