import { APIEmbed, SlashCommandBuilder } from 'discord.js'
import { CommandProps, isLocaleType } from '../types'
import cache, { database } from '../utils/cache'
import { translate } from '../utils/translation'

const nameLists = ['reacted', 'absent', 'locked'] as const
type NameListType = typeof nameLists[number]
const isNameList = (target: string | null): target is NameListType => !!nameLists.find(v => v === target)

const build: CommandProps['build'] = new SlashCommandBuilder()
  .setName('config')
  .setDescription('偏好設定')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('設定顯示名單')
      .setDescriptionLocalizations({
        'en-US': 'Set visibility of name list.',
      })
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('名單類型')
          .setDescriptionLocalizations({
            'en-US': 'Name list type.',
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
          .setDescription('顯示或隱藏')
          .setDescriptionLocalizations({
            'en-US': 'Display or not.',
          })
          .setRequired(true)
          .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
      ),
  )
  // .addSubcommand(subcommand =>
  //   subcommand
  //     .setName('offset')
  //     .setDescription('設定時區偏移量')
  //     .setDescriptionLocalizations({
  //       'en-US': 'Set time offset.',
  //     })
  //     .addNumberOption(option =>
  //       option
  //         .setName('offset')
  //         .setDescription('介於 -12 ~ 12 之間的數字')
  //         .setDescriptionLocalizations({
  //           'en-US': 'A number in range of -12 ~ 12.',
  //         })
  //         .setRequired(true),
  //     ),
  // )
  // .addSubcommand(subcommand =>
  //   subcommand
  //     .setName('raffle')
  //     .setDescription('設定中獎人數')
  //     .addIntegerOption(option => option.setName('raffle').setDescription('輸入一個正整數').setRequired(true)),
  // )
  // .addSubcommand(subcommand =>
  //   subcommand
  //     .setName('locale')
  //     .setDescription('設定機器人語言')
  //     .addStringOption(option =>
  //       option
  //         .setName('locale')
  //         .setDescription('語言環境')
  //         .setRequired(true)
  //         .setChoices({ name: 'zh-TW', value: 'zh-TW' }, { name: 'en-US', value: 'en-US' }),
  //     ),
  // )
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
    // {
    //   name: 'offset',
    //   value: cache.settings[guildId].offset || 'GMT+8',
    // },
    // {
    //   name: 'raffle',
    //   value: cache.settings[guildId].raffle || 30,
    // },
    // {
    //   name: 'locale',
    //   value: cache.settings[guildId].locale || 'zh-TW',
    // },
  ]
}

const exec: CommandProps['exec'] = async interaction => {
  const guildId = interaction.guildId
  if (!interaction.isChatInputCommand() || !guildId) {
    return
  }

  const subcommand = interaction.options.getSubcommand()

  if (subcommand === 'list') {
    const type = interaction.options.getString('type')
    const action = interaction.options.getString('action')
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
    const offset = interaction.options.getNumber('offset')
    if (offset === null || offset < -12 || offset > 12) {
      return {
        content: translate('config.text.invalidOffset', { guildId }),
      }
    }

    const newValue = offset < 0 ? `GMT${offset}` : `GMT+${offset}`
    await database.ref(`/settings/${guildId}/offset`).set(newValue)
    cache.settings[guildId].offset = newValue

    return {
      content: translate('config.text.offsetUpdated', { guildId }).replace(
        '{OFFSET}',
        offset >= 0 ? `+${offset}` : `${offset}`,
      ),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  } else if (subcommand === 'raffle') {
    const raffle = interaction.options.getInteger('raffle')
    if (!raffle || raffle < 1) {
      return {
        content: translate('config.text.invalidRaffle', { guildId }),
      }
    }

    await database.ref(`/settings/${guildId}/raffle`).set(raffle)
    cache.settings[guildId].raffle = raffle

    return {
      content: translate('config.text.raffleUpdated', { guildId }).replace('{RAFFLE}', `${raffle}`),
      embed: {
        fields: getAllConfigs(guildId),
      },
    }
  } else if (subcommand === 'locale') {
    const locale = interaction.options.getString('locale')
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
