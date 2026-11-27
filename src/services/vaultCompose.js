// Banksia Vault — composer-side pure logic (banksia.vault@1).
//
// The composer stores the whole draft locally, splits it into a public teaser
// and a members-only payload, encrypts the payload on publish, and decides
// whether the ciphertext travels inline in `json_metadata.banksia_vault` or in
// companion comments. Everything here is pure and unit-testable; the page keeps
// the UI state, the passphrase and the unlocked vault session.
//
// This module never persists plaintext, keys or the passphrase.

import {
  INLINE_CIPHERTEXT_MAX,
  VAULT_MARKER,
  buildVaultMetadata,
  chooseVaultTransport,
  chunkVaultPayload,
  estimateCiphertextLength,
  joinVaultBody,
  splitVaultBody
} from './vaultPayload'
import { encryptPayload, sha256Hex } from './vaultCrypto'
import { creatorContentKey, currentVaultKid } from './vaultSession'

const MODES = new Set(['section', 'post'])
const PAYWALL_BODY_MAX = 240
const PAYWALL_BENEFITS_MAX = 6
const PAYWALL_BENEFIT_MAX = 80
const PAYWALL_TITLE = 'Members-only'
const CHUNK_SIZE = 28000
const PERIOD_RE = /^\d{4}-\d{2}$/
const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const IMAGE_MARKDOWN_RE = /!\[[^\]]*\]\(\s*(?:<)?(?:https?:\/\/|\/)[^)\s>]+/i
const IMAGE_HTML_RE = /<img\b[^>]*\bsrc\s*=\s*["']?(?:https?:\/\/|\/)/i

function asString (value) {
  return typeof value === 'string' ? value : (value === undefined || value === null ? '' : String(value))
}

function clampText (value, max) {
  const text = asString(value).trim()
  if (text.length <= max) return text
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…'
}

function utf8ByteLength (value) {
  try {
    return new TextEncoder().encode(String(value)).length
  } catch {
    return String(value).length
  }
}

function normalizeAccount (value) {
  return asString(value).trim().replace(/^@/, '').toLowerCase()
}

function accountFromSettings (settings) {
  const source = settings && typeof settings === 'object' ? settings : {}
  const explicit = normalizeAccount(source.account)
  if (ACCOUNT_RE.test(explicit)) return explicit
  const product = asString(source.product).trim().toLowerCase()
  if (product.includes('/')) {
    const author = normalizeAccount(product.split('/')[0])
    if (ACCOUNT_RE.test(author)) return author
  }
  return ''
}

function normalizeMode (value) {
  return MODES.has(value) ? value : 'section'
}

/**
 * Coerce a draft's `vault` object into `{ enabled, mode }`.
 *
 * Off by default, section mode by default. Unknown fields are dropped so the
 * local draft never accumulates stale security state.
 */
export function normalizeVaultDraft (value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    enabled: source.enabled === true,
    mode: normalizeMode(source.mode)
  }
}

/** Character index of the first lock marker, or -1. */
export function vaultMarkerIndex (body) {
  return asString(body).indexOf(VAULT_MARKER)
}

/** True when the raw body contains a lock marker. */
export function hasVaultMarker (body) {
  return vaultMarkerIndex(body) !== -1
}

/**
 * Resolve the public/premium split for the composer.
 *
 * Section mode follows the marker exactly. Whole-post mode encrypts the whole
 * body when there is no marker; with a marker, the text before it is a public
 * teaser and the text after it is locked. Slices are raw so the caller can
 * rebuild the published body deterministically.
 */
export function vaultDraftSplit ({ body = '', mode = 'section' } = {}) {
  const normalizedMode = normalizeMode(mode)
  if (normalizedMode === 'section') {
    const split = splitVaultBody(body, 'section')
    return {
      publicBody: split.publicBody,
      premiumBody: split.premiumBody,
      hasMarker: split.hasMarker
    }
  }

  const index = vaultMarkerIndex(body)
  if (index === -1) {
    return { publicBody: '', premiumBody: asString(body), hasMarker: false }
  }
  const source = asString(body)
  return {
    publicBody: source.slice(0, index),
    premiumBody: source.slice(index + VAULT_MARKER.length),
    hasMarker: true
  }
}

/**
 * Generic, honest, text-only paywall copy for a premium post.
 *
 * The price is a display hint; the on-chain product post remains the payment
 * source of truth. Benefits avoid promises about encrypted media or instant
 * revocation.
 */
export function buildVaultPaywall (settings) {
  const source = settings && typeof settings === 'object' ? settings : {}
  const account = accountFromSettings(source)
  const who = account ? '@' + account : 'this blog'
  const body = clampText(
    'Members of ' + who + ' get every members-only post and the full archive while subscribed.',
    PAYWALL_BODY_MAX
  )

  const benefits = []
  if (source.archive === 'all') benefits.push('Full archive of members-only posts')
  else benefits.push('New members-only posts while subscribed')
  if (source.watermark) benefits.push('Watermarked copy for each member')
  if (typeof source.price === 'string' && source.price.trim()) {
    benefits.push(source.price.trim() + ' per month, cancel anytime')
  }
  benefits.push('Read in your browser with keys you hold')
  benefits.push('Cancel anytime with a Hive recurring transfer')

  const unique = [...new Set(benefits.map(item => clampText(item, PAYWALL_BENEFIT_MAX)).filter(Boolean))]
  return {
    title: PAYWALL_TITLE,
    body,
    benefits: unique.slice(0, PAYWALL_BENEFITS_MAX)
  }
}

