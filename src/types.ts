import { Message, MessageEmbed } from 'discord.js'

export type CommandProps = (
  message: Message,
  args: string[],
) => Promise<{
  content: Message['content']
  embed?: MessageEmbed
  isSyntaxError?: boolean
}>
