import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  attachBeacon,
  beaconEntryFor,
  beaconStatus,
  coverageLabel,
  featureCoverage,
  featureGaps,
  featureLabel,
  featureMatrix,
  filterNodes,
  formatHeadAge,
  formatPercent,
  headAge,
  minimumScore,
  parseBeaconNodes,
  sortNodes
} from '../../src/services/network'
import { fetchBeaconNodes } from '../../src/services/beacon'

const SAMPLE = [
  {
    name: 'api.hive.blog',
    endpoint: 'https://api.hive.blog',
    version: '1.28.8',
    score: 100,
    success: 24,
    fail: 0,
    lastBlock: 111783757,
    updated_at: '2026-11-18T23:40:13.995Z',
    features: ['get_account_history', 'broadcast', 'nft_tracker_api'],
    apps: { success: 6, fail: 1 }
  },
  {
    name: 'hapi.ecency.com',
    endpoint: 'https://hapi.ecency.com/',
    version: '-',
    score: 0,
    success: 0,
    fail: 24,
    lastBlock: null,
    features: []
  },
  {
    name: 'hive.roelandp.nl',
    endpoint: 'https://hive.roelandp.nl',
    version: '-',
    score: 34,
    success: 9,
    fail: 15,
    lastBlock: null,
    features: ['get_account_history', 'get_rc_stats']
  }
]

describe('beacon parsing', () => {
  it('maps rows by normalised endpoint and computes uptime', () => {
    const map = parseBeaconNodes(SAMPLE)

    expect(Object.keys(map)).toEqual([
      'https://api.hive.blog',
      'https://hapi.ecency.com',
      'https://hive.roelandp.nl'
    ])
    const entry = map['https://api.hive.blog']
    expect(entry).toMatchObject({
      version: '1.28.8',
      score: 100,
      uptime: 100,
      appsSuccess: 6,
      appsFail: 1
    })
    expect(entry.features).toContain('broadcast')
  })

  it('treats a dash version as unknown and nulls empty heads', () => {
    const map = parseBeaconNodes(SAMPLE)
    const entry = map['https://hapi.ecency.com']
    expect(entry.version).toBe(null)
    expect(entry.lastBlock).toBe(null)
  })

  it('survives malformed payloads', () => {
    expect(parseBeaconNodes(null)).toEqual({})
    expect(parseBeaconNodes([null, {}, { endpoint: '' }])).toEqual({})
  })

  it('matches URLs regardless of case or trailing slash', () => {
    const map = parseBeaconNodes(SAMPLE)
    expect(beaconEntryFor(map, 'https://API.hive.blog/')).toBeTruthy()
    expect(beaconEntryFor(map, 'https://unknown.example')).toBe(null)
  })

  it('classifies scores into reliability bands', () => {
    expect(beaconStatus({ score: 100 }).key).toBe('ok')
    expect(beaconStatus({ score: 75 }).key).toBe('watch')
    expect(beaconStatus({ score: 40 }).key).toBe('warning')
    expect(beaconStatus({ score: 0 }).key).toBe('critical')
    expect(beaconStatus(null).key).toBe('unknown')
  })
})

describe('feature matrix', () => {
  it('orders known features first and groups the nodes that advertise them', () => {
    const map = parseBeaconNodes(SAMPLE)
    const entries = Object.values(map)
    const matrix = featureMatrix(entries)

    expect(matrix[0]).toEqual({
      key: 'get_account_history',
      label: 'Account history',
      nodes: ['https://api.hive.blog', 'https://hive.roelandp.nl']
    })
    expect(matrix.map(feature => feature.key)).toEqual([
      'get_account_history',
      'get_rc_stats',
      'broadcast',
      'nft_tracker_api'
    ])
  })

  it('reports coverage as a share of scored nodes', () => {
    const map = parseBeaconNodes(SAMPLE)
    const entries = Object.values(map)
    const matrix = featureMatrix(entries)

    const history = matrix.find(feature => feature.key === 'get_account_history')
    expect(featureCoverage(entries, 'get_account_history')).toBeCloseTo(66.67, 1)
    expect(coverageLabel(history, entries.length)).toBe('2 / 3')
    expect(featureCoverage([], 'broadcast')).toBe(0)
  })

  it('labels features and computes gaps against a reference', () => {
    expect(featureLabel('get_account_history')).toBe('Account history')
    expect(featureLabel('hafbe_api')).toBe('HAF block explorer')
    expect(featureLabel('custom_feature_x')).toBe('Custom feature x')

    expect(featureGaps(
      { features: ['broadcast'] },
      { features: ['broadcast', 'get_account_history'] }
    )).toEqual(['get_account_history'])
  })

  it('returns an empty matrix without beacon data', () => {
    expect(featureMatrix([])).toEqual([])
  })

  it('does not treat node rows with a nested beacon as feature entries', () => {
    const map = parseBeaconNodes(SAMPLE)
    const entries = Object.values(map)
    // The /nodes page must pass beacon entries, not probed node rows.
    expect(featureMatrix(entries.map(entry => ({ url: entry.endpoint, beacon: entry })))).toEqual([])
    expect(featureMatrix(entries).length).toBeGreaterThan(0)
  })
})

