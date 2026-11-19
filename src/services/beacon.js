// Read-only client for the Hive Node Beacon monitor (beacon.peakd.com).
//
// Beacon independently checks every known public node hourly and publishes a
// reliability score plus the API features each node advertises. The /nodes page
// uses it as a second, long-run opinion next to the browser probe: beacon says
// whether a node is *usually* good, the browser probe says whether it is good
// from this device right now.
//
// The endpoint is CORS-open and anonymous. Failures return an empty map so the
// page keeps working from local probes alone.

import { BEACON_API_BASE } from './hiveNodes'
import { parseBeaconNodes } from './network'

export const BEACON_TIMEOUT_MS = 6000

/**
 * Fetch beacon's node list. Always resolves: on any error the returned map is
 * empty and `ok` is false with a human-readable error.
 */
export async function fetchBeaconNodes ({
  baseUrl = BEACON_API_BASE,
  timeoutMs = BEACON_TIMEOUT_MS,
  fetchImpl = typeof fetch === 'function' ? fetch : null
} = {}) {
  if (!fetchImpl) return { ok: false, nodes: {}, error: 'Fetch unavailable' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(baseUrl + '/nodes', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) return { ok: false, nodes: {}, error: 'HTTP ' + response.status }
    const payload = await response.json()
    const nodes = parseBeaconNodes(payload)
    return {
      ok: Object.keys(nodes).length > 0,
      nodes,
      error: Object.keys(nodes).length ? '' : 'No nodes in response',
      fetchedAt: Date.now()
    }
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
    return { ok: false, nodes: {}, error: message }
  } finally {
    clearTimeout(timer)
  }
}
