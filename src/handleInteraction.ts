import { ChatInputCommandInteraction, Interaction, MessageContextMenuCommandInteraction } from 'discord.js'
import OpenColor from 'open-color' with { type: 'json' }
import cache, { commands } from './helper/cache.js'
import initGuild from './helper/initGuild.js'
import sendLog from './helper/sendLog.js'
import { ResultProps, isKeyValueProps } from './types.js'
import colorFormatter from './utils/colorFormatter.js'
import timeFormatter from './utils/timeFormatter.js'
import { isTranslateKey, translate } from './utils/translation.js'

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
  } catch (error) {
    await cache.logChannel?.send({
      content: '[`{TIME}`] Error: init guild {GUILD_ID}'
        .replace('{TIME}', timeFormatter({ time: interaction.createdTimestamp }))
        .replace('{GUILD_ID}', guildId),
      embeds: [
        {
          color: colorFormatter(OpenColor.red[5]),
          description: `\`\`\`${error instanceof Error ? error.stack : error}\`\`\``,
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

    const commandResult = await executeCommand(interaction)
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

    interaction.commandName === 'check' || interaction.commandName === 'raffle'
      ? await interaction.editReply(responseOptions)
      : await interaction.reply({ ...responseOptions, fetchReply: true })

    await sendLog({
      command: {
        createdAt: createdTimestamp,
        content: interaction.isMessageContextMenuCommand()
          ? `/${interaction.commandName} target:${interaction.targetMessage.url} (context menu)`
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
  } catch (error) {
    await sendLog({
      command: {
        createdAt: createdTimestamp,
        content: interaction.isMessageContextMenuCommand()
          ? `/${interaction.commandName} target:${interaction.targetMessage.url} (context menu)`
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
        content: 'Error to handle interaction',
      },
      error: error as Error,
    })
  }

  cache.isProcessing[guildId] = false
  cache.isCooling[guildId] = true
  setTimeout(() => {
    cache.isCooling[guildId] = false
  }, 5000)
}

const executeCommand: (
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
) => Promise<ResultProps | void> = async (interaction) => {
  const { guildId } = interaction
  if (!guildId) {
    return
  }

  try {
    return await commands[interaction.commandName]?.exec(interaction)
  } catch (error) {
    if (error instanceof Error && isTranslateKey(`error.text.${error.message}`)) {
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
        error: error as Error,
      }
    }
  }
}

export default handleInteraction
