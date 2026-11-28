// Shared input helpers for signing dialogs and Hive-Engine writes.
//
// Keeping these together avoids three tiny chunks in the route preload map.
// Each helper still has one job: strict amount parsing, a monotonic request id,
// and a JSON-serialised Hive-Engine operation.

export function parseAssetAmount (value, { precision = 3, max = null } = {}) {
  const text = String(value ?? '').trim()
  // Reject thousands/decimal commas instead of guessing: `1,5` must not become
  // 1.5 and `1,000` must not become 1.
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const number = Number(text)
  if (!Number.isFinite(number)) return null
  if (number <= 0) return null
  if (max !== null && max !== undefined && max !== '' && Number.isFinite(Number(max)) && number > Number(max)) {
    return null
  }
  const places = Math.max(0, Math.min(8, Number(precision) || 0))
  const factor = 10 ** places
  // Round down so a "max" amount cannot exceed the balance through rounding.
  const rounded = Math.floor(number * factor + 1e-9) / factor
  if (rounded <= 0) return null
  return rounded.toFixed(places)
}

let requestIdCounter = 0

/** Monotonic uint32-safe request id for savings/conversion/order actions. */
export function nextRequestId (now = Date.now()) {
  requestIdCounter = (requestIdCounter + 1) % 1000
  const base = Math.floor(Number(now) / 1000) % 1_000_000
  return base * 1000 + requestIdCounter || 1
}

const HIVE_ENGINE_JSON_ID = 'ssc-mainnet-hive'

export function hiveEngineJson (contractName, contractAction, contractPayload = {}) {
  return JSON.stringify({
    contractName: String(contractName),
    contractAction: String(contractAction),
    contractPayload: { ...(contractPayload || {}) }
  })
}

export function hiveEngineOperation (account, contractName, contractAction, contractPayload = {}) {
  return ['custom_json', {
    required_auths: [String(account || '')],
    required_posting_auths: [],
    id: HIVE_ENGINE_JSON_ID,
    json: hiveEngineJson(contractName, contractAction, contractPayload)
  }]
}
