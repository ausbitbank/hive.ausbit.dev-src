// Signing, key and memo helpers backed by hive-tx.
//
// hive-tx is imported lazily: the signing stack is only needed when a user
// actually signs or broadcasts something, so it should not be part of the
// initial shell. The read path stays on `src/services/api.js`.

import { DEFAULT_API_TIMEOUT_MS } from './api'
import { HIVE_API_NODES } from './hiveNodes'

let activeNode = null
let hiveTxPromise = null
let hiveTx = null

function applyConfig (mod) {
  mod.config.nodes = activeNode
    ? [activeNode, ...HIVE_API_NODES.filter(node => node !== activeNode)]
    : [...HIVE_API_NODES]
  mod.config.timeout = DEFAULT_API_TIMEOUT_MS
  // The default (8) makes a failed write take far too long to surface.
  mod.config.retry = 2
}

export function setHiveTxNode (node) {
  activeNode = node || null
  if (hiveTx) applyConfig(hiveTx)
}

// hive-tx expects a global Buffer. Install the polyfill in this lazy chunk
// rather than injecting it into the initial shell on every page.
let bufferPromise = null
async function ensureBuffer () {
  if (typeof globalThis.Buffer !== 'undefined') return
  const { Buffer } = await (bufferPromise ||= import('buffer'))
  globalThis.Buffer = Buffer
}

async function getHiveTx () {
  if (!hiveTx) {
    await ensureBuffer()
    hiveTx = await (hiveTxPromise ||= import('hive-tx'))
    applyConfig(hiveTx)
  }
  return hiveTx
}

// hive-tx requires these `extensions` arrays. hive-js used to default them,
// so queue builders that predate this migration may omit them.
const EXTENSION_OPERATIONS = new Set([
  'comment_options',
  'recurrent_transfer',
  'account_update2',
  'update_proposal_votes',
  'claim_account',
  'create_proposal',
  'update_proposal',
  'remove_proposal',
  'create_claimed_account',
  'witness_set_properties'
])

// hive-tx's DateSerializer appends "Z" to every date string. A value that
// already ends in Z becomes `...ZZ` (Invalid Date), which serialises as 0.
function chainDate (value) {
  return typeof value === 'string' && value.endsWith('Z') ? value.slice(0, -1) : value
}

export function normalizeOperation ([name, body]) {
  if (!body || typeof body !== 'object') return [name, body]

  const next = { ...body }
  if (EXTENSION_OPERATIONS.has(name) && !Array.isArray(next.extensions)) {
    next.extensions = []
  }
  if (name === 'limit_order_create' || name === 'limit_order_create2') {
    next.expiration = chainDate(next.expiration)
  }
  if (name === 'escrow_transfer') {
    next.ratification_deadline = chainDate(next.ratification_deadline)
    next.escrow_expiration = chainDate(next.escrow_expiration)
  }
  if (name === 'create_proposal' || name === 'update_proposal') {
    next.start_date = chainDate(next.start_date)
    next.end_date = chainDate(next.end_date)
  }
  return [name, next]
}

/**
 * Build, sign and broadcast one transaction.
 *
 * `operations` use the queue's `[name, body]` shape. `wif` is the key for the
 * requested authority. Returns hive-tx's `{ tx_id, status }` result.
 */
export async function broadcastOperations (operations, wif) {
  const { Transaction, PrivateKey } = await getHiveTx()
  const tx = new Transaction()
  for (const operation of operations) {
    const [name, body] = normalizeOperation(operation)
    await tx.addOperation(name, body)
  }
  tx.sign(PrivateKey.from(wif))
  return tx.broadcast()
}

/**
 * Sign arbitrary data the way Hive Keychain's `requestSignBuffer` does:
 * SHA-256 of the bytes, then a recoverable signature in 130-char hex.
 */
export async function signBufferData (data, wif) {
  const { PrivateKey, utils } = await getHiveTx()
  const key = PrivateKey.from(wif)
  if (typeof data === 'string') {
    return utils.signMessage(data, key)
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 is not available in this environment.')
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
  return key.sign(hash).customToString()
}

export async function toPublicKey (wif) {
  const { PrivateKey } = await getHiveTx()
  return PrivateKey.from(wif).createPublic().toString()
}

export async function isValidWif (wif) {
  const { utils } = await getHiveTx()
  return utils.isValidWif(wif)
}

export async function wifMatchesPublicKey (wif, publicKey) {
  return (await toPublicKey(wif)) === publicKey
}

export async function encodeMemo (wif, receiverPublicKey, memo) {
  const { Memo } = await getHiveTx()
  return Memo.encode(wif, receiverPublicKey, memo)
}

export async function createPassword () {
  const { utils } = await getHiveTx()
  return utils.createPassword()
}

export async function generateKeys (username, password) {
  const { utils } = await getHiveTx()
  return utils.generateKeys(username, password)
}
