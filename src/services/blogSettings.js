// Read, validate and write the blog settings that live on chain.
//
// The canonical location is `posting_json_metadata["banksia.io"].blog`, next to
// the profile theme. It is written with the posting key through
// `account_update2`, which means claiming or editing a blog never needs an
// active key and never leaves a key on a server.
//
// Every write is a read-merge-write of the whole metadata object. A blog write
// therefore preserves the profile, the theme and any other app's keys.

import {
  BLOG_MAX_AUTHORS,
  BLOG_MAX_BLOCKS,
  BLOG_MAX_BYTES,
  BLOG_MAX_CSS,
  BLOG_MAX_NAV,
  BLOG_MAX_PINNED,
  BLOG_MAX_SHOP_FEATURED,
  BLOG_SCHEMA_VERSION
} from '../config/blog'
import { LEGACY_THEME_NAMESPACE, THEME_NAMESPACE } from '../config/brand'
import { isHexColor } from '../themes/color'
import {
  MAX_ACCOUNT_METADATA_BYTES,
  buildPostingMetadataOperation,
  parseAccountMetadata
} from './accountMetadata'
import { isHostname, isValidHiveAccountName, normalizeHostname } from './blogHost'
import { defaultVaultSettings, normalizeVaultSettings } from './vaultSettings'

export { THEME_NAMESPACE as BLOG_NAMESPACE }

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const BIDI_RE = /[\u202a-\u202e\u2066-\u2069]/
const THEME_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const COMMUNITY_RE = /^hive-\d{1,10}$/
const NAV_HREF_RE = /^(?:\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/i
const SHOP_TAG_RE = /^[a-z0-9][a-z0-9-]{0,23}$/
const SHOP_SOURCES = ['account', 'tag']
const SHOP_LAYOUTS = ['grid', 'list']
const SHOP_SORTS = ['newest', 'price-asc', 'price-desc']

const BLOG_KEYS = [
  'version', 'claimed', 'title', 'description', 'theme', 'mode', 'accent',
  'layout', 'width', 'typography', 'hero', 'showTags', 'showReadingTime',
  'nav', 'blocks', 'css', 'logo', 'heroImage', 'favicon',
  'portfolio', 'shop',
  'vault',
  'pinned', 'authors', 'community', 'showPayout', 'showComments',
  'directory', 'ogImage', 'customDomain', 'updatedAt'
]

const LAYOUTS = ['grid', 'list', 'magazine']
const WIDTHS = ['narrow', 'comfortable', 'wide']
const TYPOGRAPHY = ['theme', 'serif', 'sans', 'mono']
const HEROES = ['cover', 'minimal']
const BLOCK_TYPES = ['hero', 'pinned', 'archive', 'about', 'contact', 'text']
const BLOCK_LAYOUTS = ['grid', 'list', 'magazine']
const FIXED_BLOCKS = new Set(['hero', 'pinned', 'archive', 'about', 'contact'])

export function defaultBlogBlocks () {
  return [
    { type: 'hero', visible: true },
    { type: 'pinned', visible: true },
    { type: 'archive', visible: true }
  ]
}

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

function normalizeNav (value, errors, warnings) {
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
      if (key !== 'label' && key !== 'href') warnings.push('nav[].' + key + ' is not a recognised field')
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

function normalizeHttpsUrl (value, path, errors) {
  if (value === undefined || value === null || value === '') return ''
  const text = readableText(value, { max: 500 }, path, errors)
  if (text && !/^https:\/\/[^\s]+$/i.test(text)) {
    errors.push(path + ' must be an https URL')
    return ''
  }
  return text
}

function normalizeBlocks (value, errors, warnings) {
  if (value === undefined || value === null) return defaultBlogBlocks()
  if (!Array.isArray(value)) {
    errors.push('blocks must be an array')
    return defaultBlogBlocks()
  }
  if (value.length > BLOG_MAX_BLOCKS) {
    errors.push('blocks supports at most ' + BLOG_MAX_BLOCKS + ' sections')
  }
  const blocks = []
  const seen = new Set()
  for (const item of value.slice(0, BLOG_MAX_BLOCKS)) {
    if (!isPlainObject(item)) {
      errors.push('blocks[] must be an object')
      continue
    }
    for (const key of Object.keys(item)) {
      if (!['type', 'visible', 'title', 'body', 'layout'].includes(key)) {
        warnings.push('blocks[].' + key + ' is not a recognised field')
      }
    }
    const type = enumValue(item.type, BLOCK_TYPES, 'blocks[].type', errors, '')
    if (!type) continue
    if (FIXED_BLOCKS.has(type)) {
      if (seen.has(type)) {
        errors.push('blocks contains more than one ' + type + ' section')
        continue
      }
      seen.add(type)
    }
    const visible = item.visible !== false
    if (item.visible !== undefined && typeof item.visible !== 'boolean') {
      errors.push('blocks[].visible must be a boolean')
    }
    const title = item.title === undefined ? '' : readableText(item.title, { max: 80 }, 'blocks[].title', errors)
    const body = item.body === undefined ? '' : readableText(item.body, { max: 1200 }, 'blocks[].body', errors)
    const layout = item.layout === undefined || item.layout === ''
      ? ''
      : enumValue(item.layout, BLOCK_LAYOUTS, 'blocks[].layout', errors, '')
    blocks.push({ type, visible, title, body, layout })
  }
  return blocks
}

function normalizePortfolio (value, errors, warnings) {
  const input = value === undefined || value === null ? {} : value
  if (!isPlainObject(input)) {
    errors.push('portfolio must be an object')
    return { enabled: false, title: 'Portfolio', description: '', layout: 'grid', items: [] }
  }
  for (const key of Object.keys(input)) {
    if (!['enabled', 'title', 'description', 'layout', 'items'].includes(key)) {
      warnings.push('portfolio.' + key + ' is not a recognised field')
    }
  }
  const enabled = input.enabled === true
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    errors.push('portfolio.enabled must be a boolean')
  }
  const title = input.title === undefined
    ? 'Portfolio'
    : readableText(input.title, { max: 80 }, 'portfolio.title', errors)
  const description = input.description === undefined
    ? ''
    : readableText(input.description, { max: 240 }, 'portfolio.description', errors)
  const layout = enumValue(input.layout, ['grid', 'masonry'], 'portfolio.layout', errors, 'grid')
  const items = normalizePermlinks(input.items, errors, { max: 12, path: 'portfolio.items' })
  return { enabled, title, description, layout, items }
}

function defaultShopSettings () {
  return {
    enabled: false,
    title: 'Shop',
    description: '',
    source: 'account',
    tag: '',
    featured: [],
    layout: 'grid',
    showSoldOut: true,
    sort: 'newest'
  }
}

function normalizeShopFeatured (value, errors) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    errors.push('shop.featured must be an array')
    return []
  }
  if (value.length > BLOG_MAX_SHOP_FEATURED) {
    errors.push('shop.featured supports at most ' + BLOG_MAX_SHOP_FEATURED + ' products')
  }
  const out = []
  for (const item of value.slice(0, BLOG_MAX_SHOP_FEATURED)) {
    if (typeof item !== 'string') {
      errors.push('shop.featured contains an invalid product reference')
      continue
    }
    const [author, ...rest] = item.trim().toLowerCase().split('/')
    const permlink = rest.join('/')
    if (!isValidHiveAccountName(author) || !PERMLINK_RE.test(permlink)) {
      errors.push('shop.featured contains an invalid product reference')
      continue
    }
    const key = author + '/' + permlink
    if (!out.includes(key)) out.push(key)
  }
  return out
}

