import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import moment from '../../src/utils/time'

describe('time compatibility wrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats UTC values', () => {
    expect(moment.utc('2024-01-02T03:04:05Z').format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2024-01-02 03:04:05'
    )
  })

  it('formats unix timestamps and converts to UTC', () => {
    const unix = 1718452800 // 2024-06-15T12:00:00Z

    expect(moment.unix(unix).valueOf()).toBe(unix * 1000)
    expect(moment.unix(unix).format('YYYY-MM')).toBe('2024-06')
    expect(moment.unix(unix).utc().format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2024-06-15 12:00:00'
    )
  })

  it('produces relative time strings', () => {
    expect(moment('2026-11-17T11:00:00Z').fromNow()).toBe('an hour ago')
    expect(moment('2026-11-17T13:00:00Z').fromNow()).toBe('in an hour')
    expect(moment('2026-11-15T12:00:00Z').fromNow()).toBe('2 days ago')
  })

  it('humanizes durations with suffix', () => {
    expect(moment.duration(5, 'minutes').humanize(true)).toBe('in 5 minutes')
    expect(moment.duration(-5, 'minutes').humanize(true)).toBe('5 minutes ago')
    expect(moment.duration(2, 'days').humanize(true)).toBe('in 2 days')
  })

  it('supports add and subtract chains', () => {
    const result = moment.utc('2024-01-01T00:00:00Z')
      .add(2, 'days')
      .subtract(3, 'hours')
      .format('YYYY-MM-DD HH:mm:ss')

    expect(result).toBe('2024-01-02 21:00:00')
  })

  it('compares dates', () => {
    const earlier = moment.utc('2024-01-01T00:00:00Z')
    const later = moment.utc('2024-01-02T00:00:00Z')

    expect(earlier.isBefore(later)).toBe(true)
    expect(later.isAfter(earlier)).toBe(true)
    expect(later.isBefore(earlier)).toBe(false)
    expect(earlier.isAfter(later)).toBe(false)
    expect(earlier.isBefore(later, 'day')).toBe(true)
  })

  it('accepts Date input', () => {
    const date = new Date('2024-05-06T07:08:09Z')

    expect(moment(date).utc().format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2024-05-06 07:08:09'
    )
  })
})
