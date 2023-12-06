import { APIEmbed, ContextMenuCommandBuilder, Interaction, MessageCreateOptions, SlashCommandBuilder } from 'discord.js'

export const repeatLabels = ['day', 'week', 'month', 'season'] as const
export const memberStatusLabels = ['reacted', 'absent', 'locked', 'irrelevant', 'leaved'] as const
export const localeLabels = ['zh-TW', 'en-US'] as const
export type RepeatType = (typeof repeatLabels)[number]
export type MemberStatusType = (typeof memberStatusLabels)[number]
export type LocaleType = (typeof localeLabels)[number]

export type CommandProps = {
  builds: (SlashCommandBuilder | ContextMenuCommandBuilder)[]
  exec: (interaction: Interaction) => Promise<ResultProps | void | undefined>
}

export type ResultProps = {
  content: string
  embed?: APIEmbed
  files?: MessageCreateOptions['files']
  error?: Error
  meta?: {
    isReactionEmpty: boolean
  }
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
  repeat?: RepeatType
}

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

export const isInArray = <T extends string>(str: string, arr: readonly T[]): str is T => arr.includes(str as T)
