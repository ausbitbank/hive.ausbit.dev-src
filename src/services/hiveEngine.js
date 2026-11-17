import { LocalStorage } from 'quasar'
import { DEFAULT_HIVE_ENGINE_NODE } from './hiveNodes'

let client = null
let clientUrl = null

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

export function getHiveEngine () {
  const url = LocalStorage.getItem('settings')?.heApiNode || DEFAULT_HIVE_ENGINE_NODE
  if (!client || clientUrl !== url) {
    client = createClient(url)
    clientUrl = url
  }
  return client
}
