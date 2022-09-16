import { APIEmbed, Interaction, MessageOptions, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js'

export type CommandProps = {
  build: RESTPostAPIApplicationCommandsJSONBody
  exec: (interaction: Interaction) => Promise<ResultProps | void | undefined>
}

export type ResultProps = {
  content: string
  embed?: APIEmbed
  files?: MessageOptions['files']
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

export const locales = ['zh-TW', 'en-US'] as const
export type LocaleType = typeof locales[number]
export const isLocaleType = (target: LocaleType | string | null): target is LocaleType =>
  !!locales.find(locale => locale === target)
