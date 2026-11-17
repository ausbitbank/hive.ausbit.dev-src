import { describe, expect, it } from 'vitest'
import {
  blockOperationCount,
  blockOperationMix,
  blockSizeKb,
  blockTransactionCount,
  changeClass,
  formatCompactNumber,
  formatPercent,
  formatUsd,
  sortMarketCoins,
  witnessVotesHp
} from '../../src/services/home'

describe('home dashboard helpers', () => {
  it('formats compact numbers', () => {
    expect(formatCompactNumber(103627812)).toBe('103.6M')
    expect(formatCompactNumber(1234)).toBe('1.2K')
    expect(formatCompactNumber(999)).toBe('999')
    expect(formatCompactNumber(null)).toBe('—')
  })

  it('formats USD values and percentage changes', () => {
    expect(formatUsd(90123.4)).toBe('$90,123')
    expect(formatUsd(1.111)).toBe('$1.11')
    expect(formatUsd(0.3123)).toBe('$0.3123')
    expect(formatUsd(0.000123)).toBe('$0.000123')
    expect(formatUsd(null)).toBe('—')
    expect(formatPercent(2.414)).toBe('+2.41%')
    expect(formatPercent(-2.637)).toBe('-2.64%')
    expect(formatPercent(0)).toBe('0.00%')
    expect(changeClass(1)).toBe('is-up')
    expect(changeClass(-1)).toBe('is-down')
    expect(changeClass(0)).toBe('is-flat')
  })

  it('summarises operation types from tuples and objects', () => {
    const mix = blockOperationMix([
      ['vote', {}],
      ['vote', {}],
      ['custom_json', {}],
      { op: ['transfer', {}] },
      { op: ['custom_json', {}] }
    ], 3)
    expect(mix).toEqual([
      { type: 'custom_json', label: 'custom JSON', count: 2 },
      { type: 'vote', label: 'vote', count: 2 },
      { type: 'transfer', label: 'transfer', count: 1 }
    ])
    expect(blockOperationMix(null)).toEqual([])
  })

  it('converts witness votes to HP', () => {
    const globalProps = {
      total_vesting_fund_hive: '218580944.076 HIVE',
      total_vesting_shares: '350290817133.487929 VESTS'
    }
    expect(Math.round(witnessVotesHp('166070612152019450', globalProps))).toBe(103627813)
    expect(witnessVotesHp(0, globalProps)).toBe(0)
    expect(witnessVotesHp('1', null)).toBe(0)
  })

  it('sorts Hive assets first', () => {
    const coins = [{ id: 'bitcoin' }, { id: 'hive_dollar' }, { id: 'ethereum' }, { id: 'hive' }]
    expect(sortMarketCoins(coins).map(coin => coin.id)).toEqual(['hive', 'hive_dollar', 'bitcoin', 'ethereum'])
  })

  it('counts block transactions and operations', () => {
    const block = {
      transactions: [
        { operations: [['vote', {}], ['comment', {}]] },
        { operations: [['transfer', {}]] }
      ]
    }
    expect(blockTransactionCount(block)).toBe(2)
    expect(blockOperationCount(block, [{}, {}])).toBe(5)
    expect(blockTransactionCount(null)).toBe(0)
    expect(blockOperationCount(null, null)).toBe(0)
    expect(blockSizeKb(block)).toBeGreaterThan(0)
  })
})
