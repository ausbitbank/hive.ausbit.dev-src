import hive from '@hiveio/hive-js'
import { DEFAULT_HIVE_NODE, HIVE_API_NODES } from './hiveNodes'

hive.config.set('alternative_api_endpoints', HIVE_API_NODES)

export function setHiveNode (url) {
  hive.api.setOptions({ url: url || DEFAULT_HIVE_NODE })
}

export default hive
export { hive }
