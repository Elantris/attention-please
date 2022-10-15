import { APIEmbed, Interaction, MessageCreateOptions, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js'

export type CommandProps = {
  build: RESTPostAPIApplicationCommandsJSONBody
  exec: (interaction: Interaction) => Promise<ResultProps | void | undefined>
}

export type ResultProps = {
  content: string
  embed?: APIEmbed
  files?: MessageCreateOptions['files']
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

const LOCALES = ['zh-TW', 'en-US'] as const
export type LocaleType = typeof LOCALES[number]
export const isLocaleType = (target: LocaleType | string | null): target is LocaleType =>
  !!LOCALES.find(locale => locale === target)
