import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = {
  account: null,
  productPost: null,
  history: { rows: [], pages: 1, scanned: 0, complete: true, truncated: false },
  vault: { enabled: true },
  product: { status: 1, author: 'alice', plan: 'member' },
  plan: { author: 'alice', product: 'alice/membership' },
  ref: { author: 'alice', permlink: 'membership' },
  rows: [],
  resolved: { bulletin: { blog: 'alice' } },
  verified: { ok: true },
  merged: { entries: [] },
  thumbprint: async key => 'rkt:' + key,
  failures: {}
}

function resetState () {
  state.account = { name: 'alice' }
  state.productPost = { author: 'alice', permlink: 'membership' }
  state.history = { rows: [], pages: 1, scanned: 0, complete: true, truncated: false }
  state.vault = { enabled: true }
  state.product = { status: 1, author: 'alice', plan: 'member' }
  state.plan = { author: 'alice', product: 'alice/membership' }
  state.ref = { author: 'alice', permlink: 'membership' }
  state.rows = []
  state.resolved = { bulletin: { blog: 'alice' } }
  state.verified = { ok: true }
  state.merged = { entries: [] }
  state.thumbprint = async key => 'rkt:' + key
  state.failures = {}
}

vi.mock('../../src/services/chainData', () => ({
  fetchAccount: vi.fn(async () => {
    if (state.failures.account) throw new Error('account failed')
    return state.account
  }),
  fetchPostContent: vi.fn(async () => state.productPost),
  fetchAccountHistoryFiltered: vi.fn(async () => {
    if (state.failures.history) throw new Error('history failed')
    return []
  })
}))

vi.mock('../../src/services/accountHistory', () => ({
  VAULT_HISTORY_FILTER: {},
  collectAccountHistory: vi.fn(async () => {
    if (state.failures.collect) throw new Error('collect failed')
    return state.history
  }),
  vaultHistorySince: vi.fn(() => 0)
}))

vi.mock('../../src/services/vaultSettings', () => ({
  readVaultSettings: vi.fn(() => ({ settings: state.vault })),
  vaultIsConfigured: vi.fn(settings => Boolean(settings && settings.enabled))
}))

vi.mock('../../src/services/vaultProduct', () => ({
  parseVaultProduct: vi.fn(() => state.product),
  deriveVaultPlan: vi.fn(() => state.plan)
}))

vi.mock('../../src/services/shopOrders', () => ({
  parseProductRef: vi.fn(() => state.ref)
}))

vi.mock('../../src/services/vaultBulletin', () => ({
  subscriberRows: vi.fn(() => state.rows)
}))

vi.mock('../../src/services/vaultUnlock', () => ({
  resolveBulletin: vi.fn(async () => state.resolved),
  verifyBulletin: vi.fn(async () => state.verified),
  loadBulletinParts: vi.fn(async () => state.merged)
}))

vi.mock('../../src/services/vaultCrypto', () => ({
  readerKeyThumbprint: vi.fn(async key => state.thumbprint(key))
}))

