import { Message, TextChannel, Util } from 'discord.js'
import { DateTime } from 'luxon'
import { ResponseProps } from '../types'
import cache from './cache'

const fetchTargetMessage: (options: { message: Message; guildId: string; args: string[] }) => Promise<{
  targetMessage?: Message
  time?: number
  response?: ResponseProps
}> = async ({ message, guildId, args }) => {
  const search = message.reference?.messageId || args[1]
  if (!search) {
    return {
      response: {
        content: ':question: 請指定一則訊息',
        embed: {
          description:
            '1. 右鍵選擇「回覆」，並輸入指令 `ap!check` 或 `ap!raffle`\n2. 右鍵選擇「複製訊息連結」，輸入 `ap!check 訊息連結` 或 `ap!raffle 訊息連結`',
        },
      },
    }
  }

  const options: {
    channelId?: string
    messageId?: string
    time?: string
  } = {}

  if (message.reference?.messageId) {
    options.channelId = message.reference.channelId
    options.messageId = message.reference.messageId
    options.time = args.slice(1).join(' ')
  } else if (/^https:\/\/\S*\/channels\/\d+\/\d+\/\d+$/.test(search)) {
    // full message link
    const [channelId, messageId] = search.split('/').slice(-2)
    options.channelId = channelId
    options.messageId = messageId
    options.time = args.slice(2).join(' ')
  } else if (/^\d+\-\d+$/.test(search)) {
    // channel id - message id
    const [channelId, messageId] = search.split('-')
    options.channelId = channelId
    options.messageId = messageId
    options.time = args.slice(2).join(' ')
  } else if (/^\d+$/.test(search)) {
    // message id
    options.messageId = search
    options.time = args.slice(2).join(' ')
  }

  if (!options.messageId) {
    return {
      response: {
        content: ':x: 目標訊息格式錯誤',
        embed: {
          description:
            '指定訊息格式：\n1. 右鍵複製訊息連結\n2. 對著訊息按住 shift 右上角有複製 ID 的按鈕\n3. 右鍵選單最底下有複製訊息 ID 的選項',
        },
      },
    }
  }

  let targetMessage: Message | undefined = undefined
  if (options.channelId) {
    const targetChannel = message.client.channels.cache.get(options.channelId)
    if (targetChannel instanceof TextChannel) {
      targetMessage = await targetChannel.messages.fetch(options.messageId)
    }
  } else {
    const guildChannels: TextChannel[] = []
    message.guild?.channels.cache.forEach(channel => {
      if (channel instanceof TextChannel) {
        guildChannels.push(channel)
      }
    })
    for (const channel of guildChannels) {
      try {
        targetMessage = await channel.messages.fetch(options.messageId)
        break
      } catch {}
    }
  }

  if (targetMessage?.guild?.id !== guildId) {
    return {
      response: {
        content: ':question: 找不到這則訊息',
        embed: {
          description: '1. 機器人可能沒有權限看到這則訊息\n2. 這則訊息可能在別的伺服器',
        },
      },
    }
  }

  if (!targetMessage.mentions.everyone && !targetMessage.mentions.roles.size && !targetMessage.mentions.members?.size) {
    return {
      response: {
        content: ':x: 這則訊息沒有標記對象',
        embed: {
          description: '請選擇一個有標記對象的訊息，例如：\n1. @everyone\n2. @身份組\n3. @成員',
        },
      },
    }
  }

  let time: number | undefined = undefined
  if (options.time) {
    time = DateTime.fromFormat(options.time, 'yyyy-MM-dd HH:mm', {
      zone: cache.settings[guildId]?.timezone || 'Asia/Taipei',
    }).toMillis()

    if (Number.isNaN(time)) {
      return {
        response: {
          content: ':x: 指定時間的格式好像怪怪的',
          embed: {
            description: '標準時間格式：`YYYY-MM-DD HH:mm`（西元年-月-日 時:分）\n使用者的輸入：`USER_INPUT`'.replace(
              'USER_INPUT',
              Util.escapeMarkdown(options.time),
            ),
          },
        },
      }
    }
  }

  return {
    targetMessage,
    time,
  }
}

export default fetchTargetMessage
