import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const defaultSettings: {
  [key: string]: string
} = {
  prefix: 'ap!',
  timezone: '0',
}

const commandSettings: CommandProps = async (message, { guildId, args }) => {
  if (args.length === 0) {
    return {
      content: ':gear: `GUILD_ID` 全部設定'.replace('GUILD_ID', guildId),
      embed: {
        title: 'Join eeBots Support',
        url: 'https://discord.gg/Ctwz4BB',
        fields: Object.keys(defaultSettings).map(key => ({
          name: key,
          value: cache.settings[guildId]?.[key] || `${defaultSettings[key]} (預設)`,
          inline: true,
        })),
      },
    }
  }

  if (!defaultSettings[args[0]]) {
    return {
      content: ':question: 沒有這個設定項目',
      isSyntaxError: true,
    }
  }

  if (args.length === 1) {
    await database.ref(`/settings/${guildId}/${args[0]}`).remove()
    return {
      content: ':gear: `GUILD_ID` 設定項目 **KEY** 已重設為預設值：`VALUE`'
        .replace('GUILD_ID', guildId)
        .replace('KEY', args[0])
        .replace('VALUE', defaultSettings[args[0]]),
    }
  }

  const newValue = args.slice(1).join(' ')
  await database.ref(`/settings/${guildId}/${args[0]}`).set(newValue)

  return {
    content: ':gear: `GUILD_ID` 設定項目 **KEY** 已變更為 `VALUE`'
      .replace('GUILD_ID', guildId)
      .replace('KEY', args[0])
      .replace('VALUE', newValue),
  }
}

export default commandSettings
