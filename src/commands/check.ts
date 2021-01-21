import { CommandProps } from '../types'

const commandCheck: CommandProps = async (message, args) => {
  if (!message.guild || !message.client.user) {
    return { content: ':question:' }
  }

  if (!args[0]) {
    return {
      content: ':x: 請用 Message ID 指定訊息',
      isSyntaxError: true,
    }
  }

  const guildChannels = message.guild.channels.cache.array()

  for (const channel of guildChannels) {
    if (!channel.isText() || !channel.members.has(message.client.user.id)) {
      continue
    }

    try {
      const targetMessage = await channel.messages.fetch(args[0])
      const mentionedMembers = channel.members
        .filter(member => !member.user.bot && !!channel.permissionsFor(member)?.has('READ_MESSAGE_HISTORY'))
        .filter(
          member =>
            targetMessage.mentions.everyone ||
            targetMessage.mentions.users.has(member.id) ||
            targetMessage.mentions.roles.some(role => role.members.has(member.id)),
        )

      return {
        content: mentionedMembers.size ? mentionedMembers.map(member => member.user.tag).join(' ') : '0',
      }
    } catch {}
  }

  return {
    content: ':question: 找不到這則訊息，也許是這隻機器人沒有權限看到它？',
  }
}

export default commandCheck
