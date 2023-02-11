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

const repeatLabels = ['week', 'month', 'season'] as const
export type RepeatType = typeof repeatLabels[number]
export const isRepeatType = (target: RepeatType | string | null): target is RepeatType =>
  !!repeatLabels.find(v => v === target)

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
  repeat?: RepeatType
}

export const memberStatusLabels = ['reacted', 'absent', 'locked', 'irrelevant', 'leaved'] as const
export type MemberStatusType = typeof memberStatusLabels[number]

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

const localeLabels = ['zh-TW', 'en-US'] as const
export type LocaleType = typeof localeLabels[number]
export const isLocaleType = (target: LocaleType | string | null): target is LocaleType =>
  !!localeLabels.find(v => v === target)
