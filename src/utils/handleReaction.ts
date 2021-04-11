import moment from 'moment'
import { RemindJobProps } from '../types'
import database, { cache } from './database'

const remindTimeMap: {
  [Emoji in string]?: number
} = {
  '⏰': 20,
  '🔔': 60,
}

export const handleReactionAdd = async (
  clientId: string,
  options: {
    userId: string
    guildId: string
    channelId: string
    messageId: string
    emoji: string
  },
) => {
  const remindTime = remindTimeMap[options.emoji]
  if (!cache.settings[options.guildId]?.allowRemind || !remindTime) {
    return
  }

  const jobId = `${options.userId}_${options.messageId}`
  const updates: RemindJobProps = {
    clientId,
    createdAt: Date.now(),
    remindAt: moment().add(remindTime, 'minutes').toDate().getTime(),
    userId: options.userId,
    guildId: options.guildId,
    channelId: options.channelId,
    messageId: options.messageId,
    retryTimes: 0,
  }
  await database.ref(`/remindJobs/${jobId}`).set(updates)
}

export const handleReactionRemove = async (options: {
  userId: string
  guildId: string
  messageId: string
  emoji: string
}) => {
  const jobId = `${options.userId}_${options.messageId}`
  if (!remindTimeMap[options.emoji] || !cache.remindJobs[jobId]) {
    return
  }

  await database.ref(`/remindJobs/${jobId}`).remove()
}
