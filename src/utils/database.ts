import admin, { ServiceAccount } from 'firebase-admin'
import config from '../config'
import { RemindJobProps } from '../types'

admin.initializeApp({
  credential: admin.credential.cert(config.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: config.FIREBASE.databaseURL,
})
const database = admin.database()

export const cache: {
  [key: string]: any
  banned: {
    [ID: string]: number
  }
  remindJobs: {
    [JobID: string]: RemindJobProps
  }
  settings: {
    [GuildID: string]: {
      [key: string]: any | undefined
      prefix: string
      timezone: number
      showReacted: boolean
      showAbsent: boolean
      mentionAbsent: boolean
    }
  }
} = {
  banned: {},
  remindJobs: {},
  settings: {},
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
database.ref('/remindJobs').on('child_added', updateCache)
database.ref('/remindJobs').on('child_changed', updateCache)
database.ref('/remindJobs').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)

export default database
