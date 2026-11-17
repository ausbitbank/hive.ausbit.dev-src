import hive from '@hiveio/hive-js'
import { DEFAULT_HIVE_NODE, HIVE_API_NODES } from './hiveNodes'

hive.config.set('alternative_api_endpoints', HIVE_API_NODES)

export const HIVE_NODE_PROBE_TIMEOUT_MS = 2000

export function setHiveNode (url) {
  hive.api.setOptions({ url: url || DEFAULT_HIVE_NODE })
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
 * Pick a usable API node at startup.
 *
 * The configured node wins when it is healthy. Otherwise all known nodes are
 * probed in parallel (each capped at ~2s) and the fastest responder is used.
 * If nothing responds the configured URL is returned so the app still starts;
 * hive-js will retry against its alternative endpoints.
 */
export async function selectHiveNode (configuredUrl) {
  const configured = configuredUrl || DEFAULT_HIVE_NODE

  const configuredProbe = await probeHiveNode(configured)
  if (configuredProbe.ok) return configured

  const candidates = [...new Set(HIVE_API_NODES)].filter(url => url !== configured)
  if (candidates.length === 0) return configured

  const probes = await Promise.all(candidates.map(url => probeHiveNode(url)))
  const healthy = probes
    .filter(probe => probe.ok)
    .sort((a, b) => a.latency - b.latency)

  return healthy.length > 0 ? healthy[0].url : configured
}

export default hive
export { hive }
