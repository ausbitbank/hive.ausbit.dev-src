// Magi Network (formerly VSC) read models.
//
// Magi exposes a public GraphQL API. Hive accounts map to the `hive:<name>`
// namespace, and ledger amounts are integers with three decimals.

import { loadCached } from './cache'

export const MAGI_ENDPOINTS = [
  'https://vsc.techcoderx.com/api/v1/graphql',
  'https://api.vsc.eco/api/v1/graphql',
  'https://vsc.atexoras.com:2087/api/v1/graphql'
]

const MAGI_TTL = 60000
const REQUEST_TIMEOUT_MS = 12000
const LEDGER_QUERY = `query ($account: String!, $limit: Int) {
  getAccountBalance(account: $account) {
    account
    block_height
    hive
    hbd
    hive_consensus
    hbd_savings
    consensus_unstaking
    pending_hbd_unstaking
  }
  findLedgerTXs(filterOptions: { byToFrom: $account, limit: $limit }) {
    id
    amount
    block_height
    timestamp
    from
    owner
    type
    asset
    tx_id
  }
}`

export function magiAccountName (name) {
  const value = String(name || '').trim().toLowerCase().replace(/^@/, '')
  if (!value) return ''
  return value.startsWith('hive:') ? value : 'hive:' + value
}

/** Ledger amounts use three decimals for HIVE/HBD. */
export function magiAmount (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number / 1000 : 0
}

export function magiBalances (record) {
  if (!record) return null
  return {
    account: record.account || '',
    blockHeight: Number(record.block_height) || 0,
    hive: magiAmount(record.hive),
    hbd: magiAmount(record.hbd),
    consensus: magiAmount(record.hive_consensus),
    hbdSavings: magiAmount(record.hbd_savings),
    unstaking: magiAmount(record.consensus_unstaking),
    pendingUnstaking: magiAmount(record.pending_hbd_unstaking)
  }
}

export function magiLedgerRows (rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const amount = magiAmount(row.amount)
    const asset = String(row.asset || '').toUpperCase()
    const type = String(row.type || 'ledger')
    const direction = amount < 0 ? 'out' : 'in'
    return {
      id: row.id || row.tx_id || '',
      type,
      asset,
      amount,
      amountLabel: Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' ' + asset,
      direction,
      timestamp: row.timestamp || '',
      blockHeight: Number(row.block_height) || 0,
      from: row.from || '',
      owner: row.owner || '',
      txId: row.tx_id || '',
      label: 'Magi ' + type,
      summary: (direction === 'out' ? 'Sent ' : 'Received ') + Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' ' + asset
    }
  })
}

function requestHeaders () {
  return { 'content-type': 'application/json' }
}

async function queryEndpoint (endpoint, variables) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({ query: LEDGER_QUERY, variables }),
      signal: controller.signal
    })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const json = await response.json()
    if (json.errors && json.errors.length) throw new Error(json.errors[0].message || 'Magi GraphQL error')
    return json.data || null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch one account's Magi balances and recent ledger transactions.
 * Returns `{ balances, transactions, endpoint }` or null when no node answers.
 */
export async function fetchMagiAccount (name, { limit = 20, force = false } = {}) {
  const account = magiAccountName(name)
  if (!account) return null
  const size = Math.max(1, Math.min(50, Number(limit) || 20))
  return loadCached('magi:account:' + account + ':' + size, async () => {
    let lastError
    for (const endpoint of MAGI_ENDPOINTS) {
      try {
        const data = await queryEndpoint(endpoint, { account, limit: size })
        if (!data) continue
        return {
          endpoint,
          balances: magiBalances(data.getAccountBalance),
          transactions: magiLedgerRows(data.findLedgerTXs)
        }
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('Magi Network is unavailable')
  }, { ttl: MAGI_TTL, force })
}