describe('beacon merge helpers', () => {
  it('attaches beacon data to probe rows by URL', () => {
    const map = parseBeaconNodes(SAMPLE)
    const nodes = attachBeacon([
      { url: 'https://api.hive.blog', ok: true },
      { url: 'https://not-listed.example', ok: true }
    ], map)

    expect(nodes[0].beacon.score).toBe(100)
    expect(nodes[1].beacon).toBe(null)
  })

  it('returns the minimum health score across healthy nodes', () => {
    expect(minimumScore([
      { ok: true, beacon: { score: 100 } },
      { ok: true, beacon: { score: 60 } },
      { ok: true, beacon: null },
      { ok: false, beacon: { score: 5 } }
    ])).toBe(60)
    expect(minimumScore([])).toBe(null)
  })
})

describe('head age and formatting', () => {
  it('computes seconds from a chain timestamp', () => {
    const now = Date.parse('2026-11-18T12:00:10Z')
    expect(headAge('2026-11-18T12:00:00', now)).toBe(10)
    expect(headAge('not-a-date', now)).toBe(null)
    expect(headAge(null, now)).toBe(null)
  })

  it('formats ages and percentages', () => {
    expect(formatHeadAge(0)).toBe('just now')
    expect(formatHeadAge(9)).toBe('9s ago')
    expect(formatHeadAge(125)).toBe('2m ago')
    expect(formatHeadAge(null)).toBe('—')
    expect(formatPercent(98.4)).toBe('98%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('sorting and filtering', () => {
  const nodes = [
    { url: 'https://c.example', ok: true, latency: 300, lag: 0, version: '1.28.8', fallback: true, beacon: { score: 100 } },
    { url: 'https://a.example', ok: true, latency: 80, lag: 5, version: '1.28.7', fallback: true, beacon: { score: 60 } },
    { url: 'https://b.example', ok: false, latency: Infinity, lag: null },
    { url: 'https://d.example', ok: true, latency: 120, lag: 0, version: '1.28.8', fallback: false, beacon: { score: 34 } }
  ]

  it('sorts healthy nodes before failing ones by latency', () => {
    const sorted = sortNodes(nodes, 'latency', 'asc')
    expect(sorted.map(node => node.url)).toEqual([
      'https://a.example',
      'https://d.example',
      'https://c.example',
      'https://b.example'
    ])
  })

  it('sorts by lag, score, version and name', () => {
    expect(sortNodes(nodes, 'lag', 'asc').map(node => node.url)).toEqual([
      'https://d.example',
      'https://c.example',
      'https://a.example',
      'https://b.example'
    ])
    expect(sortNodes(nodes, 'score', 'desc')[0].url).toBe('https://c.example')
    expect(sortNodes(nodes, 'version', 'asc')[0].url).toBe('https://a.example')
    expect(sortNodes(nodes, 'name', 'asc')[0].url).toBe('https://a.example')
  })

  it('uses the supplied typical-latency function for the latency sort', () => {
    const one = { url: 'https://one.example', ok: true, latency: 50, lag: 0 }
    const two = { url: 'https://two.example', ok: true, latency: 300, lag: 0 }
    const typical = { 'https://one.example': 400, 'https://two.example': 90 }
    const sorted = sortNodes([one, two], 'latency', 'asc', { typicalOf: node => typical[node.url] })
    expect(sorted[0].url).toBe('https://two.example')
  })

  it('filters by health, fallback membership and problems', () => {
    expect(filterNodes(nodes, 'healthy')).toHaveLength(3)
    expect(filterNodes(nodes, 'fallback').map(node => node.url)).toEqual([
      'https://c.example',
      'https://a.example'
    ])
    expect(filterNodes(nodes, 'problems').map(node => node.url)).toEqual([
      'https://a.example',
      'https://b.example'
    ])
    expect(filterNodes(nodes, 'all')).toHaveLength(4)
  })
})

describe('fetchBeaconNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and maps the beacon payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE
    })

    const result = await fetchBeaconNodes({ fetchImpl })
    expect(result.ok).toBe(true)
    expect(Object.keys(result.nodes)).toHaveLength(3)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://beacon.peakd.com/api/nodes',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('reports an error without throwing on a bad response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    await expect(fetchBeaconNodes({ fetchImpl })).resolves.toMatchObject({
      ok: false,
      nodes: {},
      error: 'HTTP 503'
    })
  })

  it('reports an empty body as not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    await expect(fetchBeaconNodes({ fetchImpl })).resolves.toMatchObject({
      ok: false,
      error: 'No nodes in response'
    })
  })

  it('treats an aborted request as a timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))

    const promise = fetchBeaconNodes({ fetchImpl, timeoutMs: 50 })
    await vi.advanceTimersByTimeAsync(50)
    await expect(promise).resolves.toMatchObject({ ok: false, error: 'Timed out' })
    vi.useRealTimers()
  })
})
