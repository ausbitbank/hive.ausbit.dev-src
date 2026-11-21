import { describe, expect, it } from 'vitest'
import {
  buildPortfolio,
  filterWalletTransactions,
  formatUsd,
  groupWalletTransactions,
  hasPendingRewards,
  hivePowerApr,
  tidyAmount,
  tidyNumber,
  vestToHive,
  walletOperationView,
  walletTransactionCategory,
  walletTransactionDirection
} from '../../src/services/wallet'

const globalProps = {
  head_block_number: 100000000,
  vesting_reward_percent: 1500,
  virtual_supply: '500000000.000 HIVE',
  total_vesting_fund_hive: '200000000.000 HIVE',
  total_vesting_shares: '400000000000.000000 VESTS',
  hbd_interest_rate: 2000
}

const account = {
  name: 'alice',
  balance: '100.000 HIVE',
  vesting_shares: '4000000.000000 VESTS',
  received_vesting_shares: '1000000.000000 VESTS',
  delegated_vesting_shares: '500000.000000 VESTS',
  vesting_withdraw_rate: '100000.000000 VESTS',
  hbd_balance: '25.500 HBD',
  savings_balance: '10.000 HIVE',
  savings_hbd_balance: '5.000 HBD',
  reward_hive_balance: '1.000 HIVE',
  reward_hbd_balance: '2.000 HBD',
  reward_vesting_balance: '1000000.000000 VESTS'
}

function entry (type, data, timestamp = '2026-11-17T10:00:00') {
  return [1, { op: [type, data], timestamp, trx_id: 'abc123', block: 99 }]
}

