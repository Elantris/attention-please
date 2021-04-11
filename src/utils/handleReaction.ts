import { Client } from 'discord.js'
import moment from 'moment'
import { RemindJobProps } from '../types'
import database, { cache } from './database'
import { sendLog } from './handleMessage'

const remindTimeMap: {
  [Emoji in string]?: number
} = {
  '⏰': 20,
  '🔔': 60,
}

export const handleReactionAdd = async (
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
  const remindTime = remindTimeMap[options.emoji]
  if (!cache.settings[options.guildId]?.allowRemind || !remindTime) {
    return
  }

  const jobId = `${options.userId}_${options.messageId}`
  const job: RemindJobProps = {
    clientId: client.user?.id || '',
    createdAt: now,
    remindAt: moment().add(remindTime, 'minutes').toDate().getTime(),
    userId: options.userId,
    guildId: options.guildId,
    channelId: options.channelId,
    messageId: options.messageId,
    retryTimes: 0,
  }
  await database.ref(`/remindJobs/${jobId}`).set(job)

  sendLog(client, {
    content: '[`TIME`] `JOB_ID` created'.replace('TIME', moment(now).format('HH:MM:ss')).replace('JOB_ID', jobId),
    guildId: options.guildId,
    channelId: options.channelId,
    userId: options.userId,
  })
}

export const handleReactionRemove = async (
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
  if (!remindTimeMap[options.emoji] || !cache.remindJobs[jobId]) {
    return
  }
  await database.ref(`/remindJobs/${jobId}`).remove()

  sendLog(client, {
    content: '[`TIME`] `JOB_ID` removed'.replace('TIME', moment(now).format('HH:MM:ss')).replace('JOB_ID', jobId),
    guildId: options.guildId,
    channelId: options.channelId,
    userId: options.userId,
  })
}
