import { EmbedField } from 'discord.js'
import { ReactionStatusProps } from '../types'

const getAbsentMemberLists: (
  reactionStatus: ReactionStatusProps,
) => {
  allMembersCount: number
  reactedMembersCount: number
  absentMemberLists: EmbedField[]
} = reactionStatus => {
  const allMembersCount = Object.keys(reactionStatus).length
  const absentMemberNames = Object.keys(reactionStatus)
    .filter(userId => reactionStatus[userId].emoji.length === 0)
    .sort()
    .map(userId => reactionStatus[userId].name)
  const reactedMembersCount = allMembersCount - absentMemberNames.length

  const absentMemberLists = absentMemberNames
    .reduce((accumulator, value, index) => {
      const chunkIndex = Math.floor(index / 10)
      accumulator[chunkIndex] = ([] as string[]).concat(accumulator[chunkIndex] || [], value)
      return accumulator
    }, [] as string[][])
    .map((memberNames, pageIndex) => ({
      name: `Page ${pageIndex + 1}`,
      value: memberNames.map((memberName, index) => `\`${pageIndex * 10 + index + 1}.\` ${memberName}`).join('\n'),
      inline: true,
    }))

  return {
    allMembersCount,
    reactedMembersCount,
    absentMemberLists,
  }
}

export default getAbsentMemberLists
