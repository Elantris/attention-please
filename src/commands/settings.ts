import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'

const defaultSettings: {
  [key: string]: string | number
} = {
  prefix: 'ap!',
  offset: 8,
  display: 'absent',
}

const settingKeyNameMap: {
  [key: string]: string
} = {
  prefix: '指令前綴',
  offset: '時間偏移',
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
      return {
        content: ':gear: **指令前綴** 為 `PREFIX`'.replace('PREFIX', cache.settings[guildId]?.prefix || 'ap!'),
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

  if (settingKey === 'offset') {
    const offset = parseFloat(settingValue ?? '8')
    if (Number.isNaN(offset) || offset < -12 || offset > 12) {
      return {
        content: ':x: 請輸入 -12 ~ 12 之間的數字',
        embed: {
          description:
            ':warning: 使用 check 指令建立預約結算時會使用「時間偏移」解析指定時間，預設為 GMT+8，請根據所在的時區輸入習慣的時間偏移量（單位為小時），例如 `ap!settings offset 7` 代表 GMT+7 的地區',
        },
        isSyntaxError: true,
      }
    }
    await database.ref(`/settings/${guildId}/offset`).set(offset)
    return {
      content: ':gear: **時間偏移** 已設定為 **OFFSET**'.replace('OFFSET', `${offset}`),
      embed: {
        description: '使用 check 指令時會根據時間偏移量來解析指定時間',
      },
    }
  }

  if (settingKey === 'display') {
    const newValue = cache.settings[guildId]?.display === 'reacted' ? 'absent' : 'reacted'
    await database.ref(`/settings/${guildId}/display`).set(newValue)
    return {
      content: `':gear: **顯示名單** 已切換為 **${newValue === 'absent' ? '未簽到' : '已簽到'}**'`,
      embed: {
        description: `現在結算時會顯示${newValue === 'absent' ? '未簽到' : '已簽到'}的成員`,
      },
    }
  }

  return {
    content: ':x:',
    isSyntaxError: true,
  }
}

export default commandSettings
