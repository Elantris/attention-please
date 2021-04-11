import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const parseBoolean = (value: string) => !(value === 'false' || value === '0' || value === 'off')

const defaultSettings: {
  [key: string]: string | number | boolean
} = {
  prefix: 'ap!',
  timezone: 8,
  showReacted: false,
  showAbsent: true,
  mentionAbsent: false,
  allowRemind: false
}
const settingKeyName: {
  [key: string]: string
} = {
  prefix: '指令前綴',
  timezone: '時區',
  showReacted: '顯示已簽到名單',
  showAbsent: '顯示未簽到名單',
  mentionAbsent: '標記未簽到成員',
  allowRemind: '啟用提醒功能'
}

const commandSettings: CommandProps = async ({ guildId, args }) => {
  const settingKey = args[1]
  const settingValues = args[2]

  if (!settingKey) {
    return {
      content: ':gear: `GUILD_ID` 全部設定'.replace('GUILD_ID', guildId),
      embed: {
        fields: Object.keys(defaultSettings).map(key => ({
          name: `${settingKeyName[key]} \`${key}\``,
          value: cache.settings[guildId]?.[key] ?? `${defaultSettings[key]} (預設)`,
          inline: true,
        })),
      },
    }
  }

  if (typeof defaultSettings[settingKey] === undefined) {
    return {
      content: ':question: 沒有這個設定項目',
      isSyntaxError: true,
    }
  }

  if (!settingValues) {
    await database.ref(`/settings/${guildId}/${settingKey}`).remove()
    return {
      content: ':gear: `GUILD_ID` 設定項目 **KEY** 已重設為預設值：`VALUE`'
        .replace('GUILD_ID', guildId)
        .replace('KEY', settingKey)
        .replace('VALUE', `${defaultSettings[settingKey]}`),
    }
  }

  let newValue: string | number | boolean =
    typeof defaultSettings[settingKey] === 'string'
      ? settingValues
      : typeof defaultSettings[settingKey] === 'number'
      ? parseInt(settingValues)
      : parseBoolean(settingValues)

  if (typeof defaultSettings[settingKey] === 'number' && Number.isNaN(newValue)) {
    return {
      content: ':x: 設定項目必須為數字',
    }
  }

  await database.ref(`/settings/${guildId}/${settingKey}`).set(newValue)

  return {
    content: ':gear: `GUILD_ID` 設定項目 **KEY** 已變更為 `VALUE`'
      .replace('GUILD_ID', guildId)
      .replace('KEY', settingKey)
      .replace('VALUE', `${newValue}`),
  }
}

export default commandSettings
