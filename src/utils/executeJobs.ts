import { Client, TextChannel, Util } from 'discord.js'
import OpenColor from 'open-color'
import { makeCheckLists } from '../commands/check'
import { makeRaffleLists } from '../commands/raffle'
import cache, { database } from './cache'
import executeResult from './executeResult'
import sendLog from './sendLog'
import timeFormatter from './timeFormatter'

let lock = 0

const executeJobs = async (client: Client) => {
  if (lock) {
    return
  }
  lock = 1

  for (const jobId in cache.jobs) {
    const executeAt = Date.now()
    const job = cache.jobs[jobId]

    if (!job || job.clientId !== client.user?.id || job.executeAt > executeAt) {
      continue
    }

    try {
      const targetGuild = client.guilds.cache.get(job.command.guildId)
      const targetChannel = client.channels.cache.get(job.target.channelId)
      if (!targetGuild || !(targetChannel instanceof TextChannel)) {
        throw new Error('target channel not found')
      }
      const targetMessage = await targetChannel.messages.fetch(job.target.messageId)

      if (job.type === 'check') {
        const commandChannel = client.channels.cache.get(job.command.channelId) as TextChannel
        const commandMessage = await commandChannel.messages.fetch(job.command.messageId || '')
        const result = await makeCheckLists(targetMessage)
        await executeResult(commandMessage, result, {
          createdAt: executeAt,
          color: OpenColor.yellow[5],
          content: `Execute check job \`${jobId}\``,
        })
        await database.ref(`/jobs/${jobId}`).remove()
      } else if (job.type === 'remind') {
        const user = await client.users.fetch(job.command.userId)
        const remindMessage = await user.send({
          content: targetMessage.content,
          embeds: [
            {
              color: 0xff922b,
              author: {
                name: targetMessage.author.username,
                iconURL: targetMessage.author.displayAvatarURL() || undefined,
              },
              description: '發送時間：`TIME` (FROM_NOW)\n訊息連結：[GUILD_NAME/CHANNEL_NAME](MESSAGE_URL)'
                .replace('TIME', timeFormatter({ guildId: job.command.guildId, time: targetMessage.createdTimestamp }))
                .replace('FROM_NOW', `<t:${Math.floor(targetMessage.createdTimestamp / 1000)}:R>`)
                .replace('GUILD_NAME', Util.escapeMarkdown(targetGuild.name))
                .replace('CHANNEL_NAME', Util.escapeMarkdown(targetChannel.name))
                .replace('MESSAGE_URL', targetMessage.url),
            },
          ],
        })
        await remindMessage.react('✅').catch(() => {})
        await database.ref(`/jobs/${jobId}`).remove()

        sendLog(client, {
          color: OpenColor.yellow[5],
          time: executeAt,
          content: `Execute remind job \`${jobId}\``,
          embeds: remindMessage.embeds,
          guildId: job.command.guildId,
          channelId: job.command.channelId,
          userId: job.command.userId,
          processTime: remindMessage.createdTimestamp - executeAt,
        })
      } else if (job.type === 'raffle') {
        const commandChannel = client.channels.cache.get(job.command.channelId) as TextChannel
        const commandMessage = await commandChannel.messages.fetch(job.command.messageId || '')
        const result = await makeRaffleLists(targetMessage)
        await executeResult(commandMessage, result, {
          createdAt: executeAt,
          color: OpenColor.yellow[5],
          content: `Execute raffle job \`${jobId}\``,
        })
        await database.ref(`/jobs/${jobId}`).remove()
      }
    } catch (error: any) {
      if (job.retryTimes > 3) {
        sendLog(client, {
          time: executeAt,
          content: 'Fail to execute job `JOB_ID`'.replace('JOB_ID', jobId),
          guildId: job.command.guildId,
          channelId: job.command.channelId,
          userId: job.command.userId,
          processTime: Date.now() - executeAt,
          error,
        })
        await database.ref(`/jobs/${jobId}`).remove()
      } else {
        await database.ref(`/jobs/${jobId}/retryTimes`).set(job.retryTimes + 1)
      }
    }
  }

  lock = 0
}

export default executeJobs
