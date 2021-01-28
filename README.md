# Attention Please
A Discord bot for finding who did not react to the announcement.


## Invite Link
https://discord.com (/) api/oauth2/authorize?client_id=801820692500054087&permissions=0&scope=bot


## Command

### Check
List members did not react to the target message. Make sure the bot and all mentioned members have the right permissions to see and react to the target message.

`ap!check [Message ID]`

Examples:
```
ap!check 802509450447290399
```

### Remind
Same result of command check will be post at certain time.

`ap!remind [Message ID] [Remind At]`

Examples:
```
ap!remind 802509450447290399 2021-01-24T00:00:00+08:00
ap!remind 802509450447290399 2021-01-24 00:00:00
```

### Settings
Manage the guild settings.

`ap!settings (SettingsItem) (Value)`

SettingsItem:
- **prefix**: the prefix of command to trigger the bot
- **timezone**: hours of offset to parse time string

Examples:
```
ap!settings            # list all settings
ap!settings prefix     # show certain settings item value
ap!settings timezone 8 # set the value 
```
