import { Client, GuildMember, PartialGuildMember } from 'discord.js'
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
  checkJobs: {
    [JobID in string]?: CheckJobProps
  }
  displayNames: {
    [GuildID in string]?: {
      [MemberID in string]?: string
    }
  }
  hints: {
    [key in string]?: string
  }
  memberRoles: {
    [GuildID in string]?: {
      [MemberID in string]?: string
    }
  }
  remindJobs: {
    [JobID in string]?: RemindJobProps
  }
  remindSettings: {
    [UserId in string]?: {
      [emoji in string]: number
    }
  }
  settings: {
    [GuildID in string]?: {
      prefix: string
      timezone: number
      enableRemind: boolean
      showReacted: boolean
      showAbsent: boolean
      // hidden settings
      mentionAbsent: boolean
    }
  }
  syntaxErrorsCounts: {
    [UserID in string]?: number
  }
  isMembersFetched: {
    [GuildID in string]?: boolean
  }
} = {
  banned: {},
  checkJobs: {},
  displayNames: {},
  hints: {},
  memberRoles: {},
  remindJobs: {},
  remindSettings: {},
  settings: {},
  syntaxErrorsCounts: {},
  isMembersFetched: {},
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

database
  .ref('/displayNames')
  .once('value')
  .then(snapshot => {
    cache.displayNames = snapshot.val() || {}
  })
database
  .ref('/memberRoles')
  .once('value')
  .then(snapshot => {
    cache.memberRoles = snapshot.val() || {}
  })

export const updateCachedMembers = async (client: Client) => {
  for (const guild of client.guilds.cache.array()) {
    const displayNamesUpdates: { [MemberID: string]: string } = {}
    const memberRolesUpdates: { [MemberID: string]: string } = {}

    const guildMembers = guild.members.cache.filter(member => !member.user.bot).array()
    for (const member of guildMembers) {
      if (cache.displayNames[guild.id]?.[member.id] !== member.displayName) {
        displayNamesUpdates[member.id] = member.displayName
      }
      const memberRoles = member.roles.cache
        .map(role => role.id)
        .sort()
        .join(' ')
      if (cache.memberRoles[guild.id]?.[member.id] !== memberRoles) {
        memberRolesUpdates[member.id] = memberRoles
      }
    }

    if (Object.keys(displayNamesUpdates).length) {
      cache.displayNames[guild.id] = {
        ...(cache.displayNames[guild.id] || {}),
        ...displayNamesUpdates,
      }
      await database.ref(`/displayNames/${guild.id}`).update(displayNamesUpdates)
    }
    if (Object.keys(memberRolesUpdates).length) {
      cache.memberRoles[guild.id] = {
        ...(cache.memberRoles[guild.id] || {}),
        ...memberRolesUpdates,
      }
      await database.ref(`/memberRoles/${guild.id}`).update(memberRolesUpdates)
    }
  }
}

export const removeCachedMembers = async (member: GuildMember | PartialGuildMember) => {
  await database.ref(`/displayNames/${member.guild.id}/${member.id}`).remove()
  await database.ref(`/memberRoles/${member.guild.id}/${member.id}`).remove()
}

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
