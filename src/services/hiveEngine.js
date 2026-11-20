import { LocalStorage } from 'quasar'
import { DEFAULT_HIVE_ENGINE_NODE, HIVE_ENGINE_NODES } from './hiveNodes'
import { pickFastestHealthy } from './network'

let client = null
let clientUrl = null

export const HIVE_ENGINE_PROBE_TIMEOUT_MS = 4000

// Hive-Engine rate-limits bursts with responses that lack CORS headers, which
// browsers surface as CORS errors. Keep request concurrency low and retry
// against fallback hosts.
const FALLBACK_HOSTS = [
  'https://api.hive-engine.com/rpc',
  'https://herpc.dtools.dev',
  'https://api.primersion.com',
  'https://enginerpc.com'
]

const REQUEST_TIMEOUT_MS = 15000

function normalizeBase (url) {
  return String(url).replace(/\/+$/, '')
}

function createTransport (baseUrl) {
  const primary = normalizeBase(baseUrl)
  const bases = [primary, ...FALLBACK_HOSTS.filter(host => host !== primary)]
  const queue = []
  let active = 0
  const MAX_CONCURRENT = 2

  function pump () {
    while (active < MAX_CONCURRENT && queue.length > 0) {
      const job = queue.shift()
      active++
      job().finally(() => {
        active--
        pump()
      })
    }
  }

  function schedule (job) {
    return new Promise((resolve, reject) => {
      queue.push(() => job().then(resolve, reject))
      pump()
    })
  }

  async function post (endpoint, body) {
    const path = String(endpoint).replace(/^\/+/, '')
    return schedule(async () => {
      let lastError
      for (let attempt = 0; attempt < bases.length; attempt++) {
        const base = bases[attempt]
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        try {
          const res = await fetch(`${base}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
          })
          if (!res.ok) throw new Error(`Hive-Engine HTTP ${res.status}`)
          const json = await res.json()
          if (json && json.error) {
            throw new Error(json.error.message || 'Hive-Engine request failed')
          }
          return json
        } catch (error) {
          lastError = error
          if (attempt < bases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
          }
        } finally {
          clearTimeout(timer)
        }
      }
      throw lastError
    })
  }

  return { post }
}

function createClient (baseUrl) {
  const transport = createTransport(baseUrl)
  let id = 1

  return {
    find (contract, table, query, limit = 1000, offset = 0, indexes = []) {
      const request = {
        jsonrpc: '2.0',
        id: id++,
        method: 'find',
        params: {
          contract,
          table,
          query,
          limit,
          offset,
          indexes
        }
      }

      return transport.post('contracts', request).then(json => {
        const result = json && json.result
        return Array.isArray(result) ? result : []
      })
    }
  }
}

function probeErrorMessage (error) {
  return error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
}

/**
 * Hive-Engine exposes a small status document at the root of every RPC host.
 * It is much cheaper than a contract query and includes both the sidechain head
 * and the Hive block the node has parsed.
 */
export async function probeHiveEngineNode (url, timeoutMs = HIVE_ENGINE_PROBE_TIMEOUT_MS) {
  const base = String(url || '').trim().replace(/\/+$/, '')
  if (!base) return { url, ok: false, latency: Infinity, error: 'No node URL' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(base + '/', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    const latency = Date.now() - started
    if (!response.ok) return { url: base, ok: false, latency, error: 'HTTP ' + response.status }

    const data = await response.json()
    const head = Number(data?.lastBlockNumber)
    if (!Number.isFinite(head) || head <= 0) {
      return { url: base, ok: false, answered: true, latency, error: 'Invalid status response' }
    }

    return {
      url: base,
      ok: true,
      latency,
      head,
      hiveHead: Number(data?.lastBlockRefHiveBlockNumber) || null,
      lastParsedHiveBlock: Number(data?.lastParsedHiveBlockNumber) || null,
      version: data?.SSCnodeVersion || null,
      chainId: data?.chainId || null,
      lightNode: Boolean(data?.lightNode),
      disabledMethods: data?.disabledMethods || null,
      lastVerifiedBlock: Number(data?.lastVerifiedBlockNumber) || null
    }
  } catch (error) {
    return {
      url: base,
      ok: false,
      latency: Date.now() - started,
      error: probeErrorMessage(error)
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Pick a usable Hive-Engine primary node. The configured node wins when it is
 * healthy; otherwise the fastest healthy candidate is returned. All probes run
 * in parallel so a dead network delays startup by at most one timeout.
 */
export async function selectHiveEngineNode (configuredUrl, timeoutMs = HIVE_ENGINE_PROBE_TIMEOUT_MS) {
  const configured = configuredUrl || DEFAULT_HIVE_ENGINE_NODE
  const candidates = [...new Set([configured, ...HIVE_ENGINE_NODES].filter(Boolean))]
  const probes = await Promise.all(candidates.map(url => probeHiveEngineNode(url, timeoutMs)))
  const configuredProbe = probes.find(probe => probe.url === configured.replace(/\/+$/, ''))
  if (configuredProbe?.ok) return configuredProbe.url
  const fastest = pickFastestHealthy(probes)
  return fastest?.url || configured
}

export function getHiveEngine () {
  const url = LocalStorage.getItem('settings')?.heApiNode || DEFAULT_HIVE_ENGINE_NODE
  if (!client || clientUrl !== url) {
    client = createClient(url)
    clientUrl = url
  }
  return client
}
