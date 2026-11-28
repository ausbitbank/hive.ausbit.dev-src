// Reader-side Vault orchestration (banksia.vault@1).
//
// The pure functions here turn a public bulletin and a post's `banksia_vault`
// metadata into plaintext, or into a typed, UI-safe failure. Fetching is
// injectable so the whole path can be tested without a Hive node, and no
// decrypted text is ever returned when any check fails.
//
// Nothing in this module persists plaintext or keys. The Pinia store keeps the
// result in memory for the life of the page.

import { normalizeHostname, resolveBlogHost } from './blogHost'
import { fetchAccount as defaultFetchAccount, fetchPostContent } from './chainData'
import {
  VaultCryptoError,
  decryptPayload,
  openKeyring,
  readerKeyThumbprint,
  sha256Base64Url,
  sha256Hex,
  unwrapRingKey
} from './vaultCrypto'
import {
  buildBulletinSigningPayload,
  buildGrantHeader,
  canonicalJson,
  isGrantValid,
  parseBulletin
} from './vaultGrant'
import { decryptVaultParts } from './vaultPayload'
import {
  expandShardEntry,
  parseShard,
  shardHash,
  shardIndexForRkt,
  shardPermlink
} from './vaultBulletin'
import { hive } from './hive'
import { postingPublicKeys, verifyVaultPayloadForAccount } from './vaultSigning'
import { relayCertificateFromAccount, verifyDelegatedBulletin } from './vaultRelay'

export const DEFAULT_VAULT_CONTAINER = 'banksia-vault'
export const BULLETIN_CACHE_MS = 5 * 60 * 1000

const bulletinCache = new Map()

const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const PERIOD_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function normalizeBlog (value) {
  const blog = normalizeAccount(value)
  return HIVE_ACCOUNT_RE.test(blog) ? blog : ''
}

function cacheKey (blog) {
  return normalizeBlog(blog) || String(blog || '')
}

async function mapLimit (items, limit, run) {
  const list = Array.isArray(items) ? items : []
  const results = new Array(list.length)
  let cursor = 0
  async function worker () {
    while (cursor < list.length) {
      const index = cursor
      cursor += 1
      results[index] = await run(list[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), list.length) }, worker))
  return results
}

/** Drop the 5-minute bulletin cache for one blog, or for every blog. */
export function clearVaultBulletinCache (blog = null) {
  if (blog === null || blog === undefined) bulletinCache.clear()
  else bulletinCache.delete(cacheKey(blog))
}

async function defaultReplies (blog, container) {
  const replies = await hive.api.callAsync('condenser_api.get_content_replies', [blog, container])
  return Array.isArray(replies) ? replies : []
}

function parsePostBulletin (post, blog, pointer, { allowRelay = false } = {}) {
  if (!post || typeof post !== 'object') return null
  if (!post.author || !post.permlink) return null
  const author = normalizeAccount(post.author)
  if (pointer && normalizeAccount(pointer.author) !== blog) return null
  const bulletin = parseBulletin(post.json_metadata)
  if (!bulletin) return null
  if (normalizeBlog(bulletin.blog) !== blog) return null
  if (author === blog) {
    if (normalizeAccount(bulletin.signer) !== blog) return null
    return {
      bulletin,
      pointer: pointer || { author: post.author, permlink: post.permlink },
      delegated: false
    }
  }
  // A relay-authored comment is accepted only when it is self-consistent and
  // carries a delegation block. The certificate is verified later, before the
  // bulletin is used. Without explicit relay support the old v1 rule applies:
  // only the blog account may author a bulletin.
  if (!allowRelay) return null
  if (!HIVE_ACCOUNT_RE.test(author)) return null
  if (normalizeAccount(bulletin.signer) !== author) return null
  if (!isPlainObject(bulletin.delegation)) return null
  return {
    bulletin,
    pointer: { author: post.author, permlink: post.permlink },
    delegated: true
  }
}

function newestBulletin (candidates) {
  let best = null
  for (const candidate of candidates) {
    if (!candidate) continue
    if (!best) {
      best = candidate
      continue
    }
    const current = candidate.bulletin
    const previous = best.bulletin
    if (current.period !== previous.period) {
      if (current.period > previous.period) best = candidate
      continue
    }
    if (Number(current.seq) > Number(previous.seq)) best = candidate
  }
  return best
}

