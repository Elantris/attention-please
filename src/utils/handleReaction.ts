import { Client, DMChannel } from 'discord.js'
import { RemindJobProps } from '../types'
import cache, { database } from './cache'
import sendLog from './sendLog'

export const handleRaw = (client: Client, packet: any) => {
  try {
    if (!packet?.d?.user_id || !client.user || packet.d.user_id === client.user.id) {
      return
    }
    if (packet.t === 'MESSAGE_REACTION_ADD') {
      handleReactionAdd(client, {
        userId: packet.d.user_id,
        guildId: packet.d.guild_id,
        channelId: packet.d.channel_id,
        messageId: packet.d.message_id,
        emoji: packet.d.emoji,
      })
    } else if (packet.t === 'MESSAGE_REACTION_REMOVE') {
      handleReactionRemove(client, {
        userId: packet.d.user_id,
        guildId: packet.d.guild_id,
        channelId: packet.d.channel_id,
        messageId: packet.d.message_id,
        emoji: packet.d.emoji,
      })
    }
  } catch (error: any) {
    sendLog(client, {
      color: '#ff6b6b',
      error,
    })
  }
}

const remindTimeMap: {
  [Emoji in string]?: number
} = {
  '⏰': 20,
  '🔔': 60,
}

const handleReactionAdd = async (
  client: Client,
  options: {
    userId: string
    guildId?: string
    channelId: string
    messageId: string
    emoji: { id: string | null; name: string }
  },
) => {
  const now = Date.now()
  const emoji = options.emoji.id ? `<:${options.emoji.name}:${options.emoji.id}>` : options.emoji.name

  if (!options.guildId) {
    if (emoji !== '✅') {
      return
    }
    const channel = await client.channels.fetch(options.channelId)
    if (!(channel instanceof DMChannel)) {
      return
    }
    const message = await channel.messages.fetch(options.messageId)
    if (message.author.id === client.user?.id) {
      await message.delete()

      sendLog(client, {
        color: '#ffc078',
        time: now,
        content: 'Delete reminded message `MESSAGE_ID`'.replace('MESSAGE_ID', message.id),
        channelId: options.channelId,
        userId: options.userId,
      })
    }

    return
  }

  if (!cache.modules.enableRemind[options.guildId]) {
    return
  }

  const remindTime = cache.remindSettings[options.userId]?.[emoji] ?? remindTimeMap[emoji]
  if (typeof remindTime === 'undefined') {
    return
  }

  const jobId = `${options.userId}_${options.messageId}`
  const job: RemindJobProps = {
    clientId: client.user?.id || '',
    remindAt: now + remindTime * 60000,
    userId: options.userId,
    guildId: options.guildId,
    channelId: options.channelId,
    messageId: options.messageId,
    retryTimes: 0,
  }
  await database.ref(`/remindJobs/${jobId}`).set(job)

  sendLog(client, {
    color: '#ffc078',
    time: now,
    content: 'Create remind job `JOB_ID` (REMIND_TIME minutes)'
      .replace('JOB_ID', jobId)
      .replace('REMIND_TIME', `${remindTime}`),
    guildId: options.guildId,
    channelId: options.channelId,
    userId: options.userId,
  })
}

const handleReactionRemove = async (
  client: Client,
  options: {
    userId: string
    guildId: string
    channelId: string
    messageId: string
    emoji: string
  },
) => {
  const now = Date.now()
  const jobId = `${options.userId}_${options.messageId}`
  if (!cache.remindJobs[jobId]) {
    return
  }
  await database.ref(`/remindJobs/${jobId}`).remove()

  sendLog(client, {
    color: '#ffc078',
    time: now,
    content: 'Remove remind job `JOB_ID`'.replace('JOB_ID', jobId),
    guildId: options.guildId,
    channelId: options.channelId,
    userId: options.userId,
  })
}
