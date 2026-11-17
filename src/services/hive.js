import hive from '@hiveio/hive-js'
import { DEFAULT_HIVE_NODE, HIVE_API_NODES } from './hiveNodes'
import { configureApi } from './api'

hive.config.set('alternative_api_endpoints', HIVE_API_NODES)

export const HIVE_NODE_PROBE_TIMEOUT_MS = 2000

export function setHiveNode (url) {
  const node = url || DEFAULT_HIVE_NODE
  hive.api.setOptions({ url: node })
  configureApi({ node })
}

/**
 * Probe a Hive API node with a cheap condenser call.
 *
 * Always resolves; failures are reported as `{ ok: false, error }` so callers
 * can use it inside Promise.all without extra error handling.
 */
export async function probeHiveNode (url, timeoutMs = HIVE_NODE_PROBE_TIMEOUT_MS) {
  if (!url || typeof url !== 'string') {
    return { url, ok: false, latency: Infinity, error: 'No node URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'condenser_api.get_dynamic_global_properties',
        params: []
      }),
      signal: controller.signal
    })

    const latency = Date.now() - started
    if (!response.ok) {
      return { url, ok: false, latency, error: 'HTTP ' + response.status }
    }

    const data = await response.json()
    const head = Number(data?.result?.head_block_number)
    if (!Number.isFinite(head) || head <= 0) {
      return { url, ok: false, latency, error: data?.error?.message || 'Invalid response' }
    }

    return { url, ok: true, latency, head }
  } catch (error) {
    const latency = Date.now() - started
    const message = error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
    return { url, ok: false, latency, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch the reporting node's software version. Supports both the condenser
 * `get_version` result and a `hive_version` field on global properties.
 */
export async function probeHiveNodeVersion (url, timeoutMs = HIVE_NODE_PROBE_TIMEOUT_MS) {
  if (!url || typeof url !== 'string') {
    return { url, ok: false, version: null, chainId: null, error: 'No node URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'condenser_api.get_version',
        params: []
      }),
      signal: controller.signal
    })
    if (!response.ok) {
      return { url, ok: false, version: null, chainId: null, error: 'HTTP ' + response.status }
    }
    const data = await response.json()
    const version = data?.result?.blockchain_version || data?.result?.hive_version || null
    return {
      url,
      ok: Boolean(version),
      version,
      chainId: data?.result?.chain_id || null,
      error: version ? '' : (data?.error?.message || 'Version unavailable')
    }
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
    return { url, ok: false, version: null, chainId: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Probe a node for head, latency and software version in parallel. Always
 * resolves; a version failure does not make an otherwise healthy node fail.
 */
export async function probeHiveNodeFull (url, timeoutMs = HIVE_NODE_PROBE_TIMEOUT_MS) {
  const [base, version] = await Promise.all([
    probeHiveNode(url, timeoutMs),
    probeHiveNodeVersion(url, timeoutMs)
  ])
  return {
    ...base,
    version: version.ok ? version.version : null,
    chainId: version.chainId || null
  }
}

/**
 * Pick a usable API node at startup.
 *
 * The configured node wins when it is healthy; otherwise the fastest healthy
 * known node is used. All candidates are probed in parallel so a dead network
 * delays startup by at most one probe timeout (~2s). If nothing responds the
 * configured URL is returned so the app still starts.
 */
export async function selectHiveNode (configuredUrl) {
  const configured = configuredUrl || DEFAULT_HIVE_NODE
  const candidates = [...new Set([configured, ...HIVE_API_NODES])]
  const probes = await Promise.all(candidates.map(url => probeHiveNode(url)))

  const configuredProbe = probes.find(probe => probe.url === configured)
  if (configuredProbe?.ok) return configured

  const healthy = probes
    .filter(probe => probe.ok)
    .sort((a, b) => a.latency - b.latency)

  return healthy.length > 0 ? healthy[0].url : configured
}

export default hive
export { hive }
