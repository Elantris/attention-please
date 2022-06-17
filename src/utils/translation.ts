import { readdirSync } from 'fs'
import { join } from 'path'
import cache from './cache'

const translations: {
  [language: string]: {
    [key: string]: string
  }
} = {}

const fileRoot = join(__dirname, '../translation/')
readdirSync(fileRoot)
  .filter(filename => filename.endsWith('.json'))
  .forEach(filename => {
    translations[filename.split('.')[0]] = require(`${fileRoot}/${filename}`)
  })

export const translate = (
  key: string,
  options?: {
    guildId?: string
    language?: string
  },
) => {
  const language = options?.language || cache.settings[options?.guildId || '']?.language || 'zh_tw'
  return translations[language]?.[key] ?? translations['zh_tw']?.[key] ?? key
}

export const isLanguageExisted = (language: string) => !!translations[language]
export const getLanguageKeys = () => Object.keys(translations)
