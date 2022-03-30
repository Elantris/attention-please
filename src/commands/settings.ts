import { DateTime } from 'luxon'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import timeFormatter from '../utils/timeFormatter'

const defaultSettings: {
  [key: string]: string | number | boolean
} = {
  prefix: 'ap!',
  timezone: 'Asia/Taipei',
  raffle: 30,
  showReacted: true,
  showAbsent: true,
  showLocked: true,
}

const settingKeyNameMap: {
  [key: string]: string
} = {
  prefix: '指令前綴',
  timezone: '指定時區',
  raffle: '抽獎人數',
  showReacted: '顯示簽到',
  showAbsent: '顯示缺席',
  showLocked: '顯示無權',
}

const commandSettings: CommandProps = async ({ message, guildId, args }) => {
  if (!message.member?.permissions.has('ADMINISTRATOR')) {
    return {
      response: {
        content: ':lock: 未擁有管理員權限',
        embed: {
          description: '你必須是伺服器的管理員才能使用這個指令修改機器人設定',
        },
      },
    }
  }

  const settingKey = args[1]
  const settingValue = args[2]

  if (!settingKey) {
    return {
      response: {
        content: ':gear: **GUILD_NAME** 全部設定'.replace('GUILD_NAME', message.guild?.name || guildId),
        embed: {
          fields: Object.keys(settingKeyNameMap).map(settingKey => ({
            name: `${settingKeyNameMap[settingKey]} \`${settingKey}\``,
            value: `${cache.settings[guildId]?.[settingKey] ?? defaultSettings[settingKey]}`,
            inline: true,
          })),
        },
      },
    }
  }

  if (!settingKeyNameMap[settingKey]) {
    return {
      response: {
        content: ':x: 沒有這個設定項目，或是這個設定項目已被移除',
        embed: {
          description: '可以設定的項目：\nSETTING_KEYS'.replace(
            'SETTING_KEYS',
            Object.keys(settingKeyNameMap)
              .map(key => `\`${key}\``)
              .join('、'),
          ),
        },
      },
    }
  }

  if (settingKey === 'prefix') {
    if (!settingValue) {
      return {
        response: {
          content: ':gear: **指令前綴**：`PREFIX`'.replace('PREFIX', cache.settings[guildId]?.prefix || 'ap!'),
        },
      }
    }
    if (settingValue.length > 5) {
      return {
        response: {
          content: ':x: 輸入的字串長度過長',
          embed: {
            description: ':warning: 指令前綴的長度限制最多 5 個字元',
          },
        },
      }
    }
    await database.ref(`/settings/${guildId}/prefix`).set(settingValue)
    return {
      response: {
        content: ':gear: **指令前綴** 已設定為 `PREFIX`'.replace('PREFIX', settingValue),
        embed: {
          description: '之後使用機器人指令時請改用 `PREFIX` 為開頭，例如 `PREFIXcheck`'.replace(
            /PREFIX/g,
            settingValue,
          ),
        },
      },
    }
  }

  if (settingKey === 'timezone') {
    if (!settingValue) {
      return {
        response: {
          content: ':gear: **指定時區**：TIMEZONE'.replace(
            'TIMEZONE',
            cache.settings[guildId]?.timezone || 'Asia/Taipei',
          ),
          embed: {
            description:
              '修改時區 `ap!settings timezone 時區名稱`\n時區名稱請參考表格中的 TZ database name 欄位\nhttps://en.wikipedia.org/wiki/List_of_tz_database_time_zones',
          },
        },
      }
    }

    const newZone = settingValue
    const now = DateTime.local().setZone(newZone)
    if (!now.isValid) {
      return {
        response: {
          content: ':x: 指定的時區不存在',
          embed: {
            description:
              '請參考表格中的 TZ database name 欄位\nhttps://en.wikipedia.org/wiki/List_of_tz_database_time_zones',
          },
        },
      }
    }

    await database.ref(`/settings/${guildId}/timezone`).set(newZone)

    return {
      response: {
        content: ':gear: **指定時區** 已設定為 `TIMEZONE`'.replace('TIMEZONE', newZone),
        embed: {
          description: '現在時間：`TIME`'.replace('TIME', timeFormatter({ guildId })),
        },
      },
    }
  }

  if (settingKey === 'raffle') {
    if (!settingValue) {
      return {
        response: {
          content: ':gear: **抽獎人數**：RAFFLE'.replace('RAFFLE', `${cache.settings[guildId]?.raffle || 30}`),
        },
      }
    }

    const newValue = parseInt(settingValue)
    if (!Number.isSafeInteger(newValue) || newValue < 1) {
      return {
        response: {
          content: ':x: 抽獎人數必須為一個正整數',
          embed: {
            description: '使用者的輸入：VALUE'.replace('VALUE', settingValue),
          },
        },
      }
    }
    await database.ref(`/settings/${guildId}/raffle`).set(newValue)
    return {
      response: {
        content: ':gear: 抽獎人數設定為 VALUE 人'.replace('VALUE', `${newValue}`),
        embed: {
          description: '使用 `PREFIXraffle` 時會依序抽出不重複的 VALUE 人，建議設定大一點的數字，多的可以當備取'
            .replace(/PREFIX/g, cache.settings[guildId]?.prefix || 'ap!')
            .replace('VALUE', `${newValue}`),
        },
      },
    }
  }

  if (settingKey === 'showReacted' || settingKey === 'showAbsent' || settingKey === 'showLocked') {
    const newValue = !(cache.settings[guildId]?.[settingKey] !== false)

    await database.ref(`/settings/${guildId}/${settingKey}`).set(newValue)
    return {
      response: {
        content: ':gear: **SETTING_KEY_NAME** 已切換為 VALUE'
          .replace('SETTING_KEY_NAME', settingKeyNameMap[settingKey])
          .replace('VALUE', newValue ? ':white_check_mark: 顯示 (true)' : ':no_entry: 隱藏 (false)'),
      },
    }
  }

  return {}
}

export default commandSettings
