import admin, { ServiceAccount } from 'firebase-admin'
import config from '../config'
import { CheckJobProps, RemindJobProps } from '../types'

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
  hints: {
    [key in string]?: string
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
      offset: number
      display: 'absent' | 'reacted'
    }
  }
  modules: {
    enableRemind: { [GuildID in string]?: boolean }
    mentionAbsent: { [GuildID in string]?: boolean }
  }

  checkJobs: {
    [JobID in string]?: CheckJobProps
  }
  remindJobs: {
    [JobID in string]?: RemindJobProps
  }

  syntaxErrorsCounts: {
    [UserID in string]?: number
  }
} = {
  banned: {},
  hints: {},
  remindJobs: {},
  settings: {},
  modules: {
    enableRemind: {},
    mentionAbsent: {},
  },

  checkJobs: {},
  remindSettings: {},

  syntaxErrorsCounts: {},
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
database.ref('/checkJobs').on('child_added', updateCache)
database.ref('/checkJobs').on('child_changed', updateCache)
database.ref('/checkJobs').on('child_removed', removeCache)
database.ref('/hints').on('child_added', updateCache)
database.ref('/hints').on('child_changed', updateCache)
database.ref('/hints').on('child_removed', removeCache)
database.ref('/remindJobs').on('child_added', updateCache)
database.ref('/remindJobs').on('child_changed', updateCache)
database.ref('/remindJobs').on('child_removed', removeCache)
database.ref('/remindSettings').on('child_added', updateCache)
database.ref('/remindSettings').on('child_changed', updateCache)
database.ref('/remindSettings').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)
database.ref('/modules').on('child_added', updateCache)
database.ref('/modules').on('child_changed', updateCache)
database.ref('/modules').on('child_removed', removeCache)

export const getHint: (key?: string) => string = key => {
  if (key && cache.hints[key]) {
    return cache.hints[key] || ''
  }

  const allHints = Object.values(cache.hints)
  if (!allHints.length) {
    return ''
  }

  const pick = Math.floor(Math.random() * allHints.length)
  const hint = allHints[pick] || ''

  return hint
}

export default cache
