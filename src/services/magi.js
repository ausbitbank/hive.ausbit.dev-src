// Magi Network (formerly VSC) read models and GraphQL node probes.
//
// Magi exposes a public GraphQL API. Hive accounts map to the `hive:<name>`
// namespace, and ledger amounts are integers with three decimals.

import { LocalStorage } from 'quasar'
import { loadCached } from './cache'
import { MAGI_NODES } from './hiveNodes'

export const MAGI_ENDPOINTS = MAGI_NODES
export const MAGI_PROBE_TIMEOUT_MS = 4000
export const MAGI_TOKEN_INDEXER = 'https://indexer.magi.milohpr.com/v1/graphql'

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

const NODE_QUERY = `query {
  localNodeInfo {
    version_id
    running_version
    git_commit
    last_processed_block
    epoch
    consensus_version_display
    processing_suspended
    active_consensus_line
    active_consensus_executor
  }
}`

const ACCOUNT_DETAILS_QUERY = `query ($account: String!) {
  getAccountRC(account: $account) {
    account
    amount
    max_rcs
    block_height
  }
  getAccountNonce(account: $account) {
    account
    nonce
  }
  getNodeDelegationMode(account: $account)
  witnessStake(account: $account)
}`

const TOKENS_QUERY = `query ($account: String!) {
  magi_token_balances(where: {account: {_eq: $account}}) {
    contract_id
    balance
  }
  magi_token_overview {
    contract_id
    symbol
    decimals
  }
}`

const DELEGATION_QUERY = `query ($from: String!, $to: String!) {
  getConsensusDelegation(from: $from, to: $to) {
    from
    to
    delegated
    claimable
  }
}`

const WITNESS_QUERY = `query ($height: Uint64!) {
  witnessNodes(height: $height) {
    account
    height
    version_id
    git_commit
    net_id
    peer_id
    protocol_version
    enabled
    delegation_mode
    ts
    tx_id
  }
}`

const CONTRACT_QUERY = `query ($id: String!, $outputLimit: Int) {
  contract: findContract(filterOptions: { byId: $id, historical: true }) {
    id
    code
    name
    description
    creator
    owner
    tx_id
    creation_height
    creation_ts
    runtime
    activation_height
    activation_ts
    proposer
  }
  pending: findPendingContractUpdates(filterOptions: { byId: $id }) {
    id
    code
    name
    description
    creator
    owner
    tx_id
    creation_height
    creation_ts
    runtime
    activation_height
    activation_ts
    proposer
  }
  outputs: findContractOutput(filterOptions: { byContract: $id, limit: $outputLimit }) {
    id
    block_height
    timestamp
    contract_id
    inputs
    state_merkle
    results {
      ret
      ok
    }
  }
}`

const RECENT_CONTRACTS_QUERY = `query ($limit: Int) {
  findContract(filterOptions: { limit: $limit }) {
    id
    name
    description
    owner
    runtime
    creation_height
    activation_height
  }
}`

const CONTRACT_STATE_QUERY = `query ($id: String!, $keys: [String!]!) {
  getStateByKeys(contractId: $id, keys: $keys)
}`

