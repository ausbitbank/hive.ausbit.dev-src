import { describe, expect, it } from 'vitest'
import { collectAccountHistory, vaultHistorySince } from '../../src/services/accountHistory'

function row (index, timestamp = '2026-11-27T12:00:00') {
  return [index, { timestamp, op: ['transfer', { from: 'bob', to: 'alice' }] }]
}

describe('collectAccountHistory', () => {
  it('walks backwards until the requested time window', async () => {
    const pages = [
      [row(901, '2026-11-27T13:00:00'), row(902, '2026-11-27T13:00:00'), row(903, '2026-11-27T13:00:00'), row(904, '2026-11-27T13:00:00')],
      [row(897, '2026-11-27T11:00:00'), row(898, '2026-11-27T11:00:00'), row(899, '2026-11-27T11:00:00'), row(900, '2026-11-27T11:00:00')],
      [row(893, '2026-11-27T10:00:00'), row(894, '2026-11-27T10:00:00'), row(895, '2026-11-27T10:00:00'), row(896, '2026-11-27T10:00:00')]
    ]
    const calls = []
    const result = await collectAccountHistory({
      account: 'alice',
      fetchPage: async (account, options) => {
        calls.push({ account, ...options })
        return pages[calls.length - 1] || []
      },
      pages: 10,
      limit: 4,
      since: Date.parse('2026-11-27T12:00:00Z')
    })
    expect(result.rows.map(item => item[0])).toEqual([897, 898, 899, 900, 901, 902, 903, 904])
    expect(result.pages).toBe(2)
    expect(result.scanned).toBe(8)
    expect(result.complete).toBe(true)
    expect(result.truncated).toBe(false)
    expect(calls[0].from).toBe(-1)
    expect(calls[1].from).toBe(900)
  })

  it('deduplicates overlapping rows and reports a page-cap truncation', async () => {
    const result = await collectAccountHistory({
      account: 'alice',
      fetchPage: async (_account, { from }) => {
        if (from === -1) return [row(10), row(11)]
        if (from === 9) return [row(9), row(10), row(11)]
        return [row(8), row(9)]
      },
      pages: 2,
      limit: 2,
      since: 0
    })
    expect(result.rows.map(item => item[0])).toEqual([9, 10, 11])
    expect(result.pages).toBe(2)
    expect(result.truncated).toBe(true)
  })

  it('returns an empty complete result without an account', async () => {
    const result = await collectAccountHistory({ account: '', fetchPage: async () => [] })
    expect(result).toMatchObject({ rows: [], pages: 0, scanned: 0, complete: true, truncated: false })
  })

  it('defaults the window to 400 days', () => {
    const now = Date.parse('2026-11-27T00:00:00Z')
    expect(vaultHistorySince(now)).toBe(now - 400 * 24 * 60 * 60 * 1000)
  })
})
