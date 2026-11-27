// Read, validate and write the blog settings that live on chain.
//
// The canonical location is `posting_json_metadata["banksia.io"].blog`, next to
// the profile theme. It is written with the posting key through
// `account_update2`, which means claiming or editing a blog never needs an
// active key and never leaves a key on a server.
//
// Every write is a read-merge-write of the whole metadata object. A blog write
// therefore preserves the profile, the theme and any other app's keys.

import { BLOG_MAX_AUTHORS, BLOG_MAX_BYTES, BLOG_MAX_NAV, BLOG_MAX_PINNED, BLOG_SCHEMA_VERSION } from '../config/blog'
import { LEGACY_THEME_NAMESPACE, THEME_NAMESPACE } from '../config/brand'
import { isHexColor } from '../themes/color'
import {
  MAX_ACCOUNT_METADATA_BYTES,
  buildPostingMetadataOperation,
  parseAccountMetadata
} from './accountMetadata'
import { isHostname, isValidHiveAccountName, normalizeHostname } from './blogHost'

export { THEME_NAMESPACE as BLOG_NAMESPACE }

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const BIDI_RE = /[\u202a-\u202e\u2066-\u2069]/
const THEME_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const COMMUNITY_RE = /^hive-\d{1,10}$/
const NAV_HREF_RE = /^(?:\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/i

const BLOG_KEYS = [
  'version', 'claimed', 'title', 'description', 'theme', 'mode', 'accent',
  'nav', 'pinned', 'authors', 'community', 'showPayout', 'showComments',
  'directory', 'ogImage', 'customDomain', 'updatedAt'
]

function isPlainObject (value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function clone (value) {
  return JSON.parse(JSON.stringify(value))
}

function profileFromAccount (account) {
  const legacy = parseAccountMetadata(account && account.json_metadata).value.profile
  const posting = parseAccountMetadata(account && account.posting_json_metadata).value.profile
  const profile = {
    ...(isPlainObject(legacy) ? legacy : {}),
    ...(isPlainObject(posting) ? posting : {})
  }
  return profile
}

function readableText (value, { max = 80, min = 0, noMarkup = false } = {}, path, errors) {
  if (typeof value !== 'string') {
    errors.push(path + ' must be a string')
    return ''
  }
  const text = value.trim()
  if (text.length < min) errors.push(path + ' is too short')
  if (text.length > max) errors.push(path + ' must be ' + max + ' characters or fewer')
  if (CONTROL_RE.test(text)) errors.push(path + ' contains control characters')
  if (BIDI_RE.test(text)) errors.push(path + ' contains bidirectional control characters')
  if (noMarkup && /[<>]/.test(text)) errors.push(path + ' must be plain text, not HTML')
  return text
}

function enumValue (value, allowed, path, errors, fallback) {
  if (value === undefined) return fallback
  if (!allowed.includes(value)) {
    errors.push(path + ' must be one of: ' + allowed.join(', '))
    return fallback
  }
  return value
}

function normalizeNav (value, errors) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    errors.push('nav must be an array')
    return []
  }
  if (value.length > BLOG_MAX_NAV) errors.push('nav supports at most ' + BLOG_MAX_NAV + ' links')
  const nav = []
  for (const item of value.slice(0, BLOG_MAX_NAV)) {
    if (!isPlainObject(item)) {
      errors.push('nav[] must be an object')
      continue
    }
    for (const key of Object.keys(item)) {
      if (key !== 'label' && key !== 'href') errors.push('nav[].' + key + ' is not a recognised field')
    }
    const label = readableText(item.label, { max: 40, min: 1, noMarkup: true }, 'nav[].label', errors)
    const href = readableText(item.href, { max: 300, min: 1 }, 'nav[].href', errors)
    if (href && !NAV_HREF_RE.test(href)) {
      errors.push('nav[].href must be a site-relative path or an https URL')
      continue
    }
    if (label && href) nav.push({ label, href })
  }
  return nav
}

