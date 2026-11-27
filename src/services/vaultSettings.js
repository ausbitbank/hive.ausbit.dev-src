// Public advertising metadata for Banksia Vault (members-only content).
//
// The canonical location is `posting_json_metadata["banksia.io"].blog.vault`.
// It names the HOM product and the hidden grant container, and carries display
// hints only. Entitlement lives in signed grants and keys, never here, and the
// HOM product post is the only source of truth for the amount.
//
// Validation is intentionally strict: a newer client that adds a field to the
// vault object should fail loudly instead of having the field silently dropped
// on the next write. The object must stay small (~500 bytes) because the blog
// object shares a 12 KB budget with CSS and blocks.

import {
  VAULT_ALLOWED_ARCHIVE,
  VAULT_DEFAULT_CONTAINER,
  VAULT_DEFAULT_EXECUTIONS,
  VAULT_DEFAULT_PERIOD,
  VAULT_DEFAULT_PRICE,
  VAULT_DEFAULT_RECURRENCE,
  VAULT_MAX_BYTES,
  VAULT_SCHEMA_VERSION
} from '../config/blog'
import { LEGACY_THEME_NAMESPACE, THEME_NAMESPACE } from '../config/brand'
import { parseAccountMetadata } from './accountMetadata'
import { isValidHiveAccountName } from './blogHost'

const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const PRICE_RE = /^\d+\.\d{3} HBD$/
const BULLETIN_RE = /^vault-\d{4}-(?:0[1-9]|1[0-2])-\d+$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const VAULT_KEYS = [
  'v', 'enabled', 'product', 'container', 'bulletin', 'price', 'period',
  'recurrence', 'executions', 'archive', 'watermark', 'updatedAt'
]
const BULLETIN_KEYS = ['author', 'permlink']

// A vault object must never carry signing or encryption material. Unknown
// fields are already rejected, but key-shaped fields and WIF values get their
// own message so a client mistake is obvious.
const PRIVATE_KEY_RE = /^(?:private|secret|seed|mnemonic|passphrase|password|wif|privkey|private_key|secret_key|api_key|access_token|refresh_token|token|keys?)$/i
const WIF_RE = /^(?:5[HJK][1-9A-HJ-NP-Za-km-z]{49}|[KL][1-9A-HJ-NP-Za-km-z]{50,51}|PVT_[A-Za-z0-9]+)$/

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function byteLength (value) {
  try {
    const text = JSON.stringify(value)
    if (typeof text !== 'string') return 0
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
    return text.length
  } catch {
    return 0
  }
}

function isoNow (now) {
  if (now === null || now === undefined) return new Date().toISOString()
  if (now instanceof Date) {
    return Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString()
  }
  const time = typeof now === 'number' ? now : Date.parse(String(now))
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString()
}

/** Split an `author/permlink` reference, or return null. */
function parseProductRef (value) {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  const slash = text.indexOf('/')
  if (slash < 1 || slash === text.length - 1) return null
  if (text.indexOf('/', slash + 1) !== -1) return null
  const author = text.slice(0, slash)
  const permlink = text.slice(slash + 1)
  if (!isValidHiveAccountName(author) || !PERMLINK_RE.test(permlink)) return null
  return { author, permlink }
}

/** Convert `X.XXX HBD` (or a number) into its canonical label, or null. */
export function formatVaultPrice (value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return formatMilli(Math.round(value * 1000))
  }
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s*HBD$/i, '').trim()
  const match = text.match(/^(\d+)(?:\.(\d{1,3}))?$/)
  if (!match) return null
  const whole = Number(match[1])
  if (!Number.isSafeInteger(whole)) return null
  const fraction = (match[2] || '').padEnd(3, '0')
  return formatMilli(whole * 1000 + Number(fraction))
}

function formatMilli (milli) {
  if (!Number.isSafeInteger(milli) || milli < 0) return null
  const whole = Math.floor(milli / 1000)
  const fraction = String(milli % 1000).padStart(3, '0')
  return whole + '.' + fraction + ' HBD'
}

/** Numeric HBD value of a price label, or null. */
export function vaultPriceValue (price) {
  const label = formatVaultPrice(price)
  if (!label) return null
  return Number(label.replace(/ HBD$/, ''))
}

/** Default public vault settings for an account blog. */
export function defaultVaultSettings (_account = null) {
  return {
    v: VAULT_SCHEMA_VERSION,
    enabled: false,
    product: '',
    container: VAULT_DEFAULT_CONTAINER,
    bulletin: { author: '', permlink: '' },
    price: VAULT_DEFAULT_PRICE,
    period: VAULT_DEFAULT_PERIOD,
    recurrence: VAULT_DEFAULT_RECURRENCE,
    executions: VAULT_DEFAULT_EXECUTIONS,
    archive: 'all',
    watermark: true,
    updatedAt: ''
  }
}

