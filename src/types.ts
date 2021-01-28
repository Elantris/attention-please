import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (
  message: Message,
  args: string[],
) => Promise<{
  content: Message['content']
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
}>

export type ReactionStatusProps = {
  [UserID: string]: {
    name: string
    emoji: string[]
  }
}

export type RemindJobProps = {
  remindAt: number
  guildId: string
  channelId: string
  messageId: string
  responseChannelId: string
  retryTimes: number
}
