import { APIEmbed, escapeMarkdown, SlashCommandBuilder } from 'discord.js'
import { CommandProps, isInArray, localeLabels, memberStatusLabels } from '../types'
import cache, { database } from '../utils/cache'
import timeFormatter from '../utils/timeFormatter'
import { translate } from '../utils/translation'

const builds: CommandProps['builds'] = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Bot preferences.')
    .setDescriptionLocalizations({
      'zh-TW': '偏好設定',
    })
    .addSubcommand((subcommand) =>
      subcommand.setName('all').setDescription('Show all configs.').setDescriptionLocalizations({
        'zh-TW': '查看當前所有設定',
      }),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Set visibility of name list.')
        .setDescriptionLocalizations({
          'zh-TW': '設定顯示名單',
        })
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Name list type.')
            .setDescriptionLocalizations({
              'zh-TW': '名單類型',
            })
            .setRequired(true)
            .addChoices(
              ...memberStatusLabels.map((memberStatus) => ({
                name: memberStatus,
                name_localizations: {
                  'zh-TW': translate(`config.label.${memberStatus}`, { locale: 'zh-TW' }),
                },
                value: memberStatus,
              })),
            ),
        )
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Display or not.')
            .setDescriptionLocalizations({
              'zh-TW': '顯示或隱藏',
            })
            .setRequired(true)
            .addChoices(
              { name: 'show', name_localizations: { 'zh-TW': '顯示' }, value: 'show' },
              { name: 'hidden', name_localizations: { 'zh-TW': '隱藏' }, value: 'hidden' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('offset')
        .setDescription('Set time offset.')
        .setDescriptionLocalizations({
          'zh-TW': '設定時間偏移量',
        })
        .addNumberOption((option) =>
          option
            .setName('offset')
            .setDescription('A number in range of -12 ~ 12. Example: GMT+8, enter 8.')
            .setDescriptionLocalizations({
              'zh-TW': '介於 -12 ~ 12 之間的數字，例如 GMT+8 則輸入 8',
            })
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('length')
        .setDescription('Set the length of name list in check result.')
        .setDescriptionLocalizations({
          'zh-TW': '設定結算的名單長度',
        })
        .addIntegerOption((option) =>
          option
            .setName('length')
            .setDescription('A number between 0 and 300. Set the members count in a response with name lists.')
            .setDescriptionLocalizations({
              'zh-TW': '介於 0 ~ 300 之間的數字，設定機器人回應的名單內能夠含有的最大成員數量，超過時會輸出成檔案',
            })
            .setRequired(true),
        ),
    )
    .setDMPermission(false),
]

const getAllConfigs: (guildId: string) => APIEmbed['fields'] = (guildId) => {
  return [
    {
      name: 'Length',
      value: `${cache.settings[guildId].length ?? 100}`,
      inline: true,
    },
    {
      name: 'Offset',
      value: `${cache.settings[guildId].offset ?? 8}`,
      inline: true,
    },
    {
      name: 'List',
      value: memberStatusLabels
        .map(
          (memberStatus) =>
            `${translate(`config.label.${memberStatus}`, { guildId })} ${translate(
              `config.label.${cache.settings[guildId][memberStatus] ? 'show' : 'hidden'}`,
              { guildId },
            )}`,
        )
        .join('\n'),
    },
  ]
}

const exec: CommandProps['exec'] = async (interaction) => {
  const { guildId, guild } = interaction
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
  }

  if (subcommand === 'list') {
    const type = interaction.options.getString('type', true)
    const action = interaction.options.getString('action', true)
    if (!isInArray(type, memberStatusLabels) || (action !== 'show' && action !== 'hidden')) {
      return
    }

    await database.ref(`/settings/${guildId}/${type}`).set(action === 'show')
    cache.settings[guildId][type] = action === 'show'

    return {
      content: translate('config.text.nameListUpdated', { guildId })
        .replace('{NAME_LIST}', translate(`config.label.${type}`, { guildId }))
        .replace('{ACTION}', translate(`config.label.${action === 'show' ? 'show' : 'hidden'}`, { guildId })),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  }

  if (subcommand === 'offset') {
    const offset = interaction.options.getNumber('offset', true)
    if (offset < -12 || offset > 12) {
      throw new Error('INVALID_OFFSET')
    }

    const newValue = Math.round(offset * 4) / 4
    await database.ref(`/settings/${guildId}/offset`).set(newValue)
    cache.settings[guildId].offset = newValue

    return {
      content: translate('config.text.offsetUpdated', { guildId })
        .replace('{OFFSET}', `${newValue}`)
        .replace(`{TIME}`, timeFormatter({ guildId, format: 'yyyy-MM-dd HH:mm' })),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  }

  if (subcommand === 'locale') {
    const locale = interaction.options.getString('locale', true)
    if (!isInArray(locale, localeLabels)) {
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

  if (subcommand === 'length') {
    const length = interaction.options.getInteger('length', true)
    if (length < 0 || length > 300) {
      throw new Error('INVALID_LENGTH')
    }

    await database.ref(`/settings/${guildId}/length`).set(length)
    cache.settings[guildId].length = length

    return {
      content: translate('config.text.lengthUpdated', { guildId }).replace(/\{LENGTH\}/g, `${length}`),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  }
}

const command: CommandProps = {
  builds,
  exec,
}

export default command
