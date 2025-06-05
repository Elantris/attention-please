import { RESTPostAPIApplicationCommandsJSONBody, TextChannel } from 'discord.js'
import admin from 'firebase-admin'
import { readdirSync } from 'fs'
import { join } from 'path'
import appConfig from '../appConfig.js'
import { CommandProps, JobProps, LocaleType } from '../types.js'

admin.initializeApp({
  databaseURL: appConfig.FIREBASE.databaseURL,
  credential: admin.credential.cert({
    projectId: appConfig.FIREBASE.projectId,
    clientEmail: appConfig.FIREBASE.clientEmail,
    privateKey: appConfig.FIREBASE.privateKey,
  }),
})
export const database = admin.database()

const cache: {
  [key: string]: any
  logChannel: TextChannel | null
  isReady: boolean
  isInit: {
    [GuildID in string]?: number
  }
  isCooling: {
    [GuildID in string]?: boolean
  }
  isProcessing: {
    [GuildID in string]?: boolean
  }
  ban: {
    [ID in string]?: number
  }
  settings: {
    [GuildID in string]: {
      [key: string]: string | number | boolean
      // nameList
      reacted: boolean
      absent: boolean
      locked: boolean
      irrelevant: boolean
      leaved: boolean
      // timezone
      offset: number
      // locale
      locale: LocaleType
      // name list length
      length: number
    }
  }
  jobs: {
    [JobID in string]?: JobProps
  }
  version: string
} = {
  logChannel: null,
  isReady: false,
  isInit: {},
  isCooling: {},
  isProcessing: {},
  ban: {},
  settings: {},
  jobs: {},
  version: '2025-06-05',
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

database.ref('/ban').on('child_added', updateCache)
database.ref('/ban').on('child_changed', updateCache)
database.ref('/ban').on('child_removed', removeCache)
database.ref('/jobs').on('child_added', updateCache)
database.ref('/jobs').on('child_changed', updateCache)
database.ref('/jobs').on('child_removed', removeCache)

// load commands
export const commands: { [CommandName in string]?: CommandProps } = {}
export const commandBuildData: RESTPostAPIApplicationCommandsJSONBody[] = []

readdirSync(join(import.meta.dirname, '../commands')).forEach(async (filename) => {
  if (!filename.endsWith('.js') && !filename.endsWith('.ts')) {
    return
  }
  const commandName = filename.split('.')[0]
  const { default: command }: { default: CommandProps } = await import(
    join(import.meta.dirname, '../commands', filename)
  )
  commands[commandName] = command
  command.builds.forEach((build) => commandBuildData.push(build.toJSON()))
})

export default cache