function normalizePermlinks (value, errors, { max, path }) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    errors.push(path + ' must be an array')
    return []
  }
  if (value.length > max) errors.push(path + ' supports at most ' + max + ' entries')
  const out = []
  for (const item of value.slice(0, max)) {
    const permlink = typeof item === 'string' ? item.trim().toLowerCase() : ''
    if (!PERMLINK_RE.test(permlink)) {
      errors.push(path + ' contains an invalid permlink')
      continue
    }
    if (!out.includes(permlink)) out.push(permlink)
  }
  return out
}

function normalizeAuthors (value, errors) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    errors.push('authors must be an array')
    return []
  }
  if (value.length > BLOG_MAX_AUTHORS) errors.push('authors supports at most ' + BLOG_MAX_AUTHORS + ' accounts')
  const out = []
  for (const item of value.slice(0, BLOG_MAX_AUTHORS)) {
    const name = typeof item === 'string' ? item.trim().toLowerCase() : ''
    if (!isValidHiveAccountName(name)) {
      errors.push('authors contains an invalid Hive account')
      continue
    }
    if (!out.includes(name)) out.push(name)
  }
  return out
}

function normalizeCustomDomain (value, errors) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    errors.push('customDomain must be a string')
    return ''
  }
  const domain = value.trim().toLowerCase().replace(/\.$/, '')
  if (!isHostname(domain) || normalizeHostname(domain) !== domain) {
    errors.push('customDomain must be a bare hostname such as blog.example.com')
    return ''
  }
  return domain
}

/** Defaults derived from the Hive profile. Never throws on partial accounts. */
export function defaultBlogSettings (account) {
  const profile = profileFromAccount(account)
  const name = (account && account.name) || ''
  return {
    version: BLOG_SCHEMA_VERSION,
    claimed: false,
    title: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim().slice(0, 80) : name,
    description: typeof profile.about === 'string' ? profile.about.trim().slice(0, 240) : '',
    theme: 'auto',
    mode: 'auto',
    accent: '',
    nav: [],
    pinned: [],
    authors: [],
    community: '',
    showPayout: false,
    showComments: true,
    directory: false,
    ogImage: '',
    customDomain: '',
    updatedAt: ''
  }
}

/**
 * Validate and normalise an untrusted blog object.
 *
 * @returns {{ ok: boolean, settings: object, errors: string[], warnings: string[] }}
 */
