import { DateTime } from 'luxon'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import timeFormatter from '../utils/timeFormatter'

const defaultSettings: {
  [key: string]: string | number
} = {
  prefix: 'ap!',
  timezone: 'Asia/Taipei',
  display: 'absent',
}

const settingKeyNameMap: {
  [key: string]: string
} = {
  prefix: '指令前綴',
  timezone: '指定時區',
  display: '顯示名單',
}

const commandSettings: CommandProps = async ({ message, guildId, args }) => {
  const settingKey = args[1]
  const settingValue = args[2]

  if (!settingKey) {
    return {
      content: ':gear: **GUILD_NAME** 全部設定'.replace('GUILD_NAME', message.guild?.name || guildId),
      embed: {
        fields: Object.keys(settingKeyNameMap).map(settingKey => ({
          name: `${settingKeyNameMap[settingKey]} \`${settingKey}\``,
          value: `${cache.settings[guildId]?.[settingKey] || defaultSettings[settingKey]}`,
          inline: true,
        })),
      },
    }
  }

  if (!settingKeyNameMap[settingKey]) {
    return {
      content: ':x: 沒有這個設定項目，或是這個設定項目已被移除',
      embed: {
        description: '可以設定的項目：SETTING_KEYS'.replace(
          'SETTING_KEYS',
          Object.keys(settingKeyNameMap)
            .map(key => `\`${key}\``)
            .join('、'),
        ),
      },
      isSyntaxError: true,
    }
  }

  if (settingKey === 'prefix') {
    if (!settingValue) {
      await database.ref(`/settings/${guildId}/prefix`).remove()
      return {
        content: ':gear: **指令前綴** 已重設為預設值 `ap!`',
      }
    }
    if (settingValue.length > 5) {
      return {
        content: ':x: 輸入的字串長度過長',
        embed: {
          description: ':warning: 指令前綴的長度限制最多 5 個字元',
        },
        isSyntaxError: true,
      }
    }
    await database.ref(`/settings/${guildId}/prefix`).set(settingValue)
    return {
      content: ':gear: **指令前綴** 已設定為 `PREFIX`'.replace('PREFIX', settingValue),
      embed: {
        description: '之後使用機器人指令請改用 `PREFIX` 為開頭，例如 `PREFIXcheck`'.replace(/PREFIX/g, settingValue),
      },
    }
  }

  if (settingKey === 'timezone') {
    const newZone = settingValue || 'Asia/Taipei'
    const now = DateTime.local().setZone(newZone)
    if (!now.isValid) {
      return {
        content: ':x: 指定時區好像怪怪的，請參考附件裡的表示方式，例如 `Asia/Taipei`',
        embed: {
          description: 'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones',
        },
      }
    }

    await database.ref(`/settings/${guildId}/timezone`).set(newZone)

    return {
      content: ':gear: **指定時區** 已設定為 `TIMEZONE`'.replace('TIMEZONE', newZone),
      embed: {
        description: '現在時間：`TIME`'.replace('TIME', timeFormatter({ guildId })),
      },
    }
  }

  if (settingKey === 'display') {
    const newValue = cache.settings[guildId]?.display === 'reacted' ? 'absent' : 'reacted'
    await database.ref(`/settings/${guildId}/display`).set(newValue)
    return {
      content: `':gear: **顯示名單** 已切換為 ${newValue}`,
      embed: {
        description: `現在結算時會顯示${newValue === 'absent' ? '缺席' : '簽到'}的成員`,
      },
    }
  }

  return {
    content: ':x:',
    isSyntaxError: true,
  }
}

export default commandSettings
