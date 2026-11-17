import SSC from 'sscjs'
import { LocalStorage } from 'quasar'
import { DEFAULT_HIVE_ENGINE_NODE } from './hiveNodes'

let client = null
let clientUrl = null

// sscjs ships axios 0.19 and sends an invalid `Access-Control-Allow-Origin`
// request header, which breaks Hive-Engine's CORS preflight. Replace its
// transport with fetch, and throttle requests: Hive-Engine rate-limits bursts
// with responses that lack CORS headers, which browsers surface as CORS errors.
const FALLBACK_HOSTS = [
  'https://api.hive-engine.com/rpc',
  'https://herpc.dtools.dev',
  'https://api.primersion.com',
  'https://enginerpc.com'
]

function createTransport (baseUrl) {
  const primary = baseUrl.replace(/\/+$/, '')
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

  return {
    defaults: { headers: {} },
    post (endpoint, body) {
      const path = String(endpoint).replace(/^\/+/, '')
      return schedule(async () => {
        let lastError
        for (let attempt = 0; attempt < bases.length; attempt++) {
          const base = bases[attempt]
          try {
            const res = await fetch(`${base}/${path}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            })
            if (!res.ok) throw new Error(`Hive-Engine HTTP ${res.status}`)
            return { data: await res.json() }
          } catch (error) {
            lastError = error
            await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
          }
        }
        throw lastError
      })
    }
  }
}

export function getHiveEngine () {
  const url = LocalStorage.getItem('settings')?.heApiNode || DEFAULT_HIVE_ENGINE_NODE
  if (!client || clientUrl !== url) {
    client = new SSC(url)
    client.axios = createTransport(url)
    clientUrl = url
  }
  return client
}
