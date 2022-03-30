import { Client, DMChannel } from 'discord.js'
import OpenColor from 'open-color'
import { JobProps } from '../types'
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
      error,
    })
  }
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
  const startAt = Date.now()
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
        color: OpenColor.yellow[5],
        time: startAt,
        content: 'Delete remind message `MESSAGE_ID`'.replace('MESSAGE_ID', message.id),
        channelId: options.channelId,
        userId: options.userId,
        processTime: Date.now() - startAt,
      })
    }

    return
  }

  const remindTime = cache.remindSettings[options.userId]?.[emoji]
  if (typeof remindTime !== 'number') {
    return
  }

  const jobId = `remind_${options.userId}_${options.messageId}`
  const job: JobProps = {
    clientId: client.user?.id || '',
    executeAt: startAt + remindTime * 60000,
    type: 'remind',
    target: {
      messageId: options.messageId,
      channelId: options.channelId,
    },
    command: {
      userId: options.userId,
      guildId: options.guildId,
      channelId: options.channelId,
    },
    retryTimes: 0,
  }
  await database.ref(`/jobs/${jobId}`).set(job)

  sendLog(client, {
    color: OpenColor.yellow[5],
    time: startAt,
    content: 'Create remind job `JOB_ID` (REMIND_TIME minutes)'
      .replace('JOB_ID', jobId)
      .replace('REMIND_TIME', `${remindTime}`),
    guildId: options.guildId,
    channelId: options.channelId,
    userId: options.userId,
    processTime: Date.now() - startAt,
  })

  const targetChannel = client.channels.cache.get(options.channelId)
  if (targetChannel?.type !== 'GUILD_TEXT') {
    return
  }
  const targetMessage = await targetChannel.messages.fetch(options.messageId)
  targetMessage.react('⏰')
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
  const startAt = Date.now()
  const jobId = `remind_${options.userId}_${options.messageId}`
  if (!cache.remindJobs[jobId]) {
    return
  }
  await database.ref(`/jobs/${jobId}`).remove()

  sendLog(client, {
    color: OpenColor.yellow[5],
    time: startAt,
    content: 'Cancel remind job `JOB_ID`'.replace('JOB_ID', jobId),
    guildId: options.guildId,
    channelId: options.channelId,
    userId: options.userId,
    processTime: Date.now() - startAt,
  })
}