describe('wallet helpers', () => {
  it('formats amounts, numbers and USD safely', () => {
    expect(tidyAmount('1234567.890 HIVE')).toBe('1,234,567.890 HIVE')
    expect(tidyAmount('0.001 HBD')).toBe('0.001 HBD')
    expect(tidyAmount(null)).toBe('—')
    expect(tidyNumber(1234.5678)).toBe('1,234.568')
    expect(tidyNumber('nope')).toBe('—')
    expect(formatUsd(1234.5)).toBe('$1,234.50')
    expect(formatUsd(0.001234, 4)).toBe('$0.0012')
    expect(formatUsd(null)).toBe('—')
  })

  it('converts VESTS and calculates HP APR', () => {
    expect(vestToHive(4000000, globalProps)).toBe(2000)
    expect(vestToHive(4000000, { empty: true })).toBe(0)
    expect(vestToHive(4000000, null)).toBe(0)
    expect(hivePowerApr(null)).toBeNull()
    expect(hivePowerApr({ empty: true })).toBeNull()
    expect(hivePowerApr(globalProps)).toBeCloseTo(2.17, 2)
  })

  it('builds a portfolio without duplicating pending rewards', () => {
    const portfolio = buildPortfolio({
      account,
      globalProps,
      hivePriceUsd: 0.5,
      hbdPriceUsd: 1,
      hiveChange: 10,
      hbdChange: -2
    })
    expect(portfolio.liquidHive).toBe(100)
    expect(portfolio.stakedHive).toBe(2000)
    expect(portfolio.receivedHp).toBe(500)
    expect(portfolio.delegatedHp).toBe(250)
    expect(portfolio.powerdownHp).toBe(50)
    expect(portfolio.effectiveHp).toBe(2200)
    expect(portfolio.liquidHbd).toBe(25.5)
    expect(portfolio.savingsHive).toBe(10)
    expect(portfolio.savingsHbd).toBe(5)
    expect(portfolio.pendingHp).toBe(500)
    expect(portfolio.liquidHiveUsd).toBe(50)
    expect(portfolio.stakedHiveUsd).toBe(1000)
    expect(portfolio.liquidHbdUsd).toBe(25.5)
    expect(portfolio.savingsHiveUsd).toBe(5)
    expect(portfolio.savingsHbdUsd).toBe(5)
    expect(portfolio.pendingUsd).toBe(252.5)
    expect(portfolio.holdingsUsd).toBe(1085.5)
    expect(portfolio.totalUsd).toBe(portfolio.holdingsUsd)
    expect(portfolio.pricesReady).toBe(true)
    expect(portfolio.hbdApr).toBe(20)
    expect(portfolio.changePercent).toBeCloseTo(9.66, 1)
    expect(hasPendingRewards(account)).toBe(true)
    expect(hasPendingRewards({ ...account, reward_hive_balance: '0.000 HIVE', reward_hbd_balance: '0.000 HBD', reward_vesting_balance: '0.000000 VESTS' })).toBe(false)
  })

  it('classifies wallet operations and directions', () => {
    expect(walletTransactionCategory(entry('transfer', { from: 'bob', to: 'alice' }))).toBe('transfers')
    expect(walletTransactionCategory(entry('transfer_to_vesting', {}))).toBe('staking')
    expect(walletTransactionCategory(entry('fill_vesting_withdraw', {}))).toBe('unstaking')
    expect(walletTransactionCategory(entry('transfer_to_savings', {}))).toBe('savings')
    expect(walletTransactionCategory(entry('fill_order', {}))).toBe('market')
    expect(walletTransactionCategory(entry('convert', {}))).toBe('conversions')
    expect(walletTransactionCategory(entry('claim_reward_balance', {}))).toBe('rewards')
    expect(walletTransactionCategory(entry('interest', {}))).toBe('interest')
    expect(walletTransactionCategory(entry('custom_json', {}))).toBe('other')

    expect(walletTransactionDirection(entry('transfer', { from: 'bob', to: 'alice' }), 'alice')).toBe('in')
    expect(walletTransactionDirection(entry('transfer', { from: 'alice', to: 'bob' }), 'alice')).toBe('out')
    expect(walletTransactionDirection(entry('transfer_to_vesting', { from: 'alice', to: 'alice' }), 'alice')).toBe('in')
    expect(walletTransactionDirection(entry('withdraw_vesting', {}), 'alice')).toBe('out')
    expect(walletTransactionDirection(entry('fill_vesting_withdraw', {}), 'alice')).toBe('in')
    expect(walletTransactionDirection(entry('convert', {}), 'alice')).toBe('neutral')
  })

  it('labels keepsats custom_json as Lightning activity', () => {
    const convert = entry('custom_json', {
      id: 'v4vapp_transfer',
      json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', sats: '1234', memo: '#HBD' })
    })
    const notice = entry('custom_json', {
      id: 'v4vapp_notification',
      json: JSON.stringify({ from_account: 'v4vapp', to_account: 'alice', memo: 'Insufficient Keepsats balance | § XYZ', msats: '0', parent_id: 'XYZ', notification: true })
    })

    expect(walletTransactionCategory(convert)).toBe('lightning')
    expect(walletTransactionCategory(notice)).toBe('lightning')
    expect(walletTransactionDirection(convert, 'alice')).toBe('out')
    expect(walletTransactionDirection(notice, 'alice')).toBe('in')

    const convertView = walletOperationView(convert, { username: 'alice' })
    expect(convertView).toMatchObject({ label: 'Convert keepsats to HBD', icon: 'bolt', tone: 'out', counterparty: 'v4vapp' })
    expect(convertView.parts[0]).toMatchObject({ text: '1,234 sats', sign: '-' })

    const noticeView = walletOperationView(notice, { username: 'alice' })
    expect(noticeView).toMatchObject({ label: 'v4vapp notification · XYZ', tone: 'in', counterparty: 'v4vapp' })
    expect(noticeView.memo).toContain('Insufficient Keepsats balance')
  })

  it('labels v4vapp transfers as Lightning activity', () => {
    const received = entry('transfer', {
      from: 'v4vapp',
      to: 'alice',
      amount: '0.421 HIVE',
      memo: 'Converted 77 sats to 0.421 HIVE with fee: 52 sats for alice | ⚡ zapped by @bob | § abc123 | Thank you for using v4v.app'
    })
    const sent = entry('transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '1.000 HBD',
      memo: 'lnbc1000u1pabc #v4vapp'
    })
    const deposit = entry('transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '5.000 HBD',
      memo: 'alice Deposit to #SATS'
    })

    expect(walletTransactionCategory(received)).toBe('lightning')
    expect(walletTransactionCategory(sent)).toBe('lightning')
    expect(walletTransactionCategory(deposit)).toBe('lightning')

    const receivedView = walletOperationView(received, { username: 'alice' })
    expect(receivedView).toMatchObject({ label: 'Lightning received', icon: 'bolt', tone: 'in', counterparty: 'v4vapp' })
    expect(receivedView.memo).toContain('Converted 77 sats')

    const sentView = walletOperationView(sent, { username: 'alice' })
    expect(sentView).toMatchObject({ label: 'Lightning payment', icon: 'bolt', tone: 'out' })
    expect(sentView.memo).toBe('Lightning invoice payment')

    const depositView = walletOperationView(deposit, { username: 'alice' })
    expect(depositView.label).toBe('Keepsats deposit')

    expect(filterWalletTransactions([received, sent, deposit], { username: 'alice', category: 'lightning' })).toHaveLength(3)
  })

  it('filters by category, direction and search', () => {
    const entries = [
      entry('transfer', { from: 'bob', to: 'alice', memo: 'rent' }, '2026-11-17T10:00:00'),
      entry('transfer', { from: 'alice', to: 'carol', memo: 'lunch' }, '2026-11-17T09:00:00'),
      entry('interest', { owner: 'alice', interest: '0.100 HBD' }, '2026-11-16T08:00:00')
    ]
    expect(filterWalletTransactions(entries, { username: 'alice' })).toHaveLength(3)
    expect(filterWalletTransactions(entries, { username: 'alice', category: 'transfers' })).toHaveLength(2)
    expect(filterWalletTransactions(entries, { username: 'alice', category: 'interest' })).toHaveLength(1)
    expect(filterWalletTransactions(entries, { username: 'alice', direction: 'in' })).toHaveLength(2)
    expect(filterWalletTransactions(entries, { username: 'alice', direction: 'out' })).toHaveLength(1)
    expect(filterWalletTransactions(entries, { username: 'alice', search: 'lunch' })).toHaveLength(1)
    expect(filterWalletTransactions(entries, { username: 'alice', search: 'missing' })).toHaveLength(0)
  })

  it('groups newest transactions by UTC date', () => {
    const entries = [
      entry('transfer', {}, '2026-11-17T10:00:00'),
      entry('interest', {}, '2026-11-17T08:00:00'),
      entry('transfer', {}, '2026-11-16T22:00:00')
    ]
    const groups = groupWalletTransactions(entries)
    expect(groups.map(group => group.date)).toEqual(['2026-11-17', '2026-11-16'])
    expect(groups[0].entries).toHaveLength(2)
    expect(groupWalletTransactions([])).toEqual([])
  })

  it('describes transfers, savings, conversions and rewards', () => {
    const toHive = value => vestToHive(parseFloat(value) || 0, globalProps)
    const received = walletOperationView(entry('transfer', { from: 'bob', to: 'alice', amount: '5.000 HIVE', memo: '#encrypted' }), { username: 'alice', toHive })
    expect(received.label).toBe('Received')
    expect(received.counterparty).toBe('bob')
    expect(received.tone).toBe('in')
    expect(received.parts).toEqual([{ text: '5.000 HIVE', sign: '+' }])
    expect(received.memo).toBe('#encrypted')

    const sent = walletOperationView(entry('transfer', { from: 'alice', to: 'bob', amount: '5.000 HBD', memo: '' }), { username: 'alice', toHive })
    expect(sent.label).toBe('Sent')
    expect(sent.tone).toBe('out')

    const powerdown = walletOperationView(entry('withdraw_vesting', { vesting_shares: '4000000.000000 VESTS' }), { username: 'alice', toHive })
    expect(powerdown.label).toBe('Power down started')
    expect(powerdown.parts[0].text).toBe('2,000.000 HIVE')

    const cancelled = walletOperationView(entry('withdraw_vesting', { vesting_shares: '0.000000 VESTS' }), { username: 'alice', toHive })
    expect(cancelled.label).toBe('Cancelled power down')
    expect(cancelled.parts).toEqual([])

    const conversion = walletOperationView(entry('fill_convert_request', { owner: 'alice', amount_in: '10.000 HBD', amount_out: '20.000 HIVE' }), { username: 'alice', toHive })
    expect(conversion.parts).toEqual([
      { text: '10.000 HBD', sign: '-' },
      { text: '20.000 HIVE', sign: '+' }
    ])

    const rewards = walletOperationView(entry('claim_reward_balance', {
      account: 'alice',
      reward_hive: '1.000 HIVE',
      reward_hbd: '2.000 HBD',
      reward_vests: '4000000.000000 VESTS'
    }), { username: 'alice', toHive })
    expect(rewards.label).toBe('Claimed rewards')
    expect(rewards.parts).toEqual([
      { text: '1.000 HIVE', sign: '+' },
      { text: '2.000 HBD', sign: '+' },
      { text: '2,000.000 HP', sign: '+' }
    ])
  })
})
