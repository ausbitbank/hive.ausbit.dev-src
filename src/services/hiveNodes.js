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

// Hive-Engine public RPC nodes. The first four are the automatic candidates
// used by the failover client and the node selector. The watched list is
// seeded from the public Hive-Engine benchmark reports and is probed on the
// /nodes page, but never selected automatically.
export const HIVE_ENGINE_NODES = [
  'https://herpc.dtools.dev',
  'https://api.hive-engine.com/rpc',
  'https://api.primersion.com',
  'https://enginerpc.com'
]

export const WATCHED_HIVE_ENGINE_NODES = [
  'https://herpc.filoz.info',
  'https://engine.hive.pizza',
  'https://he.c0ff33a.uk',
  'https://heapi.c0ff33a.uk',
  'https://herpc.actifit.io',
  'https://herpc.kanibot.com',
  'https://api2.hive-engine.com/rpc',
  'https://herpc.liotes.com',
  'https://he.atexoras.com:2083',
  'https://light.primersion.com'
]

export const DEFAULT_HIVE_ENGINE_NODE = HIVE_ENGINE_NODES[0]

// Magi (formerly VSC) GraphQL endpoints. These are the public endpoints
// published by the Magi/Aioha documentation. There is no public Magi node
// registry, so the roster is curated and users can override it in Settings.
export const MAGI_NODES = [
  'https://vsc.techcoderx.com/api/v1/graphql',
  'https://api.vsc.eco/api/v1/graphql',
  'https://vsc.atexoras.com:2087/api/v1/graphql'
]

export const DEFAULT_MAGI_NODE = MAGI_NODES[0]

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

export function allHiveEngineNodes () {
  return [...new Set([...HIVE_ENGINE_NODES, ...WATCHED_HIVE_ENGINE_NODES])]
}

export function isHiveEngineFallbackNode (url) {
  return HIVE_ENGINE_NODES.includes(url)
}

export function isMagiNode (url) {
  return MAGI_NODES.includes(url)
}
