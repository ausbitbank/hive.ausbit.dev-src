// Dayjs compatibility wrapper.
//
// The app historically used moment.js. This module keeps the moment-style call
// sites (moment.utc(), moment.unix(), moment.duration().humanize()) working on
// top of the much smaller dayjs, so date logic did not have to be rewritten.
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import duration from 'dayjs/plugin/duration.js'

dayjs.extend(utc)
dayjs.extend(relativeTime)
dayjs.extend(duration)

function moment (input) {
  return dayjs(input)
}

moment.utc = input => dayjs.utc(input)
moment.unix = input => dayjs.unix(input)
moment.duration = (value, unit) => dayjs.duration(value, unit)

export default moment
