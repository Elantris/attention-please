import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import cache from '../helper/cache.js'
import { LocaleType } from '../types.js'

const translations: {
  [Locale in LocaleType]?: {
    [key: string]: string
  }
} = {}

readdirSync(join(import.meta.dirname, '../../translations')).forEach((filename) => {
  if (!filename.endsWith('.json')) {
    return
  }
  const locale = filename.replace('.json', '') as LocaleType
  translations[locale] = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../translations', filename), { encoding: 'utf8' }),
  )
})

export const isTranslateKey = (key: string) => !!translations['zh-TW']?.[key]

export const translate = (
  key: string,
  options?: {
    guildId?: string
    locale?: LocaleType
  },
) => {
  const locale = options?.locale || cache.settings[options?.guildId || '']?.locale || 'zh-TW'
  return translations[locale]?.[key] ?? translations['zh-TW']?.[key] ?? key
}