function readCache (blog, force) {
  if (force) return undefined
  const entry = bulletinCache.get(cacheKey(blog))
  if (!entry || entry.expires <= Date.now()) return undefined
  return entry.value
}

function writeCache (blog, value) {
  bulletinCache.set(cacheKey(blog), {
    expires: Date.now() + BULLETIN_CACHE_MS,
    value
  })
}

/**
 * Resolve the newest valid bulletin for a blog.
 *
 * The blog's `vault.bulletin` pointer wins when it resolves and parses; the
 * hidden container's replies (`vault-YYYY-MM-N`) are the fallback. Results are
 * cached for five minutes per blog unless `force` is set.
 *
 * @returns {Promise<{ bulletin: object, pointer: { author: string, permlink: string } }|null>}
 */
export async function resolveBulletin ({
  blog,
  settings = {},
  fetchPost = fetchPostContent,
  fetchReplies = defaultReplies,
  fetchAccount = defaultFetchAccount,
  verify = verifyVaultPayloadForAccount,
  allowRelay = false,
  force = false
} = {}) {
  const name = normalizeBlog(blog)
  if (!name) return null

  const cached = readCache(name, force)
  if (cached !== undefined) return cached

  const container = String(settings && settings.container || DEFAULT_VAULT_CONTAINER).trim().toLowerCase() || DEFAULT_VAULT_CONTAINER
  const pointer = settings && isPlainObject(settings.bulletin) ? settings.bulletin : null

  let resolved = null
  if (pointer && pointer.author && pointer.permlink) {
    try {
      const post = await fetchPost(pointer.author, pointer.permlink)
      resolved = parsePostBulletin(post, name, { author: pointer.author, permlink: pointer.permlink }, { allowRelay })
    } catch {
      resolved = null
    }
  }

  if (!resolved) {
    let replies
    try {
      replies = await fetchReplies(name, container)
    } catch {
      replies = []
    }
    const candidates = []
    for (const reply of Array.isArray(replies) ? replies : []) {
      const candidate = parsePostBulletin(reply, name, null, { allowRelay })
      if (candidate) candidates.push(candidate)
    }
    if (allowRelay) {
      // Choose the newest candidate whose signature/certificate actually
      // verifies. An invalid higher-sequence relay comment cannot shadow a
      // valid creator or delegated bulletin.
      const ordered = candidates.slice().sort((a, b) => {
        if (a.bulletin.period !== b.bulletin.period) return a.bulletin.period > b.bulletin.period ? -1 : 1
        return Number(b.bulletin.seq) - Number(a.bulletin.seq)
      })
      for (const candidate of ordered) {
        const checked = await verifyBulletin({
          bulletin: candidate.bulletin,
          fetchAccount,
          verify,
          allowDelegation: true
        })
        if (checked.ok) {
          resolved = candidate
          break
        }
      }
    } else {
      resolved = newestBulletin(candidates)
    }
  }

  writeCache(name, resolved)
  return resolved
}

/**
 * Verify a bulletin signature against the signer's Hive posting authority.
 *
 * Beta is self-signed only: a delegated bulletin returns
 * `delegation-unsupported` rather than being trusted.
 *
 * `verify` is injectable for tests and defaults to the real posting-key
 * verifier. It receives the exact canonical payload.
 */
