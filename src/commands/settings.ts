import { Util } from 'discord.js'
import { DateTime } from 'luxon'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import timeFormatter from '../utils/timeFormatter'
import { getLanguageKeys, isLanguageExisted, translate } from '../utils/translation'

const defaultSettings: {
  [key: string]: string | number | boolean
} = {
  prefix: 'ap!',
  timezone: 'Asia/Taipei',
  language: 'zh_tw',
  showReacted: true,
  showAbsent: true,
  showLocked: true,
  raffle: 30,
}

const commandSettings: CommandProps = async ({ message, guildId, args }) => {
  if (!message.member?.permissions.has('ADMINISTRATOR')) {
    return {
      response: {
        content: translate('settings.error.noAdminPermission', { guildId })
          .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.username))
          .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || '')),
        embed: {
          description: translate('settings.error.noAdminPermissionHelp', { guildId }),
        },
      },
    }
  }

  const settingKey = args[1]
  const settingValue = args[2]

  if (!settingKey) {
    return {
      response: {
        content: translate('settings.text.allSettings', { guildId }).replace(
          'GUILD_NAME',
          message.guild?.name || guildId,
        ),
        embed: {
          fields: Object.keys(defaultSettings).map(settingKey => ({
            name: `\`${settingKey}\``,
            value: `${cache.settings[guildId]?.[settingKey] ?? defaultSettings[settingKey]}`,
            inline: true,
          })),
        },
      },
    }
  }

  if (!defaultSettings[settingKey]) {
    return
  }

  if (settingKey === 'prefix') {
    if (!settingValue) {
      return {
        response: {
          content: translate('settings.text.prefixValue', { guildId }).replace(
            'PREFIX',
            cache.settings[guildId]?.prefix || 'ap!',
          ),
        },
      }
    }
    if (settingValue.length > 5) {
      return {
        response: {
          content: translate('settings.text.prefixLengthLimit', { guildId }),
          embed: {
            description: translate('settings.text.prefixLengthLimitHelp', { guildId }),
          },
        },
      }
    }
    const newPrefix = settingValue
    await database.ref(`/settings/${guildId}/prefix`).set(newPrefix)
    return {
      response: {
        content: translate('settings.text.prefixUpdated', { guildId }).replace('PREFIX', newPrefix),
        embed: {
          description: translate('settings.text.prefixUpdatedHelp', { guildId }).replace(/PREFIX/g, newPrefix),
        },
      },
    }
  }

  if (settingKey === 'timezone') {
    if (!settingValue) {
      return {
        response: {
          content: translate('settings.text.timezoneValue', { guildId }).replace(
            'TIMEZONE',
            cache.settings[guildId]?.timezone || 'Asia/Taipei',
          ),
          embed: {
            description: translate('settings.text.timezoneValueHelp', { guildId }),
          },
        },
      }
    }

    const newTimezone = settingValue
    const now = DateTime.local().setZone(newTimezone)
    if (!now.isValid) {
      return {
        response: {
          content: translate('settings.error.timezoneNotFound', { guildId }),
          embed: {
            description: translate('settings.error.timezoneNotFoundHelp', { guildId }),
          },
        },
      }
    }
    await database.ref(`/settings/${guildId}/timezone`).set(newTimezone)
    return {
      response: {
        content: translate('settings.text.timezoneUpdated', { guildId }).replace('TIMEZONE', newTimezone),
        embed: {
          description: translate('settings.text.timezoneUpdatedHelp', { guildId }).replace(
            'TIME',
            timeFormatter({ guildId }),
          ),
        },
      },
    }
  }

  if (settingKey === 'language') {
    if (!settingValue) {
      return {
        response: {
          content: translate('settings.text.languageValue', { guildId }).replace(
            'LANGUAGE',
            cache.settings[guildId]?.language || 'zh_tw',
          ),
          embed: {
            description: translate('settings.text.languageValueHelp', { guildId }),
          },
        },
      }
    }
    const newLanguage = settingValue.toLowerCase()
    if (!isLanguageExisted(newLanguage)) {
      return {
        response: {
          content: translate('settings.error.languageNotFound', { guildId }).replace('VALUE', newLanguage),
          embed: {
            description: translate('settings.error.languageNotFoundHelp', { guildId }).replace(
              'LANGUAGES',
              getLanguageKeys()
                .map(v => `\`${v}\``)
                .join('\n'),
            ),
          },
        },
      }
    }
    await database.ref(`/settings/${guildId}/language`).set(newLanguage)
    return {
      response: {
        content: translate('settings.text.languageUpdated', { guildId, language: newLanguage }),
        embed: {
          description: '',
        },
      },
    }
  }

  if (settingKey === 'raffle') {
    if (!settingValue) {
      return {
        response: {
          content: translate('settings.text.raffleValue', { guildId }).replace(
            'RAFFLE',
            `${cache.settings[guildId]?.raffle || 30}`,
          ),
        },
      }
    }
    const newRaffle = parseInt(settingValue)
    if (!Number.isSafeInteger(newRaffle) || newRaffle < 1) {
      return {
        response: {
          content: translate('settings.error.raffleSyntax', { guildId }),
          embed: {
            description: translate('settings.error.raffleSyntaxHelp', { guildId }).replace('USER_INPUT', settingValue),
          },
        },
      }
    }
    await database.ref(`/settings/${guildId}/raffle`).set(newRaffle)
    return {
      response: {
        content: translate('settings.text.raffleUpdated', { guildId }).replace('VALUE', `${newRaffle}`),
        embed: {
          description: translate('settings.text.raffleUpdatedHelp', { guildId })
            .replace(/PREFIX/g, cache.settings[guildId]?.prefix || 'ap!')
            .replace('VALUE', `${newRaffle}`),
        },
      },
    }
  }

  if (settingKey === 'showReacted' || settingKey === 'showAbsent' || settingKey === 'showLocked') {
    const newValue = !(cache.settings[guildId]?.[settingKey] !== false)

    await database.ref(`/settings/${guildId}/${settingKey}`).set(newValue)
    return {
      response: {
        content: translate('settings.text.nameListUpdated', { guildId })
          .replace('SETTING_KEY_NAME', settingKey)
          .replace(
            'VALUE',
            newValue
              ? translate('settings.text.nameListShow', { guildId })
              : translate('settings.text.nameListHidden', { guildId }),
          ),
      },
    }
  }

  return
}

export default commandSettings
