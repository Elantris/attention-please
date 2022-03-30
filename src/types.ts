import { FileOptions, Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (options: {
  message: Message
  guildId: string
  args: string[]
}) => Promise<CommandResultProps>

export type CommandResultProps = {
  response?: ResponseProps
  error?: Error
}

export type ResponseProps = {
  content: string
  embed?: MessageEmbedOptions
  files?: FileOptions[]
}

export type JobProps = {
  clientId: string
  executeAt: number
  type: 'check' | 'remind' | 'raffle'
  target: {
    messageId: string
    channelId: string
  }
  command: {
    messageId?: string
    guildId: string
    channelId: string
    userId: string
  }
  retryTimes: number
}
