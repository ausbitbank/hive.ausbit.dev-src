import { describe, expect, it } from 'vitest'
import { accountWatchlistSummary } from '../../src/services/accountWatchlist'

const GLOBAL_PROPS = {
  total_vesting_fund_hive: '1000000.000 HIVE',
  total_vesting_shares: '350290817133.487929 VESTS'
}

/** Raw chain reputation that `formatReputation` turns into `score`. */
function rawReputation (score) {
  return Math.pow(10, (score - 25) / 9) * 1e9
}

function account (name, extra = {}) {
  return {
    name,
    reputation: rawReputation(50),
    vesting_shares: '1000000.000000 VESTS',
    balance: '10.500 HIVE',
    hbd_balance: '2.250 HBD',
    post_count: 42,
    created: '2020-01-02T03:04:05',
    ...extra
  }
}

const RECORDS = {
  alice: account('alice'),
  bob: account('bob', { balance: '1.000 HIVE', hbd_balance: '0.000 HBD', post_count: 7 })
}

describe('account watchlist summary', () => {
  it('keeps the requested order and links each row', () => {
    const summary = accountWatchlistSummary({
      accounts: ['bob', 'alice'],
      records: RECORDS,
      globalProps: GLOBAL_PROPS
    })

    expect(summary.rows.map(row => row.name)).toEqual(['bob', 'alice'])
    expect(summary.rows[0].link).toBe('/@bob')
    expect(summary.rows[1].link).toBe('/@alice')
    expect(summary.rows[0].avatar).toContain('/u/bob/avatar')
    expect(summary.found).toBe(2)
    expect(summary.missing).toBe(0)
    expect(summary.hasData).toBe(true)
  })

  it('converts vesting shares to Hive Power and parses balances', () => {
    const summary = accountWatchlistSummary({
      accounts: ['alice'],
      records: RECORDS,
      globalProps: GLOBAL_PROPS
    })
    const [row] = summary.rows

    // 1e6 VESTS of a 3.5e11 micro-VESTS supply holding 1e6 HIVE.
    expect(row.hp).toBeCloseTo(2.855, 3)
    expect(row.hpLabel).toBe('2.855')
    expect(row.hive).toBe(10.5)
    expect(row.hiveLabel).toBe('10.5')
    expect(row.hbd).toBe(2.25)
    expect(row.hbdLabel).toBe('2.25')
    expect(row.postCount).toBe(42)
    expect(row.created).toBe('2020-01-02T03:04:05')
  })

  it('formats raw reputation into the displayed score', () => {
    const summary = accountWatchlistSummary({
      accounts: ['alice', 'bob'],
      records: {
        alice: account('alice', { reputation: rawReputation(72) }),
        bob: account('bob', { reputation: rawReputation(25) })
      },
      globalProps: GLOBAL_PROPS
    })

    expect(summary.rows.map(row => row.reputation)).toEqual(['72', '25'])
  })

  it('counts requested accounts that have no record', () => {
    const summary = accountWatchlistSummary({
      accounts: ['alice', 'ghost'],
      records: RECORDS,
      globalProps: GLOBAL_PROPS
    })

    expect(summary.rows).toHaveLength(1)
    expect(summary.found).toBe(1)
    expect(summary.missing).toBe(1)
    expect(summary.hasData).toBe(true)
  })

  it('returns an empty summary for an empty watchlist', () => {
    const summary = accountWatchlistSummary()

    expect(summary.rows).toEqual([])
    expect(summary.found).toBe(0)
    expect(summary.missing).toBe(0)
    expect(summary.hasData).toBe(false)
  })

  it('normalises @names, duplicates and record arrays', () => {
    const summary = accountWatchlistSummary({
      accounts: ['@Alice', 'alice', 'bob', ''],
      records: [account('alice'), account('bob')],
      globalProps: GLOBAL_PROPS
    })

    expect(summary.rows.map(row => row.name)).toEqual(['alice', 'bob'])
    expect(summary.found).toBe(2)
  })

  it('handles malformed fields and missing global properties', () => {
    const summary = accountWatchlistSummary({
      accounts: ['broken'],
      records: {
        broken: {
          name: 'broken',
          reputation: 'not-a-number',
          vesting_shares: null,
          balance: 'a lot',
          hbd_balance: undefined,
          post_count: 'nope',
          created: null
        }
      },
      globalProps: null
    })
    const [row] = summary.rows

    expect(row.reputation).toBe('25')
    expect(row.hp).toBe(0)
    expect(row.hive).toBe(0)
    expect(row.hbd).toBe(0)
    expect(row.postCount).toBe(0)
    expect(row.created).toBe('')
  })
})
