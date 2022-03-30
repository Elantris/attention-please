import { WebhookClient } from 'discord.js'
import admin, { ServiceAccount } from 'firebase-admin'
import config from '../config'
import { JobProps } from '../types'

export const loggerHook = new WebhookClient(config.DISCORD.LOGGER_HOOK)

admin.initializeApp({
  credential: admin.credential.cert(config.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: config.FIREBASE.databaseURL,
})
export const database = admin.database()

const cache: {
  [key: string]: any
  banned: {
    [ID in string]?: number
  }
  remindSettings: {
    [UserId in string]?: {
      [emoji in string]: number
    }
  }
  settings: {
    [GuildID in string]?: {
      [key: string]: string | number | boolean
      prefix: string
      timezone: string
      raffle: number
      showReacted: boolean
      showAbsent: boolean
      showLocked: boolean
    }
  }
  modules: {
    mentionAbsent: { [GuildID in string]?: boolean }
  }
  jobs: {
    [JobID in string]?: JobProps
  }
} = {
  banned: {},
  remindSettings: {},
  settings: {},
  modules: {
    mentionAbsent: {},
  },
  jobs: {},
}

const updateCache = (snapshot: admin.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key
  if (key && cache[key] && snapshot.key) {
    cache[key][snapshot.key] = snapshot.val()
  }
}
const removeCache = (snapshot: admin.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key
  if (key && cache[key] && snapshot.key) {
    delete cache[key][snapshot.key]
  }
}

database.ref('/banned').on('child_added', updateCache)
database.ref('/banned').on('child_changed', updateCache)
database.ref('/banned').on('child_removed', removeCache)
database.ref('/modules').on('child_added', updateCache)
database.ref('/modules').on('child_changed', updateCache)
database.ref('/modules').on('child_removed', removeCache)
database.ref('/remindSettings').on('child_added', updateCache)
database.ref('/remindSettings').on('child_changed', updateCache)
database.ref('/remindSettings').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)
database.ref('/jobs').on('child_added', updateCache)
database.ref('/jobs').on('child_changed', updateCache)
database.ref('/jobs').on('child_removed', removeCache)

export default cache
