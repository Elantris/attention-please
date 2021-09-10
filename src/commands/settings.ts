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

  if (!settingValue) {
    await database.ref(`/settings/${guildId}/${settingKey}`).remove()
    return {
      content: ':gear: 設定項目 **SETTING_KEY_NAME** 已重設為預設值：`VALUE`'
        .replace('SETTING_KEY_NAME', settingKeyNameMap[settingKey] || '')
        .replace('VALUE', `${defaultSettings[settingKey]}`),
    }
  }

  if (settingKey === 'prefix') {
    if (settingValue.length > 5) {
      return {
        content: ':x: 輸入的字串長度過長',
        embed: {
          description: ':warning: 指令前綴的長度最多 5 個字元',
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
    const offset = parseFloat(settingValue)
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
    if (!['absent', 'reacted'].includes(settingValue)) {
      return {
        content: ':x: 無效的設定值，請輸入 `absent` 或 `reacted`',
        embed: {
          description:
            ':warning: 顯示名單為結算時要顯示「未簽到 absent」或「有簽到 reacted」的成員，例如：`ap!settings display reacted`',
        },
        isSyntaxError: true,
      }
    }
    await database.ref(`/settings/${guildId}/display`).set(settingValue)
    return {
      content: ':gear: **顯示名單** 已設定為 `DISPLAY`'.replace('DISPLAY', settingValue),
      embed: {
        description: `現在結算時會顯示 ${settingValue === 'absent' ? '未簽到' : '已簽到'} 的成員`,
      },
    }
  }

  return {
    content: ':x:',
    isSyntaxError: true,
  }
}

export default commandSettings