/**
 * Describe the payload size and transport for the composer meter.
 *
 * `plaintext` may be a string or a byte count; `ciphertext` may be a
 * ciphertext string, a character count, or omitted to use the estimate.
 */
export function describeVaultSize ({ plaintext = '', ciphertext = '' } = {}) {
  const plaintextBytes = typeof plaintext === 'number'
    ? Math.max(0, Math.trunc(plaintext))
    : utf8ByteLength(plaintext)
  const estimatedChars = estimateCiphertextLength(plaintextBytes)
  const ciphertextChars = typeof ciphertext === 'number'
    ? Math.max(0, Math.trunc(ciphertext))
    : asString(ciphertext).length || estimatedChars

  const transport = chooseVaultTransport(plaintextBytes)
  if (plaintextBytes === 0) {
    return {
      plaintextBytes,
      ciphertextChars: 0,
      transport: 'inline',
      message: 'No members-only content yet.',
      tone: 'ok'
    }
  }
  if (transport === 'inline') {
    return {
      plaintextBytes,
      ciphertextChars,
      transport,
      message: plaintextBytes + ' bytes of members-only text · about ' + ciphertextChars +
        ' ciphertext characters, fits inside the post.',
      tone: 'ok'
    }
  }
  if (transport === 'comment') {
    return {
      plaintextBytes,
      ciphertextChars,
      transport,
      message: plaintextBytes + ' bytes of members-only text · above the inline budget, so it travels as companion comments.',
      tone: 'warn'
    }
  }
  return {
    plaintextBytes,
    ciphertextChars,
    transport: 'too-large',
    message: plaintextBytes + ' bytes of members-only text · over the 90,000-byte limit. Split the post or shorten the locked section.',
    tone: 'error'
  }
}

/** True when members-only text embeds an image URL, which stays public. */
export function premiumMediaWarning (text) {
  const source = asString(text)
  if (!source) return false
  return IMAGE_MARKDOWN_RE.test(source) || IMAGE_HTML_RE.test(source)
}

function resolveKid (draft, now) {
  const override = draft && draft.vault && draft.vault.kid
  if (typeof override === 'string' && PERIOD_RE.test(override.trim())) return override.trim()
  return currentVaultKid(now)
}

/**
 * Encrypt the members-only payload and build the post metadata.
 *
 * @returns {Promise<{
 *   publicBody: string,
 *   vaultMetadata: object,
 *   companions: Array<[string, object]>,
 *   plaintextBytes: number,
 *   ciphertextChars: number,
 *   transport: 'inline'|'comment',
 *   premiumBody: string
 * }>}
 */
