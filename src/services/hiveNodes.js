// Public Hive API nodes used by the explorer.
//
// The roster is seeded from the Hive Node Beacon monitor
// (https://beacon.peakd.com/api/nodes) and every entry answered a live
// `condenser_api.get_dynamic_global_properties` probe when this list was last
// reviewed. `HIVE_API_NODES` is ordered by the last observed health so the
// fast, fully-synced nodes are tried first by the failover client.
export const HIVE_API_NODES = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://api.deathwing.me',
  'https://rpc.mahdiyari.info',
  'https://techcoderx.com',
  'https://api.syncad.com',
  'https://hive.atexoras.com:2096',
  'https://hiveapi.actifit.io',
  'https://api.c0ff33a.uk'
]

export const DEFAULT_HIVE_NODE = HIVE_API_NODES[0]
export const DEFAULT_ACCOUNT_HISTORY_NODE = 'https://api.hive.blog'
export const DEFAULT_HIVE_ENGINE_NODE = 'https://herpc.dtools.dev'

// Beacon also tracks nodes that were flaky or limited at review time. They are
// probed from the /nodes page but are not used as automatic fallbacks, since a
// broken fallback only adds latency to a failover.
export const WATCHED_HIVE_NODES = [
  'https://hapi.ecency.com',
  'https://hive.roelandp.nl',
  'https://hive-api.3speak.tv'
]

// Hosts that historically only expose a subset of the API (for example a
// Hivemind-only endpoint without `get_version`). A missing endpoint is not
// treated as a node failure, only as a missing feature.
export const PARTIAL_FEATURE_NODES = [
  'https://hapi.ecency.com'
]

export const BEACON_API_BASE = 'https://beacon.peakd.com/api'

// Health score beacon assigns to a node (0-100). Higher is healthier.
export const BEACON_HEALTHY_SCORE = 60

export function allHiveNodes () {
  return [...new Set([...HIVE_API_NODES, ...WATCHED_HIVE_NODES])]
}

export function isFallbackNode (url) {
  return HIVE_API_NODES.includes(url)
}
