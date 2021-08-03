import { CommandProps, SettingKey } from '../types'
import cache, { database } from '../utils/cache'

const defaultSettings: {
  [key in SettingKey]?: string | number | boolean
} = {
  prefix: 'ap!',
  timezone: 8,
  enableRemind: false,
  showReacted: false,
  showAbsent: true,
}
const settingKeyName: {
  [key in SettingKey]?: string
} = {
  prefix: '指令前綴',
  timezone: '時區',
  enableRemind: '開啟提醒功能',
  showReacted: '顯示已簽到名單',
  showAbsent: '顯示未簽到名單',
}

const commandSettings: CommandProps = async ({ message, guildId, args }) => {
  const settingKey = args[1] as SettingKey
  const settingValues = args[2]

  if (!settingKey) {
    return {
      content: ':gear: **GUILD_NAME** 全部設定'.replace('GUILD_NAME', message.guild?.name || ''),
      embed: {
        fields: Object.keys(defaultSettings).map(v => {
          const key = v as SettingKey
          const value = cache.settings[guildId]?.[key] ?? defaultSettings[key]

          return {
            name: `${settingKeyName[key]}\n\`${key}\``,
            value:
              typeof defaultSettings[key] === 'boolean' ? (value ? ':white_check_mark: 開啟' : ':x: 關閉') : `${value}`,
            inline: true,
          }
        }),
      },
    }
  }

  if (!settingKeyName[settingKey]) {
    return {
      content: ':question: 沒有這個設定項目，或是這個設定項目已被移除',
      isSyntaxError: true,
    }
  }

  if (!settingValues) {
    await database.ref(`/settings/${guildId}/${settingKey}`).remove()
    return {
      content: ':gear: 設定項目 **SETTING_KEY_NAME** 已重設為預設值：`VALUE`'
        .replace('SETTING_KEY_NAME', settingKeyName[settingKey] || '')
        .replace('VALUE', `${defaultSettings[settingKey]}`),
    }
  }

  const newValue: string | number | boolean =
    typeof defaultSettings[settingKey] === 'string'
      ? settingValues
      : typeof defaultSettings[settingKey] === 'number'
      ? parseInt(settingValues)
      : settingValues === '1' || settingValues === 'true'

  if (typeof defaultSettings[settingKey] === 'number' && Number.isNaN(newValue)) {
    return {
      content: ':x: 設定項目必須為數字',
      isSyntaxError: true,
    }
  }

  await database.ref(`/settings/${guildId}/${settingKey}`).set(newValue)

  if (typeof defaultSettings[settingKey] === 'boolean') {
    return {
      content: ':gear: 設定項目 **SETTING_KEY_NAME** ACTION'
        .replace('SETTING_KEY_NAME', settingKeyName[settingKey] || '')
        .replace('ACTION', newValue ? '已開啟' : '已關閉'),
    }
  }

  return {
    content: ':gear: 設定項目 **SETTING_KEY_NAME** 已變更為 `VALUE`'
      .replace('SETTING_KEY_NAME', settingKeyName[settingKey] || '')
      .replace('VALUE', `${newValue}`),
  }
}

export default commandSettings
