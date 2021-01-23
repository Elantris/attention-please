import { Client, DMChannel } from 'discord.js'
import moment from 'moment'
import getAbsentMemberLists from './getAbsentMemberLists'
import getReactionStatus from './getReactionStatus'
import { loggerHook } from './hooks'

export const remindJobQueue: {
  [JobId: string]: {
    remindAt: number
    guildId: string
    channelId: string
    messageId: string
    responseChannelId: string
    retryTimes: number
  }
} = {}

const remindCronjob: (client: Client) => Promise<void> = async client => {
  const now = Date.now()

  for (const jobId in remindJobQueue) {
    if (remindJobQueue[jobId].remindAt > now) {
      continue
    }

    try {
      const targetChannel = await client.channels.fetch(remindJobQueue[jobId].channelId)
      const responseChannel = await client.channels.fetch(remindJobQueue[jobId].responseChannelId)
      if (
        !targetChannel.isText() ||
        targetChannel instanceof DMChannel ||
        !responseChannel.isText() ||
        responseChannel instanceof DMChannel
      ) {
        delete remindJobQueue[jobId]
        continue
      }

      const targetMessage = await targetChannel.messages.fetch(remindJobQueue[jobId].messageId)
      const reactionStatus = await getReactionStatus(targetMessage)
      const { allMembersCount, reactedMembersCount, absentMemberLists } = getAbsentMemberLists(reactionStatus)

      const response = {
        content: `:bar_chart: 簽到率：**PERCENTAGE%**，(REACTED_MEMBERS / ALL_MEMBERS)`
          .replace('PERCENTAGE', ((reactedMembersCount * 100) / allMembersCount).toFixed(2))
          .replace('REACTED_MEMBERS', `${reactedMembersCount}`)
          .replace('ALL_MEMBERS', `${allMembersCount}`),
        embed: {
          title: `Message ID: \`${targetMessage.id}\``,
          url: targetMessage.url,
          description: '沒有按表情回應的名單',
          fields: absentMemberLists,
        },
      }
      const responseMessage = await responseChannel.send(response)
      loggerHook.send(
        '[`TIME`] `GUILD_ID` `MESSAGE_ID` is reminded at [`REMIND_AT`]\nRESPONSE_CONTENT (**DELAY_TIMEms**)'
          .replace('TIME', moment(responseMessage.createdTimestamp).format('HH:mm:ss'))
          .replace('GUILD_ID', remindJobQueue[jobId].guildId)
          .replace('MESSAGE_ID', remindJobQueue[jobId].messageId)
          .replace('REMIND_AT', moment(remindJobQueue[jobId].remindAt).format('HH:mm:ss'))
          .replace('RESPONSE_CONTENT', responseMessage.content)
          .replace('DELAY_TIME', `${responseMessage.createdTimestamp - remindJobQueue[jobId].remindAt}`),
        { embeds: [response.embed] },
      )
      delete remindJobQueue[jobId]
    } catch {
      if (remindJobQueue[jobId].retryTimes > 3) {
        delete remindJobQueue[jobId]
        continue
      }
      remindJobQueue[jobId].retryTimes += 1
    }
  }
}

export default remindCronjob
