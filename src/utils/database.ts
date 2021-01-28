import firebase from 'firebase'
import config from '../config'
import { RemindJobProps } from '../types'

firebase.initializeApp(config.FIREBASE)
const database = firebase.database()

const cache: {
  remind_jobs: {
    [JobID: string]: RemindJobProps
  }
  settings: {
    [GuildID: string]: {
      [key: string]: any
      timezone: number
      prefix: string
    }
  }
} = {
  remind_jobs: {},
  settings: {},
}

const updateCache = (snapshot: firebase.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key as keyof typeof cache | null | undefined
  if (key && snapshot.key) {
    cache[key][snapshot.key] = snapshot.val()
  }
}
const removeCache = (snapshot: firebase.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key as keyof typeof cache | null | undefined
  if (key && snapshot.key) {
    delete cache[key][snapshot.key]
  }
}

database.ref('/remind_jobs').on('child_added', updateCache)
database.ref('/remind_jobs').on('child_changed', updateCache)
database.ref('/remind_jobs').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)

export { cache }
export default database
