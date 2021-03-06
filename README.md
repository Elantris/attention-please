# Attention Please
Discord 點名簽到機器人，檢查一則訊息內被標記但沒有按表情回應的人
A Discord bot for finding who did not react to the announcement.


## 邀請連結 Invite Links
- 加入開發群組 Join eeBots Support
  https://discord.gg (/) Ctwz4BB
- 邀請機器人 Invite Attention Please
  https://discord.com (/) api/oauth2/authorize?client_id=801820692500054087&permissions=0&scope=bot


## 指令列表 Commands

### Check
檢查一則訊息中被標記到但沒有按任何表情回應的成員，使用前請先確認機器人以及被標記的成員都擁有權限讀取這則訊息、對這則訊息新增表情。
List members did not react to the target message. Make sure the bot and all mentioned members have the right permissions to see and react to the target message.

`ap!check [Message ID]`

Examples:
```
ap!check 802509450447290399
```

### Remind
跟 `ap!check` 一樣的功能，會在指定的時間結算。
Same result of command check will be post at certain time.
https://momentjs.com/docs/#/parsing/string/

`ap!remind [Message ID] [Remind At]`

Examples:
```
ap!remind 802509450447290399 2021-01-24T00:00:00+08:00
ap!remind 802509450447290399 2021-01-24 00:00:00
```

### Settings
管理機器人設定。
Manage the guild settings.

`ap!settings (Key) (Value)`

設定項目 Key:
- 指令前綴 **prefix**
  觸發機器人指令的前綴詞
  the prefix of command to trigger the bot
- 時區 **timezone**
  指定使用指令的時區
  hours of offset to parse time string
  https://momentjs.com/docs/#/manipulating/utc-offset/

Examples:
```
ap!settings            # list all settings
ap!settings prefix     # show certain settings item value
ap!settings timezone 8 # set the value 
```

### Help
顯示指令前綴與說明文件、開發群組的連結。
Show current command prefix and the link to README.

Examples:
```
ap!help
```