const SIMULATE_CALL_QUERY = `query ($input: SimulateContractCallsInput!) {
  simulateContractCalls(input: $input) {
    success
    err
    err_msg
    ret
    rc_used
    gas_used
    logs
    state_diff
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

/**
 * Format a raw Magi token integer using its decimals without losing precision
 * on values larger than Number.MAX_SAFE_INTEGER.
 */
export function formatMagiTokenAmount (balance, decimals = 0) {
  const raw = String(balance ?? 0).trim()
  if (!/^-?\d+$/.test(raw)) return '0'
  const negative = raw.startsWith('-')
  const digits = negative ? raw.slice(1) : raw
  const places = Math.max(0, Math.min(18, Number(decimals) || 0))
  const padded = digits.padStart(places + 1, '0')
  const whole = padded.slice(0, padded.length - places).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = places ? padded.slice(padded.length - places).replace(/0+$/, '') : ''
  return (negative ? '-' : '') + whole + (fraction ? '.' + fraction : '')
}

/**
 * Merge public `magi_token_balances` with the token overview and key rows by
 * contract ID. Symbols are intentionally not used as keys because test tokens
 * can reuse a symbol.
 */
export function magiTokenRows (balances, overview) {
  const meta = new Map()
  for (const token of Array.isArray(overview) ? overview : []) {
    if (token?.contract_id) meta.set(token.contract_id, token)
  }

  return (Array.isArray(balances) ? balances : [])
    .filter(row => row?.contract_id && String(row.balance ?? 0) !== '0')
    .map(row => {
      const contractId = row.contract_id
      const info = meta.get(contractId) || {}
      const decimals = Number.isFinite(Number(info.decimals)) ? Number(info.decimals) : 0
      return {
        contractId,
        symbol: info.symbol || 'Token',
        decimals,
        raw: String(row.balance ?? 0),
        amountLabel: formatMagiTokenAmount(row.balance, decimals)
      }
    })
    .sort((a, b) => {
      const symbol = a.symbol.localeCompare(b.symbol)
      return symbol !== 0 ? symbol : a.contractId.localeCompare(b.contractId)
    })
}

function preferredMagiNode () {
  try {
    return LocalStorage.getItem('settings')?.magiApiNode || ''
  } catch {
    return ''
  }
}

/** Configured Magi endpoint first, then every known public fallback. */
export function magiEndpointOrder (preferred = preferredMagiNode()) {
  const configured = String(preferred || '').trim()
  return [...new Set([configured, ...MAGI_ENDPOINTS].filter(Boolean))]
}

function requestHeaders () {
  return { 'content-type': 'application/json' }
}

function probeErrorMessage (error) {
  return error?.name === 'AbortError' ? 'Timed out' : (error?.message || 'Unreachable')
}

async function queryEndpoint (endpoint, query, variables = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({ query, variables }),
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

async function queryMagi (query, variables = {}, { timeoutMs = REQUEST_TIMEOUT_MS, endpoint = '' } = {}) {
  const configured = String(endpoint || '').trim()
  const endpoints = configured
    ? [configured, ...magiEndpointOrder().filter(url => url !== configured)]
    : magiEndpointOrder()
  let lastError
  for (const url of endpoints) {
    try {
      const data = await queryEndpoint(url, query, variables, timeoutMs)
      if (data) return { data, endpoint: url }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Magi Network is unavailable')
}

/** Probe one Magi node with the lightweight localNodeInfo query. */
export async function probeMagiNode (url, timeoutMs = MAGI_PROBE_TIMEOUT_MS) {
  const endpoint = String(url || '').trim()
  if (!endpoint) return { url, ok: false, latency: Infinity, error: 'No node URL' }

  const started = Date.now()
  try {
    const data = await queryEndpoint(endpoint, NODE_QUERY, {}, timeoutMs)
    const info = data?.localNodeInfo
    const head = Number(info?.last_processed_block)
    const latency = Date.now() - started
    if (!info || !Number.isFinite(head) || head <= 0) {
      return { url: endpoint, ok: false, answered: true, latency, error: 'Invalid localNodeInfo' }
    }
    return {
      url: endpoint,
      ok: true,
      latency,
      head,
      version: info.running_version || null,
      versionId: info.version_id || null,
      gitCommit: info.git_commit || null,
      epoch: Number(info.epoch) || 0,
      consensusVersion: info.consensus_version_display || null,
      processingSuspended: Boolean(info.processing_suspended),
      consensusLine: info.active_consensus_line || null,
      consensusExecutor: info.active_consensus_executor || null
    }
  } catch (error) {
    return {
      url: endpoint,
      ok: false,
      latency: Date.now() - started,
      error: probeErrorMessage(error)
    }
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
    const { data, endpoint } = await queryMagi(LEDGER_QUERY, { account, limit: size })
    return {
      endpoint,
      balances: magiBalances(data.getAccountBalance),
      transactions: magiLedgerRows(data.findLedgerTXs)
    }
  }, { ttl: MAGI_TTL, force })
}

/** Resource credits, nonce, node mode and consensus stake for one account. */
export async function fetchMagiAccountDetails (name, { force = false } = {}) {
  const account = magiAccountName(name)
  if (!account) return null
  return loadCached('magi:details:' + account, async () => {
    const { data, endpoint } = await queryMagi(ACCOUNT_DETAILS_QUERY, { account })
    const rc = data.getAccountRC || null
    const nonce = data.getAccountNonce || null
    return {
      endpoint,
      account: rc?.account || account,
      rc: {
        amount: Number(rc?.amount) || 0,
        max: Number(rc?.max_rcs) || 0,
        blockHeight: Number(rc?.block_height) || 0
      },
      nonce: Number(nonce?.nonce) || 0,
      delegationMode: data.getNodeDelegationMode || '',
      witnessStake: magiAmount(data.witnessStake)
    }
  }, { ttl: MAGI_TTL, force })
}

/** Standard magi_token balances for one Hive account, keyed by contract ID. */
export async function fetchMagiTokens (name, { force = false } = {}) {
  const account = magiAccountName(name)
  if (!account) return null
  return loadCached('magi:tokens:' + account, async () => {
    const data = await queryEndpoint(MAGI_TOKEN_INDEXER, TOKENS_QUERY, { account })
    return {
      endpoint: MAGI_TOKEN_INDEXER,
      tokens: magiTokenRows(data?.magi_token_balances, data?.magi_token_overview)
    }
  }, { ttl: MAGI_TTL, force })
}

/** One delegator -> node consensus delegation edge, in HIVE. */
export async function fetchMagiDelegation (from, to, { force = false } = {}) {
  const delegator = magiAccountName(from)
  const node = magiAccountName(to)
  if (!delegator || !node) return null
  return loadCached('magi:delegation:' + delegator + ':' + node, async () => {
    const { data, endpoint } = await queryMagi(DELEGATION_QUERY, { from: delegator, to: node })
    const record = data.getConsensusDelegation
    if (!record) return null
    return {
      endpoint,
      from: record.from || delegator,
      to: record.to || node,
      delegated: magiAmount(record.delegated),
      claimable: magiAmount(record.claimable)
    }
  }, { ttl: MAGI_TTL, force })
}

/** Registered Magi witnesses at a Hive block height. */
export async function fetchMagiWitnesses (height, { endpoint = '', force = false } = {}) {
  const block = Number(height)
  if (!Number.isFinite(block) || block <= 0) return []
  return loadCached('magi:witnesses:' + block + ':' + endpoint, async () => {
    const { data } = await queryMagi(WITNESS_QUERY, { height: String(block) }, { endpoint })
    return (data.witnessNodes || []).map(row => ({
      account: row.account || '',
      height: Number(row.height) || 0,
      versionId: row.version_id || '',
      gitCommit: row.git_commit || '',
      netId: row.net_id || '',
      peerId: row.peer_id || '',
      protocolVersion: Number(row.protocol_version) || 0,
      enabled: Boolean(row.enabled),
      delegationMode: row.delegation_mode || '',
      ts: row.ts || '',
      txId: row.tx_id || ''
    }))
  }, { ttl: MAGI_TTL, force })
}

/** Read-only contract details, pending updates and recent outputs. */
export async function fetchMagiContract (id, { outputLimit = 25, force = false } = {}) {
  const contractId = String(id || '').trim()
  if (!contractId) return null
  const limit = Math.max(1, Math.min(100, Number(outputLimit) || 25))
  return loadCached('magi:contract:' + contractId + ':' + limit, async () => {
    const { data, endpoint } = await queryMagi(CONTRACT_QUERY, { id: contractId, outputLimit: limit })
    return {
      endpoint,
      contract: data.contract?.[0] || null,
      pending: data.pending || [],
      outputs: data.outputs || []
    }
  }, { ttl: MAGI_TTL, force })
}

/** Most recent contracts for the empty contract-viewer state. */
export async function fetchRecentMagiContracts (limit = 12, { force = false } = {}) {
  const size = Math.max(1, Math.min(50, Number(limit) || 12))
  return loadCached('magi:contracts:recent:' + size, async () => {
    const { data, endpoint } = await queryMagi(RECENT_CONTRACTS_QUERY, { limit: size })
    return {
      endpoint,
      contracts: data.findContract || []
    }
  }, { ttl: MAGI_TTL, force })
}

/** Read contract state for one or more string keys. */
export async function fetchMagiContractState (contractId, keys, { force = false } = {}) {
  const id = String(contractId || '').trim()
  const list = (Array.isArray(keys) ? keys : [keys]).map(key => String(key || '').trim()).filter(Boolean).slice(0, 100)
  if (!id || !list.length) return null
  return loadCached('magi:contract:state:' + id + ':' + list.join(','), async () => {
    const { data, endpoint } = await queryMagi(CONTRACT_STATE_QUERY, { id, keys: list })
    return { endpoint, keys: list, state: data.state || {} }
  }, { ttl: MAGI_TTL, force })
}

/**
 * Simulate a contract call without committing state. The node requires an
 * account authority even though nothing is signed; use the viewer account.
 */
export async function simulateMagiContractCall ({
  contractId,
  action,
  payload = '',
  rcLimit = 300,
  account = 'hive:vsc.dao',
  keyType = 'posting'
} = {}, { force = false } = {}) {
  const id = String(contractId || '').trim()
  const method = String(action || '').trim()
  const auth = magiAccountName(account)
  if (!id || !method || !auth) return null
  const cacheKey = 'magi:contract:sim:' + id + ':' + method + ':' + payload + ':' + auth
  return loadCached(cacheKey, async () => {
    const input = {
      tx_id: '',
      calls: [{
        contract_id: id,
        action: method,
        payload: String(payload || ''),
        rc_limit: Math.max(1, Number(rcLimit) || 300),
        intents: []
      }],
      ...(keyType === 'active'
        ? { required_auths: [auth] }
        : { required_posting_auths: [auth] })
    }
    const { data, endpoint } = await queryMagi(SIMULATE_CALL_QUERY, { input })
    return { endpoint, result: data.simulateContractCalls?.[0] || null }
  }, { ttl: 30000, force })
}