export async function verifyBulletin ({
  bulletin,
  fetchAccount = defaultFetchAccount,
  verify = verifyVaultPayloadForAccount,
  allowDelegation = false,
  now = Date.now()
} = {}) {
  if (!isPlainObject(bulletin)) return { ok: false, reason: 'bulletin' }
  const blog = normalizeBlog(bulletin.blog)
  if (!blog) return { ok: false, reason: 'bulletin' }
  if (!PERIOD_RE.test(String(bulletin.period || ''))) return { ok: false, reason: 'bulletin' }
  if (!isPlainObject(bulletin.keyring)) return { ok: false, reason: 'bulletin' }
  const hasParts = Array.isArray(bulletin.parts) && bulletin.parts.length > 0
  const hasShards = bulletin.v === 2 && Array.isArray(bulletin.shards) && bulletin.shards.length > 0
  if ((!Array.isArray(bulletin.entries) || bulletin.entries.length === 0) && !hasParts && !hasShards) {
    return { ok: false, reason: 'bulletin' }
  }
  if (typeof bulletin.sig !== 'string' || !bulletin.sig.trim()) {
    return { ok: false, reason: 'missing-sig' }
  }
  const delegated = bulletin.delegation !== null && bulletin.delegation !== undefined
  if (delegated && !allowDelegation) {
    return { ok: false, reason: 'delegation-unsupported' }
  }

  const signer = normalizeAccount(bulletin.signer || blog)
  if (!HIVE_ACCOUNT_RE.test(signer)) return { ok: false, reason: 'bulletin' }

  let account
  let creatorAccount
  if (delegated) {
    if (!isPlainObject(bulletin.delegation)) return { ok: false, reason: 'delegation' }
    try {
      [creatorAccount, account] = await Promise.all([fetchAccount(blog), fetchAccount(signer)])
    } catch {
      creatorAccount = null
      account = null
    }
    if (!creatorAccount || !account) return { ok: false, reason: 'account' }
    const certificate = relayCertificateFromAccount(creatorAccount)
    if (!certificate) return { ok: false, reason: 'delegation' }
    const result = await verifyDelegatedBulletin({
      bulletin,
      certificate,
      certHash: bulletin.delegation.certHash,
      creatorAccount,
      relayAccount: account,
      now,
      verify
    })
    return result.ok ? { ok: true, reason: '' } : { ok: false, reason: result.reason || 'signature' }
  }

  // Self-sovereign v1: the bulletin must be authored and signed by the blog
  // account itself. A non-null delegation is a separate, certificate-gated path.
  if (signer !== blog) return { ok: false, reason: 'signer' }
  try {
    account = await fetchAccount(signer)
  } catch {
    account = null
  }
  if (!account) return { ok: false, reason: 'account' }

  let payload
  try {
    payload = await buildBulletinSigningPayload(bulletin)
  } catch {
    return { ok: false, reason: 'bulletin' }
  }

  const publicKeys = postingPublicKeys(account)
  let ok
  try {
    ok = Boolean(await verify({
      payload,
      signature: bulletin.sig,
      account,
      publicKeys
    }))
  } catch {
    ok = false
  }
  return ok ? { ok: true, reason: '' } : { ok: false, reason: 'signature' }
}

/** The entry wrapped to this reader key, or null. */
export async function findGrantEntry ({ bulletin, readerPublicKey } = {}) {
  if (!bulletin || !Array.isArray(bulletin.entries)) return null
  let rkt
  try {
    rkt = await readerKeyThumbprint(readerPublicKey)
  } catch {
    return null
  }
  return bulletin.entries.find(entry =>
    entry &&
    typeof entry.rkt === 'string' &&
    entry.rkt.toLowerCase() === rkt
  ) || null
}

/**
 * Fetch the companion-comment payloads for a large post.
 *
 * Companions are normal comments under the post carrying
 * `json_metadata.banksia_vault_payload`. Returns null if any part is missing or
 * malformed; the caller stays locked rather than rendering a partial payload.
 */
export async function loadVaultParts ({
  blog,
  metadata,
  fetchPost = fetchPostContent
} = {}) {
  const name = normalizeBlog(blog)
  const permlinks = metadata && Array.isArray(metadata.parts) ? metadata.parts : null
  if (!name || !permlinks || !permlinks.length) return null

  const parts = []
  const seen = new Set()
  for (let index = 0; index < permlinks.length; index++) {
    const permlink = permlinks[index]
    if (typeof permlink !== 'string' || !permlink || seen.has(permlink)) return null
    seen.add(permlink)
    let post
    try {
      post = await fetchPost(name, permlink)
    } catch {
      return null
    }
    if (!post) return null
    if (post.author && String(post.author).toLowerCase() !== name) return null
    let root = post.json_metadata
    if (typeof root === 'string') {
      try {
        root = JSON.parse(root)
      } catch {
        return null
      }
    }
    if (!isPlainObject(root)) return null
    const part = isPlainObject(root.banksia_vault_payload) ? root.banksia_vault_payload : root
    if (!isPlainObject(part) || typeof part.iv !== 'string' || typeof part.ct !== 'string') return null
    if (part.part !== undefined && Number(part.part) !== index + 1) return null
    if (part.parts !== undefined && Number(part.parts) !== permlinks.length) return null
    parts.push(part)
  }
  return parts
}

