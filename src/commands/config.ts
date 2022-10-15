import { APIEmbed, escapeMarkdown, SlashCommandBuilder } from 'discord.js'
import { CommandProps, isLocaleType } from '../types'
import cache, { database } from '../utils/cache'
import { translate } from '../utils/translation'

const nameLists = ['reacted', 'absent', 'locked'] as const
type NameListType = typeof nameLists[number]
const isNameList = (target: string): target is NameListType => !!nameLists.find(v => v === target)

const build: CommandProps['build'] = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Bot preferences.')
  .setDescriptionLocalizations({
    'zh-TW': '偏好設定',
  })
  .addSubcommand(subcommand =>
    subcommand.setName('all').setDescription('Show all configs.').setDescriptionLocalizations({
      'zh-TW': '查看當前所有設定',
    }),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Set visibility of name list.')
      .setDescriptionLocalizations({
        'zh-TW': '設定顯示名單',
      })
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Name list type.')
          .setDescriptionLocalizations({
            'zh-TW': '名單類型',
          })
          .setRequired(true)
          .addChoices(
            { name: 'reacted', value: 'reacted' },
            { name: 'absent', value: 'absent' },
            { name: 'locked', value: 'locked' },
          ),
      )
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Display or not.')
          .setDescriptionLocalizations({
            'zh-TW': '顯示或隱藏',
          })
          .setRequired(true)
          .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('offset')
      .setDescription('Set time offset.')
      .setDescriptionLocalizations({
        'zh-TW': '設定時間偏移量',
      })
      .addNumberOption(option =>
        option
          .setName('offset')
          .setDescription('A number in range of -12 ~ 12. Example: GMT+8, enter 8.')
          .setDescriptionLocalizations({
            'zh-TW': '介於 -12 ~ 12 之間的數字，例如 GMT+8 則輸入 8',
          })
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('locale')
      .setDescription('Set locale of bot.')
      .setNameLocalizations({
        'zh-TW': '設定機器人語言',
      })
      .addStringOption(option =>
        option
          .setName('locale')
          .setDescription('Locale')
          .setDescriptionLocalizations({
            'zh-TW': '語言環境',
          })
          .setRequired(true)
          .setChoices({ name: 'zh-TW', value: 'zh-TW' }, { name: 'en-US', value: 'en-US' }),
      ),
  )
  .toJSON()

const getAllConfigs: (guildId: string) => APIEmbed['fields'] = guildId => {
  return [
    {
      name: 'Reacted',
      value: translate(`config.label.${cache.settings[guildId].reacted === false ? 'hidden' : 'show'}`, { guildId }),
      inline: true,
    },
    {
      name: 'Absent',
      value: translate(`config.label.${cache.settings[guildId].absent === false ? 'hidden' : 'show'}`, { guildId }),
      inline: true,
    },
    {
      name: 'Locked',
      value: translate(`config.label.${cache.settings[guildId].locked === false ? 'hidden' : 'show'}`, { guildId }),
      inline: true,
    },
    {
      name: 'Offset',
      value: `${cache.settings[guildId].offset ?? 8}`,
    },
    // {
    //   name: 'Locale',
    //   value: cache.settings[guildId].locale || 'zh-TW',
    // },
  ]
}

const exec: CommandProps['exec'] = async interaction => {
  const guildId = interaction.guildId
  const guild = interaction.guild
  if (!interaction.isChatInputCommand() || !guildId || !guild) {
    return
  }

  const subcommand = interaction.options.getSubcommand()

  if (subcommand === 'all') {
    return {
      content: translate('config.text.allConfigs', { guildId }).replace('{GUILD_NAME}', escapeMarkdown(guild.name)),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  } else if (subcommand === 'list') {
    const type = interaction.options.getString('type', true)
    const action = interaction.options.getString('action', true)
    if (!isNameList(type) || (action !== 'on' && action !== 'off')) {
      return
    }

    await database.ref(`/settings/${guildId}/${type}`).set(action === 'on')
    cache.settings[guildId][type] = action === 'on'

    return {
      content: translate('config.text.nameListUpdated', { guildId })
        .replace('{NAME_LIST}', translate(`config.label.${type}`, { guildId }))
        .replace('{ACTION}', translate(`config.label.${action === 'on' ? 'show' : 'hidden'}`, { guildId })),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  } else if (subcommand === 'offset') {
    const offset = interaction.options.getNumber('offset', true)
    if (offset < -12 || offset > 12) {
      return {
        content: translate('config.text.invalidOffset', { guildId }),
      }
    }

    const newValue = Math.round(offset * 4) / 4
    await database.ref(`/settings/${guildId}/offset`).set(newValue)
    cache.settings[guildId].offset = newValue

    return {
      content: translate('config.text.offsetUpdated', { guildId }).replace('{OFFSET}', `${newValue}`),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  } else if (subcommand === 'locale') {
    const locale = interaction.options.getString('locale', true)
    if (!isLocaleType(locale)) {
      return
    }

    await database.ref(`/settings/${guildId}/locale`).set(locale)
    cache.settings[guildId].locale = locale

    return {
      content: translate('config.text.localeUpdated', { locale }),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  }
  return
}

const command: CommandProps = {
  build,
  exec,
}

export default command
