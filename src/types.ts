import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (
  message: Message,
  options: {
    guildId: string
    args: string[]
  },
) => Promise<CommandResponseProps>

export type CommandResponseProps = {
  content: Message['content']
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
}

export type RemindJobProps = {
  remindAt: number
  guildId: string
  channelId: string
  messageId: string
  responseChannelId: string
  retryTimes: number
}
