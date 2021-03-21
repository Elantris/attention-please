import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (
  message: Message,
  options: {
    guildId: string
    args: string[]
  },
) => Promise<CommandResultProps>

export type CommandResultProps = {
  content?: Message['content']
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
  error?: Error
}

export type RemindJobProps = {
  remindAt: number
  guildId: string
  channelId: string
  messageId: string
  responseChannelId: string
  retryTimes: number
  isTest: boolean
}
