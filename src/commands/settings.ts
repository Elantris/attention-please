import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const defaultSettings: {
  [key: string]: string
} = {
  prefix: 'ap!',
  timezone: '0',
}

const commandSettings: CommandProps = async (message, { guildId, args }) => {
  const settingKey = args[1]
  const settingValues = args.slice(2)

  if (!settingKey) {
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

  if (!defaultSettings[settingKey]) {
    return {
      content: ':question: 沒有這個設定項目',
      isSyntaxError: true,
    }
  }

  if (settingValues.length === 0) {
    await database.ref(`/settings/${guildId}/${settingKey}`).remove()
    return {
      content: ':gear: `GUILD_ID` 設定項目 **KEY** 已重設為預設值：`VALUE`'
        .replace('GUILD_ID', guildId)
        .replace('KEY', settingKey)
        .replace('VALUE', defaultSettings[settingKey]),
    }
  }

  const newValue = settingValues.join(' ')
  await database.ref(`/settings/${guildId}/${settingKey}`).set(newValue)

  return {
    content: ':gear: `GUILD_ID` 設定項目 **KEY** 已變更為 `VALUE`'
      .replace('GUILD_ID', guildId)
      .replace('KEY', settingKey)
      .replace('VALUE', newValue),
  }
}

export default commandSettings
