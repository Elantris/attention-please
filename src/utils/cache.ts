import { RESTPostAPIApplicationCommandsJSONBody, TextChannel } from 'discord.js'
import admin, { ServiceAccount } from 'firebase-admin'
import { readdirSync } from 'fs'
import { join } from 'path'
import appConfig from '../appConfig'
import { CommandProps, JobProps, LocaleType } from '../types'

admin.initializeApp({
  credential: admin.credential.cert(appConfig.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: appConfig.FIREBASE.databaseURL,
})
export const database = admin.database()

const cache: {
  [key: string]: any
  logChannel?: TextChannel
  isInit: {
    [GuildID in string]?: boolean
  }
  isCooling: {
    [GuildID in string]?: boolean
  }
  isProcessing: {
    [GuildID in string]?: boolean
  }
  banned: {
    [ID in string]?: number
  }
  settings: {
    [GuildID in string]: {
      [key: string]: string | number | boolean
      // nameList
      reacted: boolean
      absent: boolean
      locked: boolean
      // offset
      offset: string
      // raffle
      raffle: number
      // locale
      locale: LocaleType
    }
  }
  jobs: {
    [JobID in string]?: JobProps
  }
} = {
  isInit: {},
  isCooling: {},
  isProcessing: {},
  banned: {},
  remindSettings: {},
  settings: {},
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
database.ref('/jobs').on('child_added', updateCache)
database.ref('/jobs').on('child_changed', updateCache)
database.ref('/jobs').on('child_removed', removeCache)

// load commands
export const commands: { [CommandName in string]?: CommandProps } = {}
export const commandBuilds: RESTPostAPIApplicationCommandsJSONBody[] = []

readdirSync(join(__dirname, '../commands')).forEach(async filename => {
  if (!filename.endsWith('.js') && !filename.endsWith('.ts')) {
    return
  }
  const commandName = filename.split('.')[0]
  const {
    default: command,
  }: {
    default: CommandProps
  } = await import(join(__dirname, '../commands', filename))
  commands[commandName] = command
  commandBuilds.push(command.build)
})

export default cache
