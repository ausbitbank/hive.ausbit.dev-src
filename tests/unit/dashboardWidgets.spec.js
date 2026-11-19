import { describe, expect, it } from 'vitest'
import {
  myWitnessPosition,
  networkStats,
  notificationRows,
  voteHealthSummary,
  walletWidgetSummary
} from '../../src/services/dashboardWidgets'

const GLOBAL_PROPS = {
  total_vesting_fund_hive: '1000000.000 HIVE',
  total_vesting_shares: '350290817133.487929 VESTS',
  head_block_number: 90000000,
  last_irreversible_block_num: 89999980,
  participation_count: 122,
  current_supply: '500000000.000 HIVE',
  current_hbd_supply: '10000000.000 HBD',
  hbd_interest_rate: 1500
}

function witness (owner, votes, extra = {}) {
  return {
    owner,
    votes: String(votes),
    running_version: '1.28.9',
    total_missed: 0,
    last_hbd_exchange_update: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    last_confirmed_block_num: 89999999,
    signing_key: 'STMvalid',
    ...extra
  }
}

describe('wallet widget summary', () => {
  const account = {
    name: 'alice',
    balance: '10.000 HIVE',
    hbd_balance: '5.000 HBD',
    vesting_shares: '1000000.000000 VESTS',
    savings_balance: '0.000 HIVE',
    savings_hbd_balance: '0.000 HBD',
    reward_hive_balance: '1.000 HIVE',
    reward_hbd_balance: '0.000 HBD',
    reward_vesting_balance: '0.000000 VESTS'
  }

  it('values liquid HIVE, HBD and staked HP in USD', () => {
    const summary = walletWidgetSummary(account, GLOBAL_PROPS, { usd: 0.5, change: 4 }, { usd: 1, change: 0 })
    // 1e6 VESTS of a 3.5e11 micro-VESTS supply holding 1e6 HIVE = 2.85 HP,
    // i.e. about $1.43, plus 10 HIVE ($5) and 5 HBD ($5).
    const hp = summary.portfolio.stakedHive
    expect(hp).toBeCloseTo(2.855, 3)
    expect(summary.portfolio.totalUsd).toBeCloseTo(10 + hp * 0.5, 3)
    expect(summary.rows.find(row => row.id === 'hp').amount).toBe(hp.toFixed(3) + ' HP')
    expect(summary.changeDirection).toBe('up')
    // Weighted by USD value: HIVE (incl. staked) at +4%, HBD at 0%.
    expect(summary.changeLabel).toMatch(/^\+\d+\.\d\d%$/)
  })

  it('reports claimable rewards', () => {
    const summary = walletWidgetSummary(account, GLOBAL_PROPS, { usd: 0.5, change: 0 }, { usd: 1 })
    expect(summary.rewards.has).toBe(true)
    expect(summary.rewards.parts).toEqual(['1.000 HIVE'])
  })

  it('falls back safely with no prices', () => {
    const summary = walletWidgetSummary(account, GLOBAL_PROPS, null, null)
    expect(summary.portfolio.pricesReady).toBe(false)
    expect(summary.changeLabel).toBe('')
    expect(summary.rows).toHaveLength(4)
  })
})

describe('my witness position', () => {
  const ranked = Array.from({ length: 25 }, (_, index) => witness('w' + index, (25 - index) * 1000))

  it('reports the rank and a top-20 place', () => {
    const position = myWitnessPosition(ranked, 'w3', GLOBAL_PROPS)
    expect(position.found).toBe(true)
    expect(position.rank).toBe(4)
    expect(position.inTopTwenty).toBe(true)
    expect(position.gapLabel).toBe('In the top 20')
  })

  it('reports the gap to the cut-off for a witness outside the top 20', () => {
    const position = myWitnessPosition(ranked, '@w22', GLOBAL_PROPS)
    expect(position.rank).toBe(23)
    expect(position.inTopTwenty).toBe(false)
    expect(position.gapHp).toBeGreaterThan(0)
    expect(position.gapLabel).toMatch(/Gap to #20/)
  })

  it('reports an account that does not run a witness', () => {
    const position = myWitnessPosition(ranked, 'nobody', GLOBAL_PROPS)
    expect(position.found).toBe(false)
  })
})

describe('vote health summary', () => {
  const ranked = [
    witness('good', 5000),
    witness('stale', 4000, { last_hbd_exchange_update: '2020-01-01T00:00:00' }),
    witness('disabled', 3000, { signing_key: 'STM1111111111111111111111111111111114T1Anm' }),
    witness('other', 2000)
  ]

  it('summarises the health of the voted witnesses', () => {
    const account = { witness_votes: ['good', 'stale', 'disabled', 'ghost'], vesting_shares: '1000000.000000 VESTS' }
    const summary = voteHealthSummary(ranked, account, GLOBAL_PROPS)
    expect(summary.total).toBe(3)
    expect(summary.ok).toBe(1)
    expect(summary.critical).toBe(1)
    expect(summary.warning).toBe(1)
    expect(summary.missing).toBe(1)
    expect(summary.votesUsed).toBe(4)
    expect(summary.votesLeft).toBe(26)
  })

  it('reports a healthy slate when every voted witness is fine', () => {
    const summary = voteHealthSummary(ranked, { witness_votes: ['good'] }, GLOBAL_PROPS)
    expect(summary.ok).toBe(1)
    expect(summary.notHealthy).toBe(0)
  })
})

describe('network stats', () => {
  it('derives participation, supply and the debt ratio', () => {
    const stats = networkStats(GLOBAL_PROPS, { medianHiveUsd: 0.5 })
    expect(stats.headBlock).toBe(90000000)
    expect(stats.participationLabel).toBe('95.3%')
    expect(stats.stakedHive).toBeCloseTo(1000000, 3)
    expect(stats.debtRatio).toBeCloseTo((10000000 / (10000000 + 250000000)) * 100, 6)
    expect(stats.hbdSavingsApr).toBe(15)
  })

  it('handles incomplete properties', () => {
    const stats = networkStats(null)
    expect(stats.headBlock).toBe(0)
    expect(stats.debtRatio).toBeNull()
    expect(stats.debtLabel).toBe('—')
  })
})

describe('notification rows', () => {
  const notifications = [
    { id: '1', date: '2026-11-18 10:00:00', type: 'vote', msg: '@alice voted on your post', url: '@bob/post' },
    { id: '2', date: '2026-11-18 12:00:00', type: 'reply', msg: '<b>@carol</b> replied', url: '/@bob/post#x' },
    { id: '2', date: '2026-11-18 12:00:00', type: 'reply', msg: 'duplicate', url: '' }
  ]

  it('dedupes, sorts newest first and caps the list', () => {
    const rows = notificationRows(notifications, { limit: 5 })
    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe('2')
    expect(rows[0].category).toBe('replies')
    expect(rows[0].actor).toBe('carol')
    // The actor's @ is kept: stripping tags otherwise leaves a stray space.
    expect(rows[0].message).toBe('@carol replied')
    expect(rows[0].to).toBe('/@bob/post#x')
    expect(rows[1].category).toBe('votes')
    expect(rows[1].to).toBe('/@bob/post')
  })

  it('respects the limit', () => {
    expect(notificationRows(notifications, { limit: 1 })).toHaveLength(1)
  })
})
