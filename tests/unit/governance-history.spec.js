import { describe, expect, it } from 'vitest'
import {
  SNAPSHOT_INTERVAL_MS,
  clearHistory,
  loadHistory,
  networkTrend,
  recordSnapshot,
  snapshotWitnesses,
  witnessMissedTrend
} from '../../src/services/governanceHistory'

function memoryStorage (initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem (key) { return data.has(key) ? data.get(key) : null },
    setItem (key, value) { data.set(key, String(value)) },
    removeItem (key) { data.delete(key) },
    size () { return data.size }
  }
}

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-11-18T12:00:00Z')

function witnesses (missed = 4) {
  return [
    {
      owner: 'alice',
      total_missed: missed,
      last_confirmed_block_num: 1000,
      last_hbd_exchange_update: '2026-11-18T09:00:00',
      running_version: '1.28.8'
    },
    {
      owner: 'bob',
      total_missed: 2,
      last_confirmed_block_num: 1000,
      last_hbd_exchange_update: '2026-11-18T09:00:00',
      running_version: '1.28.8'
    }
  ]
}

describe('governance history snapshots', () => {
  it('records the first snapshot and replaces it inside the quiet window', () => {
    const storage = memoryStorage()
    recordSnapshot(witnesses(4), { now: NOW, storage })
    expect(loadHistory(storage)).toHaveLength(1)

    recordSnapshot(witnesses(6), { now: NOW + HOUR, storage })
    const history = loadHistory(storage)
    expect(history).toHaveLength(1)
    expect(history[0].at).toBe(NOW + HOUR)
    expect(history[0].witnesses[0].missed).toBe(6)
  })

  it('adds a new snapshot after the interval and reports network trends', () => {
    const storage = memoryStorage()
    recordSnapshot(witnesses(4), { now: NOW, storage })
    recordSnapshot(
      [
        { ...witnesses(9)[0], last_hbd_exchange_update: '2026-11-18T18:00:00' },
        witnesses(2)[1]
      ],
      { now: NOW + SNAPSHOT_INTERVAL_MS + 1, storage }
    )

    const history = loadHistory(storage)
    expect(history).toHaveLength(2)
    expect(networkTrend(history)).toMatchObject({
      available: true,
      missedDelta: 5,
      feedsUpdated: 1,
      witnessesTracked: 2
    })
    expect(witnessMissedTrend(history, 'alice')).toMatchObject({
      available: true,
      missedDelta: 5
    })
  })

  it('keeps only the newest snapshots within the cap', () => {
    const storage = memoryStorage()
    for (let index = 0; index < 35; index++) {
      recordSnapshot(witnesses(index), {
        now: NOW + index * (SNAPSHOT_INTERVAL_MS + 1),
        storage
      })
    }
    const history = loadHistory(storage)
    expect(history).toHaveLength(30)
    expect(history[29].witnesses[0].missed).toBe(34)
  })

  it('ignores corrupt storage and can be cleared', () => {
    const storage = memoryStorage({ 'hive.governance.history.v1': '{not json' })
    expect(loadHistory(storage)).toEqual([])

    recordSnapshot(witnesses(), { now: NOW, storage })
    clearHistory(storage)
    expect(loadHistory(storage)).toEqual([])
  })

  it('normalises a snapshot payload', () => {
    const snapshot = snapshotWitnesses(witnesses(), NOW)
    expect(snapshot.at).toBe(NOW)
    expect(snapshot.witnesses[0]).toMatchObject({
      owner: 'alice',
      missed: 4,
      lastConfirmed: 1000,
      version: '1.28.8'
    })
  })
})
