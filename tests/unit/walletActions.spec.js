import { describe, expect, it } from 'vitest'
import { walletActionsSummary } from '../../src/services/walletActions'

const NOW = Date.parse('2024-06-01T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

const GLOBAL_PROPS = {
  total_vesting_fund_hive: '1000000.000 HIVE',
  total_vesting_shares: '350290817133.487929 VESTS'
}

const PRICES = {
  hive: { usd: 0.5 },
  hive_dollar: { usd: 1 }
}

function iso (offsetMs = 0) {
  return new Date(NOW + offsetMs).toISOString()
}

function baseAccount (overrides = {}) {
  return {
    name: 'alice',
    balance: '0.000 HIVE',
    hbd_balance: '0.000 HBD',
    savings_balance: '0.000 HIVE',
    savings_hbd_balance: '0.000 HBD',
    vesting_shares: '1000000000.000000 VESTS',
    received_vesting_shares: '0.000000 VESTS',
    delegated_vesting_shares: '0.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    to_withdraw: '0',
    withdrawn: '0',
    reward_hive_balance: '0.000 HIVE',
    reward_hbd_balance: '0.000 HBD',
    reward_vesting_balance: '0.000000 VESTS',
    ...overrides
  }
}

describe('wallet actions summary', () => {
  it('describes an active power down with progress and countdown', () => {
    const account = baseAccount({
      vesting_withdraw_rate: '10000000.000000 VESTS',
      to_withdraw: '40000000000000',
      withdrawn: '10000000000000',
      next_vesting_withdrawal: iso(3 * DAY_MS)
    })

    const summary = walletActionsSummary({
      account,
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      now: NOW
    })

    expect(summary.accountName).toBe('alice')
    expect(summary.hasAnything).toBe(true)
    expect(summary.powerdown.active).toBe(true)
    expect(summary.powerdown.progress).toBeCloseTo(0.25, 6)
    expect(summary.powerdown.cyclesLeft).toBe(3)
    expect(summary.powerdown.countdown).toBe('in 3 days')
    expect(summary.powerdown.nextHp).toBeCloseTo(28.548, 2)
    expect(summary.powerdown.nextLabel).toBe('28.548 HP')
    expect(summary.powerdown.toWithdraw).toBeCloseTo(114.191, 2)
    expect(summary.powerdown.withdrawn).toBeCloseTo(28.548, 2)
  })

  it('reports an all-clear account', () => {
    const summary = walletActionsSummary({
      account: baseAccount(),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      now: NOW
    })

    expect(summary.hasAnything).toBe(false)
    expect(summary.powerdown.active).toBe(false)
    expect(summary.savingsWithdrawals).toEqual([])
    expect(summary.conversions).toEqual([])
    expect(summary.orders).toEqual([])
    expect(summary.rewards.has).toBe(false)
    expect(summary.interest.amount).toBe(0)
  })

  it('lists claimable rewards with a USD value', () => {
    const summary = walletActionsSummary({
      account: baseAccount({
        reward_hive_balance: '1.000 HIVE',
        reward_hbd_balance: '2.000 HBD'
      }),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      now: NOW
    })

    expect(summary.hasAnything).toBe(true)
    expect(summary.rewards.has).toBe(true)
    expect(summary.rewards.parts).toEqual(['1.000 HIVE', '2.000 HBD'])
    expect(summary.rewards.usd).toBe('$2.50')
  })

  it('describes a savings withdrawal', () => {
    const summary = walletActionsSummary({
      account: baseAccount(),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      savingsWithdrawals: [{
        request_id: 7,
        amount: '10.000 HBD',
        to: 'alice',
        complete: iso(3 * DAY_MS)
      }],
      now: NOW
    })

    expect(summary.hasAnything).toBe(true)
    expect(summary.savingsWithdrawals).toHaveLength(1)
    expect(summary.savingsWithdrawals[0]).toMatchObject({
      id: '7',
      amount: '10.000 HBD',
      to: 'alice',
      countdown: 'in 3 days'
    })
  })

  it('describes normal and collateralized conversions', () => {
    const summary = walletActionsSummary({
      account: baseAccount(),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      conversions: [{
        id: 5,
        amount: '2.000 HBD',
        conversion_date: iso(3 * DAY_MS)
      }],
      collateralizedConversions: [{
        id: 6,
        collateral_amount: '5.000 HIVE',
        converted_amount: '2.500 HBD',
        conversion_date: iso(3 * DAY_MS)
      }],
      now: NOW
    })

    expect(summary.hasAnything).toBe(true)
    expect(summary.conversions).toHaveLength(2)
    expect(summary.conversions[0]).toMatchObject({
      id: '5',
      amount: '2.000 HBD',
      direction: 'to HIVE',
      countdown: 'in 3 days'
    })
    expect(summary.conversions[1]).toMatchObject({
      id: '6',
      amount: '5.000 HIVE',
      direction: 'collateral to HBD',
      countdown: 'in 3 days'
    })
  })

  it('normalises an open market order', () => {
    const summary = walletActionsSummary({
      account: baseAccount(),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      openOrders: [{
        orderid: 42,
        sell_price: { base: '1.000 HIVE', quote: '0.500 HBD' }
      }],
      now: NOW
    })

    expect(summary.hasAnything).toBe(true)
    expect(summary.orders).toEqual([{
      id: '42',
      sell: '1.000 HIVE',
      receive: '0.500 HBD',
      price: 0.5
    }])
  })

  it('reports pending HBD interest and its next payout', () => {
    const summary = walletActionsSummary({
      account: baseAccount({
        savings_hbd_seconds: '1000',
        savings_hbd_balance: '100.000 HBD',
        savings_hbd_last_interest_payment: iso(-10 * DAY_MS)
      }),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      pendingInterest: 1.234,
      now: NOW
    })

    expect(summary.hasAnything).toBe(true)
    expect(summary.interest.amount).toBe(1.234)
    expect(summary.interest.claimable).toBe(false)
    expect(summary.interest.nextLabel).toMatch(/in 20 days/)
  })

  it('marks HBD interest as claimable after 30 days', () => {
    const summary = walletActionsSummary({
      account: baseAccount({
        savings_hbd_seconds: '1000',
        savings_hbd_balance: '100.000 HBD',
        savings_hbd_last_interest_payment: iso(-31 * DAY_MS)
      }),
      globalProps: GLOBAL_PROPS,
      prices: PRICES,
      pendingInterest: 0.5,
      now: NOW
    })

    expect(summary.interest.amount).toBe(0.5)
    expect(summary.interest.claimable).toBe(true)
    expect(summary.interest.nextLabel).toBe('Ready to claim')
  })

  it('returns an all-clear summary without an account', () => {
    const summary = walletActionsSummary({ now: NOW })

    expect(summary.accountName).toBe('')
    expect(summary.hasAnything).toBe(false)
    expect(summary.powerdown.active).toBe(false)
    expect(summary.rewards.usd).toBe('$0.00')
  })
})