const NOW = Date.parse('2026-11-28T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000

async function load () {
  return import('../../src/services/vaultPending')
}

beforeEach(async () => {
  vi.clearAllMocks()
  resetState()
  const { clearPendingGrantCache } = await load()
  clearPendingGrantCache()
})

describe('getPendingGrantCount', () => {
  it('returns 0 for a missing account name and never calls the chain', async () => {
    const { getPendingGrantCount } = await load()
    const { fetchAccount } = await import('../../src/services/chainData')
    expect(await getPendingGrantCount('')).toBe(0)
    expect(await getPendingGrantCount('  @  ')).toBe(0)
    expect(fetchAccount).not.toHaveBeenCalled()
  })

  it('returns 0 when the blog has no configured Vault', async () => {
    state.vault = { enabled: false }
    const { getPendingGrantCount } = await load()
    expect(await getPendingGrantCount('@Alice', { now: NOW })).toBe(0)
  })

  it('returns 0 when the product reference or product is missing', async () => {
    const { getPendingGrantCount } = await load()
    const { parseProductRef } = await import('../../src/services/shopOrders')
    const { parseVaultProduct } = await import('../../src/services/vaultProduct')

    state.ref = null
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)

    state.ref = { author: 'alice', permlink: 'membership' }
    state.product = null
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)
    expect(parseProductRef).toHaveBeenCalled()
    expect(parseVaultProduct).toHaveBeenCalled()
  })

  it('returns 0 when the product is not active or belongs to another author', async () => {
    const { getPendingGrantCount } = await load()
    state.product = { status: 0, author: 'alice' }
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)
    state.product = { status: 1, author: 'bob' }
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)
  })

  it('returns 0 when there are no subscriber rows', async () => {
    const { getPendingGrantCount } = await load()
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)
  })

  it('returns 0 when the bulletin cannot be resolved, verified or loaded', async () => {
    const { getPendingGrantCount } = await load()
    state.rows = [{ readerKey: 'reader-a', active: true }]

    state.resolved = null
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)

    state.resolved = { bulletin: { blog: 'alice' } }
    state.verified = { ok: false }
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)

    state.verified = { ok: true }
    state.merged = null
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)
  })

  it('counts active readers with a missing or nearly expired grant', async () => {
    const { getPendingGrantCount } = await load()
    state.rows = [
      { readerKey: 'reader-missing', active: true },
      { readerKey: 'reader-soon', active: true },
      { readerKey: 'reader-valid', active: true },
      { readerKey: 'reader-expired', active: true },
      { readerKey: 'reader-inactive', active: false }
    ]
    state.merged = {
      entries: [
        { rkt: 'rkt:reader-soon', expires: new Date(NOW + 12 * 60 * 60 * 1000).toISOString() },
        { rkt: 'rkt:reader-valid', expires: new Date(NOW + 10 * DAY).toISOString() },
        { rkt: 'rkt:reader-expired', expires: new Date(NOW - DAY).toISOString() }
      ]
    }

    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(3)
  })

  it('skips readers whose key cannot be thumbprinted', async () => {
    const { getPendingGrantCount } = await load()
    state.rows = [
      { readerKey: 'bad', active: true },
      { readerKey: 'good', active: true }
    ]
    state.thumbprint = async key => {
      if (key === 'bad') throw new Error('bad key')
      return 'rkt:' + key
    }
    // The good reader has no matching entry, so they are pending. The bad key
    // is skipped rather than counted, and never breaks the whole menu.
    state.merged = { entries: [] }
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(1)
  })

  it('caches the count briefly and honours force', async () => {
    const { getPendingGrantCount, clearPendingGrantCache } = await load()
    const { fetchAccount } = await import('../../src/services/chainData')

    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)
    expect(fetchAccount).toHaveBeenCalledTimes(1)

    await getPendingGrantCount('alice', { now: NOW + 30 * 1000 })
    expect(fetchAccount).toHaveBeenCalledTimes(1)

    await getPendingGrantCount('alice', { now: NOW + 61 * 1000 })
    expect(fetchAccount).toHaveBeenCalledTimes(2)

    await getPendingGrantCount('alice', { now: NOW + 62 * 1000, force: true })
    expect(fetchAccount).toHaveBeenCalledTimes(3)

    clearPendingGrantCache('alice')
    await getPendingGrantCount('alice', { now: NOW + 63 * 1000 })
    expect(fetchAccount).toHaveBeenCalledTimes(4)
  })

  it('normalises account names for the cache', async () => {
    const { getPendingGrantCount } = await load()
    const { fetchAccount } = await import('../../src/services/chainData')

    await getPendingGrantCount('@Alice', { now: NOW })
    await getPendingGrantCount('alice', { now: NOW + 1000 })
    expect(fetchAccount).toHaveBeenCalledTimes(1)
    expect(fetchAccount).toHaveBeenCalledWith('alice', { force: true })
  })

  it('never throws when a read fails and caches nothing', async () => {
    const { getPendingGrantCount } = await load()
    const { fetchAccount } = await import('../../src/services/chainData')

    state.failures.account = true
    expect(await getPendingGrantCount('alice', { now: NOW })).toBe(0)

    state.failures.account = false
    expect(await getPendingGrantCount('alice', { now: NOW + 1000 })).toBe(0)
    expect(fetchAccount).toHaveBeenCalledTimes(2)
  })
})
