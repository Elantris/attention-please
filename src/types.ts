import { APIEmbed, Interaction, MessageCreateOptions, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js'

export type CommandProps = {
  builds: RESTPostAPIApplicationCommandsJSONBody[]
  exec: (interaction: Interaction) => Promise<ResultProps | void | undefined>
}

export type ResultProps = {
  content: string
  embed?: APIEmbed
  files?: MessageCreateOptions['files']
  error?: Error
}

export type JobProps = {
  clientId: string
  executeAt: number
  command: {
    guildId: string
    channelId: string
    userId: string
    raffleCount?: number
  }
  target: {
    channelId: string
    messageId: string
  }
  retryTimes: number
}

export type MemberStatus = 'reacted' | 'absent' | 'locked' | 'irrelevant' | 'leaved'

export const isKeyValueProps = (
  target: any,
): target is {
  [key: string]: string
} => {
  if (!target) {
    return false
  }
  for (const key in target) {
    if (typeof key !== 'string' || typeof target[key] !== 'string') {
      return false
    }
  }
  return true
}

const LOCALES = ['zh-TW', 'en-US'] as const
export type LocaleType = typeof LOCALES[number]
export const isLocaleType = (target: LocaleType | string | null): target is LocaleType =>
  !!LOCALES.find(locale => locale === target)