function fail (code) {
  return { ok: false, code, message: vaultStatusMessage(code) }
}

function errorCode (error) {
  if (!(error instanceof VaultCryptoError)) return 'tampered'
  switch (error.code) {
    case 'VAULT_TAG':
    case 'VAULT_HASH':
      return 'tampered'
    case 'VAULT_BAD_KEY':
      return 'wrong-key'
    case 'VAULT_BAD_INPUT':
    case 'VAULT_UNAVAILABLE':
      return 'unsupported'
    default:
      return 'tampered'
  }
}

/**
 * Decrypt a post for a reader who already has a grant entry.
 *
 * Expiry, blog and period are checked before any crypto. A failure never
 * returns partial plaintext.
 *
 * @returns {Promise<{ ok: true, plaintext: string, period: string, expires: string, reader: object }|{ ok: false, code: string, message: string }>}
 */
export async function unlockWithGrant ({
  bulletin,
  entry,
  readerKey,
  metadata,
  parts = null,
  blog,
  permlink,
  now = Date.now()
} = {}) {
  if (!isPlainObject(bulletin)) return fail('bulletin')
  if (!isPlainObject(entry)) return fail('no-entry')
  if (!isPlainObject(metadata)) return fail('unsupported')

  const blogName = normalizeBlog(blog) || normalizeBlog(bulletin.blog)
  if (!blogName) return fail('bulletin')
  if (normalizeBlog(bulletin.blog) !== blogName) return fail('bulletin')
  if (typeof permlink !== 'string' || !permlink) return fail('bulletin')

  const period = String(bulletin.period || '')
  if (!PERIOD_RE.test(period)) return fail('bulletin')

  // Check entitlement before touching the wrapped key. Bulletin entries carry
  // only `rkt`/`expires`; the blog and period come from the signed bulletin.
  if (!isGrantValid({ ...entry, blog: blogName, period }, { blog: blogName, period, rkt: entry.rkt, now })) {
    return fail('expired')
  }

  const privateKey = readerKey && (readerKey.privateKey || readerKey)
  const publicKey = readerKey && (readerKey.publicKeyB64 || readerKey.publicKey)
  if (!privateKey) return fail('wrong-key')

  try {
    const tier = entry.tier || metadata.tier || 'member'
    const header = buildGrantHeader(entry, { blog: blogName, period, tier })
    const ringKey = await unwrapRingKey(entry, privateKey, header, publicKey || null)
    const keyring = await openKeyring(bulletin.keyring, ringKey, { blog: blogName, period })
    const contentKey = keyring[metadata.kid]
    if (typeof contentKey !== 'string' || !contentKey) return fail('wrong-key')

    const contentHeader = {
      blog: blogName,
      permlink,
      kid: metadata.kid,
      mode: metadata.mode
    }
    const plaintext = Array.isArray(parts) && parts.length
      ? await decryptVaultParts(parts, contentKey, contentHeader)
      : await decryptPayload(metadata, contentKey, contentHeader)

    // A multi-part post must supply exactly the parts named in metadata; a
    // missing or substituted part is a tamper signal, not a partial read.
    if (Array.isArray(parts) && parts.length && Array.isArray(metadata.parts) &&
      parts.length !== metadata.parts.length) {
      return fail('tampered')
    }

    // The post-level byte count and hash cover the whole plaintext, including
    // every companion part.
    if (Number.isInteger(metadata.bytes) && metadata.bytes >= 0) {
      const actualBytes = new TextEncoder().encode(plaintext).length
      if (actualBytes !== metadata.bytes) return fail('tampered')
    }
    if (typeof metadata.hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(metadata.hash)) {
      const actual = await sha256Hex(plaintext)
      if (actual !== metadata.hash.slice('sha256:'.length)) return fail('tampered')
    } else if (typeof metadata.hash === 'string' && /^[A-Za-z0-9_-]{43}$/.test(metadata.hash)) {
      const actual = await sha256Base64Url(plaintext)
      if (actual !== metadata.hash) return fail('tampered')
    }

    return {
      ok: true,
      plaintext,
      period,
      expires: entry.expires,
      reader: {
        rkt: entry.rkt,
        tier
      }
    }
  } catch (error) {
    return fail(errorCode(error))
  }
}