export function normalizeBlogSettings (input, { account = null } = {}) {
  const errors = []
  const warnings = []
  const defaults = defaultBlogSettings(account)

  if (!isPlainObject(input)) {
    return { ok: false, settings: defaults, errors: ['Blog settings must be a JSON object'], warnings }
  }
  for (const key of Object.keys(input)) {
    if (!BLOG_KEYS.includes(key)) errors.push(key + ' is not a recognised blog field')
  }

  const version = input.version === undefined ? BLOG_SCHEMA_VERSION : input.version
  if (version !== BLOG_SCHEMA_VERSION) errors.push('version must be ' + BLOG_SCHEMA_VERSION)
  const claimed = input.claimed === true
  if (input.claimed !== undefined && typeof input.claimed !== 'boolean') errors.push('claimed must be a boolean')

  const title = input.title === undefined
    ? defaults.title
    : readableText(input.title, { max: 80, noMarkup: true }, 'title', errors)
  const description = input.description === undefined
    ? defaults.description
    : readableText(input.description, { max: 240, noMarkup: true }, 'description', errors)

  const theme = input.theme === undefined
    ? 'auto'
    : (input.theme === 'auto' || THEME_ID_RE.test(String(input.theme || '')))
        ? input.theme
        : (errors.push('theme must be "auto" or a theme id'), 'auto')
  const mode = enumValue(input.mode, ['auto', 'light', 'dark'], 'mode', errors, 'auto')
  const accent = input.accent === undefined || input.accent === '' ? '' : String(input.accent || '').toLowerCase()
  if (accent && !isHexColor(accent)) errors.push('accent must be a #rgb or #rrggbb colour')

  const nav = normalizeNav(input.nav, errors)
  const pinned = normalizePermlinks(input.pinned, errors, { max: BLOG_MAX_PINNED, path: 'pinned' })
  const authors = normalizeAuthors(input.authors, errors)
  const community = input.community === undefined || input.community === '' ? '' : String(input.community || '').toLowerCase()
  if (community && !COMMUNITY_RE.test(community)) errors.push('community must look like hive-123456')

  const showPayout = input.showPayout === true
  if (input.showPayout !== undefined && typeof input.showPayout !== 'boolean') errors.push('showPayout must be a boolean')
  const showComments = input.showComments !== false
  if (input.showComments !== undefined && typeof input.showComments !== 'boolean') errors.push('showComments must be a boolean')
  const directory = input.directory === true
  if (input.directory !== undefined && typeof input.directory !== 'boolean') errors.push('directory must be a boolean')

  const ogImage = input.ogImage === undefined || input.ogImage === null || input.ogImage === ''
    ? ''
    : readableText(input.ogImage, { max: 500 }, 'ogImage', errors)
  if (ogImage && !/^https:\/\/[^\s]+$/i.test(ogImage)) errors.push('ogImage must be an https URL')

  const customDomain = normalizeCustomDomain(input.customDomain, errors)
  const updatedAt = input.updatedAt === undefined
    ? ''
    : readableText(input.updatedAt, { max: 40 }, 'updatedAt', errors)

  const settings = {
    version: BLOG_SCHEMA_VERSION,
    claimed,
    title,
    description,
    theme,
    mode,
    accent,
    nav,
    pinned,
    authors,
    community,
    showPayout,
    showComments,
    directory,
    ogImage,
    customDomain,
    updatedAt
  }

  try {
    if (JSON.stringify(settings).length > BLOG_MAX_BYTES) {
      errors.push('Blog settings must be ' + BLOG_MAX_BYTES + ' bytes or fewer')
    }
  } catch {
    errors.push('Blog settings are not serialisable')
  }

  if (!claimed) warnings.push('This blog has not been claimed yet; readers see an unclaimed preview.')

  return { ok: errors.length === 0, settings, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

/**
 * Read the blog namespace out of an account. Missing or malformed metadata
 * degrades to profile-derived defaults and `claimed: false`.
 */
export function readBlogSettings (account) {
  if (!account) {
    return { settings: defaultBlogSettings(null), claimed: false, error: 'Account is not loaded', raw: {} }
  }
  const parsed = parseAccountMetadata(account.posting_json_metadata)
  const raw = parsed.value
  const namespace = (raw[THEME_NAMESPACE] && typeof raw[THEME_NAMESPACE] === 'object')
    ? raw[THEME_NAMESPACE]
    : (raw[LEGACY_THEME_NAMESPACE] && typeof raw[LEGACY_THEME_NAMESPACE] === 'object')
        ? raw[LEGACY_THEME_NAMESPACE]
        : null
  const candidate = namespace ? namespace.blog : null
  if (!candidate) {
    return { settings: defaultBlogSettings(account), claimed: false, error: '', raw }
  }
  const result = normalizeBlogSettings(candidate, { account })
  return {
    settings: result.settings,
    claimed: result.ok && result.settings.claimed === true,
    error: result.errors[0] || '',
    warnings: result.warnings,
    raw
  }
}

/**
 * Merge a normalised blog object into an existing posting metadata string.
 *
 * @returns {{ ok: boolean, text: string, value: object|null, previous: object|null, error: string }}
 */
export function mergeBlogMetadata (raw, blog) {
  const parsed = parseAccountMetadata(raw)
  if (!parsed.ok) {
    return { ok: false, text: '', value: null, previous: null, error: parsed.error }
  }
  if (!isPlainObject(blog)) {
    return { ok: false, text: '', value: null, previous: null, error: 'Blog settings must be an object' }
  }

  const value = clone(parsed.value)
  const current = value[THEME_NAMESPACE] && typeof value[THEME_NAMESPACE] === 'object'
    ? value[THEME_NAMESPACE]
    : null
  const legacy = value[LEGACY_THEME_NAMESPACE] && typeof value[LEGACY_THEME_NAMESPACE] === 'object'
    ? value[LEGACY_THEME_NAMESPACE]
    : null
  const previous = current ? clone(current) : null

  value[THEME_NAMESPACE] = {
    ...(legacy || {}),
    ...(current || {}),
    blog: clone(blog)
  }
  delete value[LEGACY_THEME_NAMESPACE]

  const text = JSON.stringify(value)
  if (text.length > MAX_ACCOUNT_METADATA_BYTES) {
    return { ok: false, text: '', value: null, previous, error: 'The merged profile metadata is too large' }
  }
  return { ok: true, text, value, previous, error: '' }
}

/** Remove the blog object while keeping the profile and theme. */
export function removeBlogMetadata (raw) {
  const parsed = parseAccountMetadata(raw)
  if (!parsed.ok) {
    return { ok: false, text: '', value: null, error: parsed.error }
  }
  const value = clone(parsed.value)
  for (const namespace of [THEME_NAMESPACE, LEGACY_THEME_NAMESPACE]) {
    const current = value[namespace]
    if (!current || typeof current !== 'object') continue
    delete current.blog
    if (Object.keys(current).length === 0) delete value[namespace]
  }
  return { ok: true, text: JSON.stringify(value), value, error: '' }
}

export function buildBlogOperation (accountName, postingMetadata) {
  return buildPostingMetadataOperation(accountName, postingMetadata)
}

/**
 * Build a claim operation for an account. Claiming is free; it is the on-chain
 * signal that the account wants the blog to be public and indexable.
 */
export function claimBlog (account, patch = {}) {
  if (!account || !isValidHiveAccountName(account.name)) {
    return { ok: false, settings: null, operation: null, text: '', error: 'A valid Hive account is required' }
  }
  const defaults = defaultBlogSettings(account)
  const candidate = {
    ...defaults,
    ...patch,
    version: BLOG_SCHEMA_VERSION,
    claimed: true,
    updatedAt: new Date().toISOString()
  }
  const result = normalizeBlogSettings(candidate, { account })
  if (!result.ok) {
    return { ok: false, settings: result.settings, operation: null, text: '', error: result.errors[0] }
  }
  const merged = mergeBlogMetadata(account.posting_json_metadata, result.settings)
  if (!merged.ok) {
    return { ok: false, settings: result.settings, operation: null, text: '', error: merged.error }
  }
  return {
    ok: true,
    settings: result.settings,
    operation: buildBlogOperation(account.name, merged.text),
    text: merged.text,
    error: ''
  }
}

/** Build an update operation from a full settings object. */
export function updateBlog (account, settings) {
  if (!account || !isValidHiveAccountName(account.name)) {
    return { ok: false, settings: null, operation: null, text: '', error: 'A valid Hive account is required' }
  }
  const result = normalizeBlogSettings({ ...settings, updatedAt: new Date().toISOString() }, { account })
  if (!result.ok) {
    return { ok: false, settings: result.settings, operation: null, text: '', error: result.errors[0] }
  }
  const merged = mergeBlogMetadata(account.posting_json_metadata, result.settings)
  if (!merged.ok) {
    return { ok: false, settings: result.settings, operation: null, text: '', error: merged.error }
  }
  return {
    ok: true,
    settings: result.settings,
    operation: buildBlogOperation(account.name, merged.text),
    text: merged.text,
    error: ''
  }
}

export function blogSettingsSize (settings) {
  try {
    return JSON.stringify(settings).length
  } catch {
    return 0
  }
}
