import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (
  message: Message,
  args: string[],
) => Promise<{
  content: Message['content']
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
}>