/**
 * Fetch and verify a multi-part bulletin's parts and merge their entries.
 *
 * The signed manifest carries `parts: [{permlink, hash, entries}]`. Each part is
 * a comment under the container with `banksia_vault_bulletin_part`; its canonical
 * JSON hash MUST match the manifest. Returns null on any missing/tampered part.
 */
export async function loadBulletinParts ({
  bulletin,
  fetchPost = fetchPostContent
} = {}) {
  if (!isPlainObject(bulletin)) return null
  if (!Array.isArray(bulletin.parts) || bulletin.parts.length === 0) return bulletin
  const blog = normalizeBlog(bulletin.blog)
  if (!blog) return null
  const entries = []
  for (let index = 0; index < bulletin.parts.length; index++) {
    const descriptor = bulletin.parts[index]
    if (!isPlainObject(descriptor) || typeof descriptor.permlink !== 'string') return null
    let post
    try {
      post = await fetchPost(blog, descriptor.permlink)
    } catch {
      return null
    }
    if (!post || String(post.author || '').toLowerCase() !== blog) return null
    let root = post.json_metadata
    if (typeof root === 'string') {
      try { root = JSON.parse(root) } catch { return null }
    }
    if (!isPlainObject(root)) return null
    const part = isPlainObject(root.banksia_vault_bulletin_part) ? root.banksia_vault_bulletin_part : root
    if (!isPlainObject(part)) return null
    if (part.v !== 1 || normalizeBlog(part.blog) !== blog) return null
    if (part.period !== bulletin.period || Number(part.seq) !== Number(bulletin.seq)) return null
    if (Number(part.part) !== index + 1 || Number(part.parts) !== bulletin.parts.length) return null
    if (!Array.isArray(part.entries)) return null
    const actual = 'sha256:' + await sha256Hex(canonicalJson(part))
    if (actual !== descriptor.hash) return null
    entries.push(...part.entries)
  }
  return { ...bulletin, entries }
}

/**
 * Load the grant entries for a v1 part bulletin or a v2 sharded bulletin.
 *
 * With a reader thumbprint and `all: false`, a v2 bulletin fetches only the
 * shard that can contain that reader. The creator dashboard passes `all: true`
 * to merge every shard for display and comparison.
 *
 * Every shard is content-hashed by the signed manifest before any entry is
 * used. Returns null on a missing, wrong-author or tampered shard.
 */
export async function loadBulletinEntries ({
  bulletin,
  readerRkt = '',
  readerRkts = [],
  all = false,
  fetchPost = fetchPostContent
} = {}) {
  if (!isPlainObject(bulletin)) return null
  if (bulletin.v !== 2) {
    const merged = await loadBulletinParts({ bulletin, fetchPost })
    if (!merged) return null
    return { ...merged, entries: Array.isArray(merged.entries) ? merged.entries : [], shards: [] }
  }

  const blog = normalizeBlog(bulletin.blog)
  const shardAuthor = normalizeBlog(bulletin.signer || blog)
  const period = String(bulletin.period || '')
  const count = Number(bulletin.shardCount)
  if (!blog || !shardAuthor || !PERIOD_RE.test(period) || !Number.isInteger(count) || count < 1) return null
  if (!Array.isArray(bulletin.shards)) return null

  const rkts = Array.isArray(readerRkts) && readerRkts.length
    ? readerRkts
    : (readerRkt ? [readerRkt] : [])
  const indexes = new Set(
    rkts.map(rkt => shardIndexForRkt(rkt, count)).filter(index => index >= 0)
  )
  const wanted = all
    ? bulletin.shards
    : bulletin.shards.filter(descriptor => indexes.has(descriptor[0]))
  const fetched = await mapLimit(wanted, 6, async descriptor => {
    const index = Number(descriptor[0])
    const rev = Number(descriptor[1])
    const hash = descriptor[2]
    const permlink = shardPermlink(period, index, rev)
    if (!permlink) return null
    let post
    try {
      post = await fetchPost(shardAuthor, permlink)
    } catch {
      return null
    }
    if (!post) return null
    if (String(post.author || '').toLowerCase() !== shardAuthor) return null
    const shard = parseShard(post.json_metadata)
    if (!shard) return null
    if (shard.blog !== blog || shard.period !== period || shard.shard !== index || shard.rev !== rev) return null
    if (await shardHash(shard) !== hash) return null
    const expanded = shard.entries.map(expandShardEntry)
    if (expanded.some(entry => !entry)) return null
    return { index, rev, hash, permlink, entries: shard.entries, expanded }
  })
  if (fetched.some(item => !item)) return null
  const shards = fetched
  const entries = fetched.flatMap(shard => shard.expanded)
  return { ...bulletin, entries, shards }
}