function privateMaterialPaths (value, path = 'vault', seen = new Set()) {
  const found = []
  if (!value || typeof value !== 'object') return found
  if (seen.has(value)) return found
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...privateMaterialPaths(item, path + '[' + index + ']', seen))
    })
    return found
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = path + '.' + key
    if (PRIVATE_KEY_RE.test(key)) {
      found.push(childPath)
      continue
    }
    if (typeof child === 'string' && WIF_RE.test(child.trim())) {
      found.push(childPath)
      continue
    }
    found.push(...privateMaterialPaths(child, childPath, seen))
  }
  return found
}

function integerField (value, path, { min, max, fallback }, errors) {
  if (value === undefined || value === null) return fallback
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(path + ' must be an integer between ' + min + ' and ' + max)
    return fallback
  }
  return value
}

function normalizeBulletin (value, errors) {
  if (value === undefined || value === null) return { author: '', permlink: '' }
  if (!isPlainObject(value)) {
    errors.push('vault.bulletin must be an object with author and permlink')
    return { author: '', permlink: '' }
  }
  for (const key of Object.keys(value)) {
    if (!BULLETIN_KEYS.includes(key)) {
      errors.push('vault.bulletin.' + key + ' is not a recognised field')
    }
  }
  let author = ''
  if (value.author !== undefined && value.author !== null && value.author !== '') {
    if (typeof value.author !== 'string') {
      errors.push('vault.bulletin.author must be a string')
    } else {
      const name = value.author.trim().toLowerCase()
      if (!isValidHiveAccountName(name)) {
        errors.push('vault.bulletin.author must be a valid Hive account')
      } else {
        author = name
      }
    }
  }
  let permlink = ''
  if (value.permlink !== undefined && value.permlink !== null && value.permlink !== '') {
    if (typeof value.permlink !== 'string') {
      errors.push('vault.bulletin.permlink must be a string')
    } else {
      const slug = value.permlink.trim()
      if (!PERMLINK_RE.test(slug) || !BULLETIN_RE.test(slug)) {
        errors.push('vault.bulletin.permlink must look like vault-2026-11-3')
      } else {
        permlink = slug
      }
    }
  }
  if (Boolean(author) !== Boolean(permlink)) {
    errors.push('vault.bulletin must set both author and permlink, or neither')
  }
  return { author, permlink }
}

/**
 * Validate and normalise an untrusted `blog.vault` object.
 *
 * Unknown fields are errors, not warnings: silently dropping a field a newer
 * client wrote would corrupt the creator's configuration on the next save.
 *
 * @param {unknown} input
 * @param {{ account?: object|null, now?: string|number|Date|null }} [options]
 * @returns {{ ok: boolean, settings: object, errors: string[], warnings: string[] }}
 */
