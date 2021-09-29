import { DateTime } from 'luxon'

const timeFormatter: (time?: number | null) => string = time =>
  DateTime.fromMillis(time || Date.now()).toFormat('yyyy-MM-dd HH:mm')

export default timeFormatter
