import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HOME_SNAPSHOT_MAX_AGE_MS,
  getHomeSnapshot,
  homeSnapshotAgeMs,
  resetHomeSnapshotForTests,
  snapshotBlock,
  snapshotFeed,
  snapshotMarket,
  snapshotNetwork,
  snapshotWitnesses,
  whenHomeSnapshot
} from '../../src/services/homeSnapshot'

function mountInline (value) {
  document.body.innerHTML = '<script type="application/json" id="home-snapshot">' +
    JSON.stringify(value) +
    '</script>'
}

const GENERATED_AT = Date.now()

const SNAPSHOT = {
  version: 1,
  generatedAt: GENERATED_AT,
  globalProps: { head_block_number: 100 },
  witnesses: [{ owner: 'alice' }],
  block: { blockNum: 100, block: { witness: 'alice' } },
  market: { coins: [{ id: 'hive' }], currency: 'usd', coinIds: ['hive'] },
  network: { props: { head_block_number: 100 }, median: null },
  feeds: { 'global:trending': { posts: [{ author: 'alice', permlink: 'post' }] } }
}

describe('home snapshot', () => {
  beforeEach(() => {
    resetHomeSnapshotForTests()
    document.body.innerHTML = ''
  })

  it('reads the inline snapshot synchronously', () => {
    mountInline(SNAPSHOT)
    const snapshot = getHomeSnapshot({ now: SNAPSHOT.generatedAt + 1000 })
    expect(snapshot?.generatedAt).toBe(SNAPSHOT.generatedAt)
    expect(snapshotBlock()?.blockNum).toBe(100)
    expect(snapshotWitnesses()).toHaveLength(1)
    expect(snapshotMarket()?.currency).toBe('usd')
    expect(snapshotNetwork()?.props.head_block_number).toBe(100)
    expect(snapshotFeed('global:trending')?.posts[0].permlink).toBe('post')
    expect(homeSnapshotAgeMs(snapshot, SNAPSHOT.generatedAt + 1000)).toBe(1000)
  })

  it('ignores unknown versions and expired snapshots', () => {
    mountInline({ ...SNAPSHOT, version: 2 })
    expect(getHomeSnapshot({ now: SNAPSHOT.generatedAt })).toBeNull()

    resetHomeSnapshotForTests()
    mountInline(SNAPSHOT)
    expect(getHomeSnapshot({ now: SNAPSHOT.generatedAt + HOME_SNAPSHOT_MAX_AGE_MS + 1 })).toBeNull()
  })

  it('ignores corrupt inline JSON', () => {
    document.body.innerHTML = '<script type="application/json" id="home-snapshot">{oops</script>'
    expect(getHomeSnapshot()).toBeNull()
  })

  it('returns the inline snapshot without a network request', async () => {
    mountInline(SNAPSHOT)
    const snapshot = await whenHomeSnapshot({ timeoutMs: 1 })
    expect(snapshot?.generatedAt).toBe(SNAPSHOT.generatedAt)
  })

  it('fetches the published JSON when the inline copy is absent', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => SNAPSHOT
    }))
    globalThis.fetch = fetchMock
    try {
      const snapshot = await whenHomeSnapshot({ timeoutMs: 200 })
      expect(snapshot?.generatedAt).toBe(SNAPSHOT.generatedAt)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/home-snapshot.json')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
