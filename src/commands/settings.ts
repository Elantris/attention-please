import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const settingsItems = ['prefix', 'timezone']

const commandSettings: CommandProps = async (message, { guildId, args }) => {
  if (args.length === 0) {
    return {
      content: ':gear: `GUILD_ID` 全部設定：\nVALUE'.replace('GUILD_ID', guildId).replace(
        'VALUE',
        settingsItems
          .map(settingsItem => {
            const value = cache.settings[guildId]?.[settingsItem] || ''
            return '**SETTING_ITEM**: `VALUE`'.replace('SETTING_ITEM', settingsItem).replace('VALUE', value)
          })
          .filter(v => v)
          .join('\n'),
      ),
    }
  }

  if (!settingsItems.includes(args[0])) {
    return {
      isSyntaxError: true,
      content: ':question: 沒有這個設定項目',
    }
  }

  if (args.length === 1) {
    return {
      content: ':gear: `GUILD_ID` 設定項目 **SETTINGS_ITEM**：`VALUE`'
        .replace('GUILD_ID', guildId)
        .replace('SETTINGS_ITEM', args[0])
        .replace('VALUE', cache.settings[guildId]?.[args[0]] || ''),
    }
  }

  const newValue = args.slice(1).join(' ')
  if (newValue.toLowerCase() === 'null') {
    await database.ref(`/settings/${guildId}/${args[0]}`).remove()

    return {
      content: ':gear: `GUILD_ID` 設定項目 **SETTINGS_ITEM** 已恢復預設值'
        .replace('GUILD_ID', guildId)
        .replace('SETTINGS_ITEM', args[0]),
    }
  }
  await database.ref(`/settings/${guildId}/${args[0]}`).set(newValue)

  return {
    content: ':gear: `GUILD_ID` 設定項目 **SETTINGS_ITEM** 已成功改為 `VALUE`'
      .replace('GUILD_ID', guildId)
      .replace('SETTINGS_ITEM', args[0])
      .replace('VALUE', newValue),
  }
}

export default commandSettings
