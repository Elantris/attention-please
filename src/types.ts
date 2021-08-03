import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (options: {
  message: Message
  guildId: string
  args: string[]
}) => Promise<CommandResultProps>

export type CommandResultProps = {
  content?: string
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
  error?: Error
}

export type CheckJobProps = {
  clientId: string
  checkAt: number
  guildId: string
  channelId: string
  messageId: string
  responseChannelId: string
  retryTimes: number
}

export type RemindJobProps = {
  clientId: string
  createdAt: number
  remindAt: number
  userId: string
  guildId: string
  channelId: string
  messageId: string
  retryTimes: number
}

export type SettingKey = 'prefix' | 'timezone' | 'enableRemind' | 'showReacted' | 'showAbsent'
