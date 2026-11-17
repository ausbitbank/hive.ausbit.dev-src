// Nodes that answered a live `condenser_api.get_dynamic_global_properties`
// probe when this list was last reviewed. Keep them sorted by observed latency.
export const HIVE_API_NODES = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://api.deathwing.me',
  'https://rpc.mahdiyari.info'
]

export const DEFAULT_HIVE_NODE = HIVE_API_NODES[0]
export const DEFAULT_ACCOUNT_HISTORY_NODE = 'https://api.hive.blog'
export const DEFAULT_HIVE_ENGINE_NODE = 'https://herpc.dtools.dev'