/** Visible watermark for unlocked content: `Licensed to @reader · YYYY-MM`. */export function watermarkLabel (account, period) {
  const name = normalizeAccount(account)
  const label = name ? 'Licensed to @' + name : 'Licensed to member'
  return period ? label + ' · ' + String(period) : label
}

/**
 * Append the watermark to the rendered Markdown source without parsing or
 * rewriting the author's HTML.
 */
export function watermarkText (plaintext, label) {
  const text = typeof plaintext === 'string' ? plaintext : ''
  const watermark = typeof label === 'string' ? label.trim() : ''
  if (!watermark) return text
  const safe = watermark
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return text + '\n\n<p class="banksia-watermark">' + safe + '</p>'
}

/**
 * The exact, safe UI copy for a failure. No plaintext, error details, stack
 * traces or account data beyond what the reader already knows.
 */
export function vaultStatusMessage (code) {
  switch (code) {
    case 'no-key':
      return 'Subscribe to read the rest of this post.'
    case 'payment-pending':
    case 'no-entry':
      return 'Payment received — unlocking…'
    case 'device-pending':
      return 'Waiting for the creator to grant this device.'
    case 'expired':
      return 'Your membership ended. Renew to keep reading.'
    case 'bulletin':
      return 'Could not verify your membership. Try again.'
    case 'offline':
      return 'You appear to be offline. Reconnect and try again.'
    case 'signature':
      return 'This grant could not be verified.'
    case 'tampered':
      return 'This content could not be unlocked.'
    case 'wrong-key':
      return 'This reader key cannot unlock this post. Use the device you subscribed with, or restore access.'
    case 'unsupported':
      return 'This browser cannot unlock Vault.'
    case 'no-plan':
      return 'The membership plan could not be loaded. Try again later.'
    case 'unlocked':
      return 'Members-only content unlocked.'
    case 'locked':
    default:
      return 'This content is for members.'
  }
}

/**
 * True when the current host is read-only for Vault and must deep-link to the
 * apex.
 *
 * Blog hosts (`<account>.banksia.io`, `<account>.localhost`) and custom domains
 * never hold a reader key or sign a device registration. Decryption belongs to
 * the apex, where the reader's key and Hive session already live.
 */
export function requiresApex (blogHost = null) {
  const raw = blogHost !== null && blogHost !== undefined
    ? blogHost
    : (typeof window !== 'undefined' && window.location ? window.location.hostname : '')
  const host = normalizeHostname(raw)
  if (!host) return false
  const resolved = resolveBlogHost(host)
  if (resolved.mode === 'blog' || resolved.mode === 'unsupported') return true
  // Unknown hosts are custom domains; only the known apex aliases are read-write.
  return resolved.reason === 'unknown-host'
}

/**
 * Whether a stored reader key may auto-unlock a post for this visitor.
 *
 * Keys are scoped per origin and Hive account, but a shared browser must still
 * not keep a member's content open after they log out. Auto-unlock therefore
 * requires a signed-in reader account, and if the key records its owner the
 * accounts must match. A logged-out reader can still use the explicit
 * "Restore access" action, which is a deliberate local request.
 */
export function mayAutoUnlock ({ readerAccount = '', keyAccount = '' } = {}) {
  const reader = normalizeAccount(readerAccount)
  if (!reader) return false
  const owner = normalizeAccount(keyAccount)
  if (owner && owner !== reader) return false
  return true
}
