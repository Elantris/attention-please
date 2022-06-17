import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import { translate } from '../utils/translation'

const commandRemind: CommandProps = async ({ message, guildId, args }) => {
  const remindSettings = cache.remindSettings[message.author.id] || {}

  if (args.length < 3) {
    return {
      a: 1,
      response: {
        content: translate('remind.text.remindSummary', { guildId })
          .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
          .replace('COUNT', `${Object.keys(remindSettings).length}`),
        embed: {
          description: Object.entries(remindSettings)
            .sort((a, b) => a[1] - b[1])
            .map(([emoji, minutes]) =>
              translate('remind.text.emojiRemindTime', { guildId })
                .replace('EMOJI', emoji)
                .replace('MINUTES', `${minutes}`),
            )
            .join('\n'),
        },
      },
    }
  }

  const emoji = args[1]
  const minutes = parseInt(args[2])

  if (!Number.isSafeInteger(minutes) || minutes > 1440) {
    return {
      response: {
        content: translate('remind.error.remindTimeLimit', { guildId }),
        embed: {
          description: translate('remind.error.remindTimeLimitDescription', { guildId }),
        },
      },
    }
  }

  try {
    if (emoji.length < 2) {
      throw new Error('Invalid emoji')
    }
    await message.react(emoji)
  } catch {
    return {
      response: {
        content: translate('remind.error.invalidEmoji', { guildId }),
        embed: {
          description: translate('remind.error.invalidEmojiDescription', { guildId }),
        },
      },
    }
  }

  if (minutes < 0) {
    await database.ref(`/remindSettings/${message.author.id}/${emoji}`).remove()
    return {
      response: {
        content: translate('remind.text.remindTimeRemoved', { guildId })
          .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
          .replace('EMOJI', emoji)
          .trim(),
      },
    }
  }

  if (!remindSettings[emoji] && Object.keys(remindSettings).length >= 10) {
    return {
      response: {
        content: translate('remind.error.remindEmojiLimit', { guildId }),
        embed: {
          description: translate('remind.error.remindEmojiLimitHelp', { guildId }),
        },
      },
    }
  }

  await database.ref(`/remindSettings/${message.author.id}/${emoji}`).set(minutes)

  return {
    response: {
      content: translate('remind.text.remindTimeCreated', { guildId })
        .replace('MEMBER_NAME', Util.escapeMarkdown(message.member?.displayName || message.author.tag))
        .replace('EMOJI', emoji)
        .replace('REMIND_TIME', `${minutes}`)
        .trim(),
      embed: {
        description: translate('remind.text.remindTimeCreatedHelp', { guildId }).replace('REMIND_TIME', `${minutes}`),
      },
    },
  }
}

export default commandRemind