function normalizeShop (value, errors, warnings) {
  const input = value === undefined || value === null ? {} : value
  if (!isPlainObject(input)) {
    errors.push('shop must be an object')
    return defaultShopSettings()
  }
  for (const key of Object.keys(input)) {
    if (!['enabled', 'title', 'description', 'source', 'tag', 'featured', 'layout', 'showSoldOut', 'sort'].includes(key)) {
      warnings.push('shop.' + key + ' is not a recognised field')
    }
  }
  const enabled = input.enabled === true
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    errors.push('shop.enabled must be a boolean')
  }
  const title = input.title === undefined
    ? 'Shop'
    : readableText(input.title, { max: 80 }, 'shop.title', errors)
  const description = input.description === undefined
    ? ''
    : readableText(input.description, { max: 240 }, 'shop.description', errors)
  const source = enumValue(input.source, SHOP_SOURCES, 'shop.source', errors, 'account')
  let tag = ''
  if (input.tag !== undefined && input.tag !== null && input.tag !== '') {
    if (typeof input.tag !== 'string') {
      errors.push('shop.tag must be a string')
    } else {
      tag = input.tag.trim().toLowerCase().replace(/^#+/, '')
      if (!SHOP_TAG_RE.test(tag)) errors.push('shop.tag must be a Hive tag such as hosting')
    }
  }
  if (source === 'tag' && !tag) {
    warnings.push('shop.source is "tag" but shop.tag is empty; the storefront will fall back to your account.')
  }
  const featured = normalizeShopFeatured(input.featured, errors)
  const layout = enumValue(input.layout, SHOP_LAYOUTS, 'shop.layout', errors, 'grid')
  const showSoldOut = input.showSoldOut !== false
  if (input.showSoldOut !== undefined && typeof input.showSoldOut !== 'boolean') {
    errors.push('shop.showSoldOut must be a boolean')
  }
  const sort = enumValue(input.sort, SHOP_SORTS, 'shop.sort', errors, 'newest')
  return { enabled, title, description, source, tag, featured, layout, showSoldOut, sort }
}