export function normalizeVaultSettings (input, options = {}) {
  const errors = []
  const warnings = []
  const now = options && options.now !== undefined ? options.now : null
  const defaults = defaultVaultSettings()

  if (input === undefined || input === null) {
    return { ok: true, settings: { ...defaults, updatedAt: isoNow(now) }, errors, warnings }
  }
  if (!isPlainObject(input)) {
    errors.push('vault must be a JSON object')
    return { ok: false, settings: { ...defaults, updatedAt: isoNow(now) }, errors, warnings }
  }

  if (byteLength(input) > VAULT_MAX_BYTES) {
    errors.push('vault must be ' + VAULT_MAX_BYTES + ' bytes or fewer')
  }
  for (const key of Object.keys(input)) {
    if (!VAULT_KEYS.includes(key)) errors.push('vault.' + key + ' is not a recognised field')
  }
  for (const path of privateMaterialPaths(input)) {
    errors.push(path + ' must not contain private key or token material')
  }

  const v = input.v === undefined ? VAULT_SCHEMA_VERSION : input.v
  if (v !== VAULT_SCHEMA_VERSION) errors.push('vault.v must be ' + VAULT_SCHEMA_VERSION)

  const enabled = input.enabled === true
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    errors.push('vault.enabled must be a boolean')
  }

  let product = ''
  if (input.product !== undefined && input.product !== null) {
    if (typeof input.product !== 'string') {
      errors.push('vault.product must be "author/permlink" or empty')
    } else if (input.product.trim()) {
      const ref = parseProductRef(input.product)
      if (!ref) {
        errors.push('vault.product must be "author/permlink" with a valid Hive account and permlink')
      } else {
        product = ref.author + '/' + ref.permlink
      }
    }
  }

  let container = VAULT_DEFAULT_CONTAINER
  if (input.container !== undefined && input.container !== null) {
    if (typeof input.container !== 'string') {
      errors.push('vault.container must be a permlink')
    } else {
      const slug = input.container.trim().toLowerCase()
      if (!PERMLINK_RE.test(slug)) {
        errors.push('vault.container must be a permlink such as banksia-vault')
      } else {
        container = slug
      }
    }
  }

  const bulletin = normalizeBulletin(input.bulletin, errors)

  let price = VAULT_DEFAULT_PRICE
  if (input.price !== undefined && input.price !== null) {
    if (typeof input.price !== 'string') {
      errors.push('vault.price must be a string such as "5.000 HBD"')
    } else {
      const text = input.price.trim()
      if (!PRICE_RE.test(text)) {
        errors.push('vault.price must look like "5.000 HBD"')
      } else {
        const value = vaultPriceValue(text)
        if (value === null || value <= 0 || value > 100000) {
          errors.push('vault.price must be greater than 0 and at most 100000 HBD')
        } else {
          price = formatVaultPrice(value)
        }
      }
    }
  }

  let period = VAULT_DEFAULT_PERIOD
  if (input.period !== undefined && input.period !== null) {
    if (input.period !== VAULT_DEFAULT_PERIOD) {
      errors.push('vault.period must be "' + VAULT_DEFAULT_PERIOD + '"')
    } else {
      period = input.period
    }
  }

  const recurrence = integerField(input.recurrence, 'vault.recurrence', {
    min: 24, max: 8760, fallback: VAULT_DEFAULT_RECURRENCE
  }, errors)
  const executions = integerField(input.executions, 'vault.executions', {
    min: 2, max: 120, fallback: VAULT_DEFAULT_EXECUTIONS
  }, errors)

  let archive = 'all'
  if (input.archive !== undefined && input.archive !== null) {
    if (!VAULT_ALLOWED_ARCHIVE.includes(input.archive)) {
      errors.push('vault.archive must be one of: ' + VAULT_ALLOWED_ARCHIVE.join(', '))
    } else {
      archive = input.archive
    }
  }

  const watermark = input.watermark !== false
  if (input.watermark !== undefined && typeof input.watermark !== 'boolean') {
    errors.push('vault.watermark must be a boolean')
  }

  let updatedAt = isoNow(now)
  if (input.updatedAt !== undefined && input.updatedAt !== null && input.updatedAt !== '') {
    if (typeof input.updatedAt !== 'string') {
      errors.push('vault.updatedAt must be an ISO timestamp')
    } else {
      const text = input.updatedAt.trim()
      if (!ISO_RE.test(text) || !Number.isFinite(Date.parse(text))) {
        errors.push('vault.updatedAt must be an ISO timestamp')
      } else {
        updatedAt = text
      }
    }
  }

  if (enabled && !product) {
    errors.push('vault.product is required when vault.enabled is true')
  }
  if (enabled && !container) {
    errors.push('vault.container is required when vault.enabled is true')
  }

  const settings = {
    v: VAULT_SCHEMA_VERSION,
    enabled,
    product,
    container,
    bulletin,
    price,
    period,
    recurrence,
    executions,
    archive,
    watermark,
    updatedAt
  }

  if (byteLength(settings) > VAULT_MAX_BYTES) {
    errors.push('vault must be ' + VAULT_MAX_BYTES + ' bytes or fewer')
  }

  return {
    ok: errors.length === 0,
    settings,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)]
  }
}

/**
 * Read `blog.vault` from an account's posting metadata.
 *
 * `enabled` is only true when the whole object validates: a malformed vault
 * must not switch a paywall on.
 */
export function readVaultSettings (account) {
  if (!account || typeof account !== 'object') {
    return {
      settings: defaultVaultSettings(null),
      enabled: false,
      error: 'Account is not loaded',
      warnings: []
    }
  }
  const parsed = parseAccountMetadata(account.posting_json_metadata)
  if (!parsed.ok) {
    return {
      settings: defaultVaultSettings(account),
      enabled: false,
      error: parsed.error,
      warnings: []
    }
  }
  const raw = parsed.value
  const namespace = isPlainObject(raw[THEME_NAMESPACE])
    ? raw[THEME_NAMESPACE]
    : isPlainObject(raw[LEGACY_THEME_NAMESPACE])
        ? raw[LEGACY_THEME_NAMESPACE]
        : null
  const blog = namespace && isPlainObject(namespace.blog) ? namespace.blog : null
  const candidate = blog && isPlainObject(blog.vault) ? blog.vault : null
  if (!candidate) {
    return {
      settings: defaultVaultSettings(account),
      enabled: false,
      error: '',
      warnings: []
    }
  }
  const result = normalizeVaultSettings(candidate, { account })
  return {
    settings: result.settings,
    enabled: result.ok && result.settings.enabled === true,
    error: result.errors[0] || '',
    warnings: result.warnings
  }
}

/**
 * Plain, serialisable vault object suitable for merging into `blog`.
 *
 * Call `normalizeVaultSettings` first when the caller needs the error list; this
 * helper always returns the normalised copy so a write never stores a partial
 * object with unknown keys.
 */
export function buildVaultSettingsPatch (settings) {
  return { ...normalizeVaultSettings(settings).settings }
}

/** True when the vault advertises an enabled product and container. */
export function vaultIsConfigured (settings) {
  if (!settings || typeof settings !== 'object') return false
  return settings.enabled === true &&
    typeof settings.product === 'string' && settings.product.trim() !== '' &&
    typeof settings.container === 'string' && settings.container.trim() !== ''
}

/** Canonical `author/permlink` product reference, or ''. */
export function vaultProductRef (settings) {
  const ref = parseProductRef(settings && settings.product)
  return ref ? ref.author + '/' + ref.permlink : ''
}
