import { WebhookClient } from 'discord.js'
import config from '../config'

export const loggerHook = new WebhookClient(...(config.DISCORD.LOGGER_HOOK as [string, string]))