/**
 * Custom CSS is owner-controlled, but it must not import remote styles or
 * execute script-era CSS. HTML injection is impossible because the layout sets
 * the CSS through a `<style>` element's textContent.
 */
export function sanitizeBlogCss (value) {
  let css = String(value || '')
  if (!css) return ''
  css = css.replace(/<\/?style/gi, '')
  css = css.replace(/@import\b[^;]*;?/gi, '')
  css = css.replace(/expression\s*\(/gi, '')
  css = css.replace(/javascript\s*:/gi, '')
  css = css.replace(/vbscript\s*:/gi, '')
  css = css.replace(/behavior\s*:/gi, '')
  css = css.replace(/-moz-binding\s*:/gi, '')
  css = css.replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, quote, url) => {
    const value = String(url || '').trim().replace(/["\\]/g, '')
    if (/^https:\/\//i.test(value) || /^\/(?!\/)/.test(value)) return 'url("' + value + '")'
    if (/^http:\/\//i.test(value)) return 'url("' + value.replace(/^http:/i, 'https:') + '")'
    return 'url("about:blank")'
  })
  return css.slice(0, BLOG_MAX_CSS)
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
    layout: 'grid',
    width: 'comfortable',
    typography: 'theme',
    hero: 'cover',
    showTags: true,
    showReadingTime: true,
    nav: [],
    blocks: defaultBlogBlocks(),
    css: '',
    logo: '',
    heroImage: '',
    favicon: '',
    portfolio: { enabled: false, title: 'Portfolio', description: '', layout: 'grid', items: [] },
    shop: defaultShopSettings(),
    vault: defaultVaultSettings(account),
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
    if (!BLOG_KEYS.includes(key)) warnings.push(key + ' is not a recognised blog field')
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

  const layout = enumValue(input.layout, LAYOUTS, 'layout', errors, 'grid')
  const width = enumValue(input.width, WIDTHS, 'width', errors, 'comfortable')
  const typography = enumValue(input.typography, TYPOGRAPHY, 'typography', errors, 'theme')
  const hero = enumValue(input.hero, HEROES, 'hero', errors, 'cover')
  const showTags = input.showTags !== false
  if (input.showTags !== undefined && typeof input.showTags !== 'boolean') errors.push('showTags must be a boolean')
  const showReadingTime = input.showReadingTime !== false
  if (input.showReadingTime !== undefined && typeof input.showReadingTime !== 'boolean') errors.push('showReadingTime must be a boolean')

  const blocks = normalizeBlocks(input.blocks, errors, warnings)
  const rawCss = input.css === undefined || input.css === null
    ? ''
    : readableText(input.css, { max: BLOG_MAX_CSS + 100 }, 'css', errors)
  const css = sanitizeBlogCss(rawCss)
  if (rawCss && css !== rawCss) {
    warnings.push('Some custom CSS rules were removed for safety (imports, non-https URLs or script-era expressions).')
  }
  const logo = normalizeHttpsUrl(input.logo, 'logo', errors)
  const heroImage = normalizeHttpsUrl(input.heroImage, 'heroImage', errors)
  const favicon = normalizeHttpsUrl(input.favicon, 'favicon', errors)
  const portfolio = normalizePortfolio(input.portfolio, errors, warnings)
  const shop = normalizeShop(input.shop, errors, warnings)
  const vaultResult = normalizeVaultSettings(
    input.vault === undefined ? defaultVaultSettings(account) : input.vault,
    { account }
  )
  errors.push(...vaultResult.errors)
  warnings.push(...vaultResult.warnings)
  const vault = vaultResult.settings

  const nav = normalizeNav(input.nav, errors, warnings)
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
    layout,
    width,
    typography,
    hero,
    showTags,
    showReadingTime,
    nav,
    blocks,
    css,
    logo,
    heroImage,
    favicon,
    portfolio,
    shop,
    vault,
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