export async function prepareVaultPublish ({ account, permlink, draft, vault, settings, now = new Date() } = {}) {
  const blog = normalizeAccount(account)
  if (!ACCOUNT_RE.test(blog)) throw new Error('A valid Hive account is required to publish members-only content.')
  const postPermlink = asString(permlink).trim()
  if (!postPermlink) throw new Error('A permlink is required to encrypt members-only content.')

  if (!settings || settings.enabled !== true) {
    throw new Error('Vault is not enabled for this blog. Set it up in Settings → Blog before publishing.')
  }
  if (typeof settings.product !== 'string' || !settings.product.trim()) {
    throw new Error('Choose a membership product in Settings → Blog before publishing.')
  }
  const productAuthor = normalizeAccount(settings.product.split('/')[0])
  if (productAuthor && productAuthor !== blog) {
    throw new Error('The membership product must belong to @' + blog + '.')
  }
  if (!vault || typeof vault !== 'object') {
    throw new Error('Unlock your vault before publishing members-only content.')
  }
  if (vault.account && normalizeAccount(vault.account) !== blog) {
    throw new Error('The unlocked vault belongs to @' + normalizeAccount(vault.account) + ', not @' + blog + '.')
  }

  const kid = resolveKid(draft, now)
  const key = creatorContentKey(vault, kid)
  if (!key) {
    throw new Error('The unlocked vault has no content key for ' + kid + '. Rotate the vault period or unlock the right vault.')
  }

  const vaultDraft = normalizeVaultDraft(draft && draft.vault)
  const split = vaultDraftSplit({ body: draft && draft.body, mode: vaultDraft.mode })
  const premiumBody = split.premiumBody
  if (!premiumBody.trim()) throw new Error('Add members-only content after the lock marker.')

  const plaintextBytes = utf8ByteLength(premiumBody)
  if (chooseVaultTransport(plaintextBytes) === 'too-large') {
    throw new Error('Members-only content is ' + plaintextBytes + ' bytes; the companion-comment limit is 90,000 bytes. Split the post or shorten the locked section.')
  }

  const publicBody = vaultDraft.mode === 'section'
    ? joinVaultBody(split.publicBody, 'section')
    : split.publicBody

  const header = { blog, permlink: postPermlink, kid, mode: vaultDraft.mode }
  const encrypted = await encryptPayload(premiumBody, key, header)
  const paywall = buildVaultPaywall({ ...settings, account: blog })
  const baseMetadata = {
    mode: vaultDraft.mode,
    kid,
    hash: encrypted.hash,
    bytes: encrypted.bytes,
    tier: 'member',
    paywall,
    price: typeof settings.price === 'string' && settings.price.trim() ? settings.price.trim() : undefined,
    product: settings.product.trim(),
    container: typeof settings.container === 'string' && settings.container.trim() ? settings.container.trim() : undefined
  }

  if (encrypted.ct.length <= INLINE_CIPHERTEXT_MAX) {
    return {
      publicBody,
      vaultMetadata: buildVaultMetadata({
        ...baseMetadata,
        iv: encrypted.iv,
        ct: encrypted.ct
      }),
      companions: [],
      plaintextBytes: encrypted.bytes,
      ciphertextChars: encrypted.ct.length,
      transport: 'inline',
      premiumBody
    }
  }

  const chunks = await chunkVaultPayload(premiumBody, key, header, { chunkSize: CHUNK_SIZE })
  // Hive permlinks are unique per author, so companion parts are namespaced by
  // the post permlink. A bare `vault-payload-1` would collide across posts.
  const namespace = postPermlink.slice(0, 220)
  const parts = chunks.map((chunk, index) => namespace + '-vault-' + (index + 1))
  const companions = chunks.map((chunk, index) => ['comment', {
    parent_author: blog,
    parent_permlink: postPermlink,
    author: blog,
    permlink: parts[index],
    title: '',
    body: '',
    json_metadata: JSON.stringify({
      app: 'banksia.io',
      banksia_vault_payload: chunk
    })
  }])

  return {
    publicBody,
    vaultMetadata: buildVaultMetadata({
      ...baseMetadata,
      parts
    }),
    companions,
    plaintextBytes: encrypted.bytes,
    ciphertextChars: chunks.reduce((total, chunk) => total + chunk.ct.length, 0),
    transport: 'comment',
    premiumBody
  }
}

async function premiumUnchanged (draft, previous, vaultDraft, split) {
  if (!previous || previous.mode !== vaultDraft.mode) return false
  const requestedKid = draft && draft.vault && typeof draft.vault.kid === 'string'
    ? draft.vault.kid.trim()
    : ''
  if (PERIOD_RE.test(requestedKid) && previous.kid !== requestedKid) return false
  // An edit loads only the published body. For whole-post mode with no marker
  // that body is the public teaser, not a new premium payload, so preserve the
  // previous ciphertext instead of re-encrypting the teaser.
  if (draft && draft.editing && vaultDraft.mode === 'post' && !split.hasMarker) return true
  if (!split.premiumBody.trim()) return true
  const digest = 'sha256:' + await sha256Hex(split.premiumBody)
  return digest === previous.hash
}

/**
 * Decide the `banksia_vault` block for an edit.
 *
 * Returns the previous metadata object when the premium payload is unchanged,
 * `null` when Vault is switched off, and the new metadata after re-encrypting
 * when the premium text changed. Pass `withDetails: true` to receive the full
 * prepare result (public body and companion comments) for the publish flow.
 */
export async function vaultMetadataForEdit ({
  draft,
  previousMetadata,
  vault,
  settings,
  account,
  permlink,
  now = new Date(),
  withDetails = false
} = {}) {
  const vaultDraft = normalizeVaultDraft(draft && draft.vault)
  if (!vaultDraft.enabled) return null

  const previous = previousMetadata &&
    typeof previousMetadata === 'object' &&
    previousMetadata.banksia_vault &&
    typeof previousMetadata.banksia_vault === 'object'
    ? previousMetadata.banksia_vault
    : null

  const split = vaultDraftSplit({ body: draft && draft.body, mode: vaultDraft.mode })
  if (await premiumUnchanged(draft, previous, vaultDraft, split)) {
    if (!withDetails) return previous
    return {
      unchanged: true,
      publicBody: asString(draft && draft.body),
      vaultMetadata: previous,
      companions: [],
      plaintextBytes: Number.isInteger(previous.bytes) ? previous.bytes : 0,
      ciphertextChars: typeof previous.ct === 'string' ? previous.ct.length : 0,
      transport: Array.isArray(previous.parts) && previous.parts.length ? 'comment' : 'inline',
      premiumBody: split.premiumBody
    }
  }

  const prepared = await prepareVaultPublish({ account, permlink, draft, vault, settings, now })
  return withDetails ? { ...prepared, unchanged: false } : prepared.vaultMetadata
}
