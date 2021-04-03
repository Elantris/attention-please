import { Util } from 'discord.js'
import { cache } from './database'

const getHint: (key?: string) => string = key => {
  if (key && cache.hints[key]) {
    return cache.hints[key] || ''
  }

  const allHints = Object.values(cache.hints)
  const pick = Math.floor(Math.random() * allHints.length)
  const hint = allHints[pick] || ''

  return Util.escapeMarkdown(hint)
}

export default getHint
