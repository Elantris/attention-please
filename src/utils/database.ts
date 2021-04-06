import admin, { ServiceAccount } from 'firebase-admin'
import config from '../config'
import { CheckJobProps } from '../types'

admin.initializeApp({
  credential: admin.credential.cert(config.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: config.FIREBASE.databaseURL,
})
const database = admin.database()

export const cache: {
  [key: string]: any
  banned: {
    [ID in string]?: number
  }
  checkJobs: {
    [JobID in string]?: CheckJobProps
  }
  settings: {
    [GuildID in string]?: {
      [key: string]: any
      prefix: string
      timezone: number
      delay: number
      showReacted: boolean
      showAbsent: boolean
      mentionAbsent: boolean
    }
  }
  hints: {
    [key in string]?: string
  }
} = {
  banned: {},
  checkJobs: {},
  settings: {},
  hints: {},
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
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)
database.ref('/hints').on('child_added', updateCache)
database.ref('/hints').on('child_changed', updateCache)
database.ref('/hints').on('child_removed', removeCache)

export default database
