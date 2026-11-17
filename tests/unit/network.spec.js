import { describe, expect, it } from 'vitest'
import {
  chainVersions,
  debtStatus,
  formatLatency,
  hbdDebtRatio,
  headLag,
  medianPrice,
  nodeStatus,
  overallStatus,
  overallStatusLabel,
  participationRate,
  participationStatus,
  pickFastestHealthy,
  resourcePool,
  summarizeNodes,
  versionStatus,
  withHeadLag
} from '../../src/services/network'

describe('median price', () => {
  it('reads the HBD-per-HIVE quote as a HIVE USD price', () => {
    expect(medianPrice({ base: '0.400 HBD', quote: '1.000 HIVE' })).toMatchObject({
      base: 0.4,
      quote: 1,
      hiveUsd: 0.4,
      label: '$0.4000'
    })
  })

  it('accepts a feed history wrapper and an empty price', () => {
    expect(medianPrice({ current_median_history: { base: '0.250 HBD', quote: '1.000 HIVE' } }).hiveUsd).toBe(0.25)
    expect(medianPrice(null)).toEqual({ base: 0, quote: 0, hiveUsd: 0, label: '—' })
  })
})

describe('HBD debt ratio', () => {
  it('excludes treasury HBD and values HIVE in HBD', () => {
    const debt = hbdDebtRatio({
      hbdSupply: '30000000.000 HBD',
      hiveSupply: '100000000.000 HIVE',
      hiveUsd: 1,
      treasuryHbd: '10000000.000 HBD'
    })

    expect(debt.hbd).toBe(20000000)
    expect(debt.hiveAsHbd).toBe(100000000)
    expect(debt.ratio).toBeCloseTo(16.6666, 3)
    expect(debt.status.key).toBe('watch')
  })

  it('classifies the 20% and 30% thresholds', () => {
    expect(debtStatus(5).key).toBe('ok')
    expect(debtStatus(15).key).toBe('watch')
    expect(debtStatus(20).key).toBe('warning')
    expect(debtStatus(30).key).toBe('critical')
  })

  it('returns a null ratio when no price is available', () => {
    const debt = hbdDebtRatio({ hbdSupply: 10, hiveSupply: 10, hiveUsd: 0 })
    expect(debt.ratio).toBe(null)
    expect(debt.status.key).toBe('unknown')
  })
})

describe('witness participation', () => {
  it('calculates and classifies the 128-block window', () => {
    expect(participationRate(128)).toBe(100)
    expect(participationRate(96)).toBe(75)
    expect(participationRate(0)).toBe(0)
    expect(participationStatus(99).key).toBe('ok')
    expect(participationStatus(85).key).toBe('warning')
    expect(participationStatus(50).key).toBe('critical')
  })
})

describe('resource pool and versions', () => {
  it('derives HP per million VESTS and subsidy pool details', () => {
    const pool = resourcePool({
      total_vesting_fund_hive: '200000000.000 HIVE',
      total_vesting_shares: '400000000000.000000 VESTS'
    }, {
      account_subsidy_rd: { pool_eq: 1000, max_pool_size: 2000, resource_unit: 10000 }
    })

    expect(pool.vestingFundHive).toBe(200000000)
    expect(pool.vestingShares).toBe(400000000000)
    expect(pool.hpPerMvest).toBeCloseTo(500)
    expect(pool.subsidyPool).toEqual({ pool: 1000, max: 2000, unit: 10000 })
  })

  it('normalises config basis points and required witnesses', () => {
    expect(chainVersions({
      HIVE_BLOCKCHAIN_VERSION: '1.28.8',
      HIVE_BLOCKCHAIN_HARDFORK_VERSION: '1.28.0',
      HIVE_HARDFORK_REQUIRED_WITNESSES: 17,
      HIVE_BLOCK_INTERVAL: 3,
      HIVE_HBD_HARD_LIMIT: 3000,
      HIVE_HBD_START_PERCENT_HF26: 2000
    }, '1.28.9')).toEqual({
      blockchainVersion: '1.28.8',
      hardforkVersion: '1.28.0',
      consensusVersion: '1.28.9',
      requiredWitnesses: 17,
      blockInterval: 3,
      hbdHardLimit: 30,
      hbdStartPercent: 20
    })
  })

  it('compares node versions by major/minor only', () => {
    expect(versionStatus('1.28.8', '1.28.9')).toBe('match')
    expect(versionStatus('1.27.5', '1.28.9')).toBe('mismatch')
    expect(versionStatus('', '1.28.9')).toBe('unknown')
  })
})

describe('API node health', () => {
  const nodes = [
    { url: 'https://fast', ok: true, latency: 80, head: 1000, version: '1.28.8' },
    { url: 'https://slow', ok: true, latency: 400, head: 990, version: '1.28.8' },
    { url: 'https://behind', ok: true, latency: 50, head: 950, version: '1.27.0' },
    { url: 'https://down', ok: false, latency: Infinity, error: 'Timeout' }
  ]

  it('adds head lag relative to the highest healthy head', () => {
    expect(headLag(990, 1000)).toBe(10)
    const rows = withHeadLag(nodes)
    expect(rows.map(node => node.lag)).toEqual([0, 10, 50, null])
  })

  it('summarises healthy nodes, fastest latency and versions', () => {
    const rows = withHeadLag(nodes)
    const summary = summarizeNodes(rows)

    expect(summary.healthyCount).toBe(3)
    expect(summary.unreachableCount).toBe(1)
    expect(summary.fastest.url).toBe('https://behind')
    expect(summary.averageLatency).toBeCloseTo((80 + 400 + 50) / 3)
    expect(summary.maxLag).toBe(50)
    expect(summary.versions).toEqual([
      { version: '1.28.8', count: 2 },
      { version: '1.27.0', count: 1 }
    ])
  })

  it('picks the fastest healthy node inside the head-lag limit', () => {
    const rows = withHeadLag(nodes)
    expect(pickFastestHealthy(rows).url).toBe('https://fast')
    expect(pickFastestHealthy(rows, { maxLag: 100 }).url).toBe('https://behind')
    expect(pickFastestHealthy([{ url: 'https://down', ok: false }])).toBe(null)
  })

  it('classifies node status and formats latency', () => {
    expect(nodeStatus(nodes[0]).key).toBe('ok')
    expect(nodeStatus({ ok: true, lag: 9 }).key).toBe('behind')
    expect(nodeStatus(nodes[3]).key).toBe('offline')
    expect(formatLatency(83.4)).toBe('83 ms')
    expect(formatLatency(null)).toBe('—')
  })

  it('rolls individual checks into an overall status', () => {
    expect(overallStatus(['ok', 'watch'])).toBe('watch')
    expect(overallStatus(['ok', 'warning', 'watch'])).toBe('warning')
    expect(overallStatus(['ok', 'warning', 'critical'])).toBe('critical')
    expect(overallStatus(['ok', null])).toBe('healthy')
    expect(overallStatusLabel('critical')).toBe('Needs attention')
  })
})
