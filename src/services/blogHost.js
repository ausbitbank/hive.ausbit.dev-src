// Host-based blog tenancy.
//
// A Hive account is served as a blog at `<label>.banksia.io`. Hive account
// names may contain dots, but a wildcard certificate only covers one label, so
// a dot is encoded as `--`. Hive forbids consecutive hyphens, which makes the
// mapping reversible and collision-free:
//
//   alice        -> alice.banksia.io
//   hive.fund    -> hive--fund.banksia.io
//
// The same helper is imported by the SPA and by the Cloudflare metadata Worker,
// so the browser and the edge always agree on which account a host serves.

import { BLOG_APEX_URL, BLOG_DOMAIN, BLOG_SETTINGS_PATH, RESERVED_BLOG_LABELS } from '../config/blog'

export { BLOG_APEX_URL, BLOG_DOMAIN, BLOG_SETTINGS_PATH }

// Matches the account-name shape used across the app and Hive itself.
const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
const SINGLE_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

// A permlink that is also a fixed blog route needs the /p/ fallback.
const BLOG_ROUTE_SLUGS = new Set([
  'about', 'contact', 'p', 'settings', 'shop', 'portfolio',
  'rss', 'rss.xml', 'sitemap.xml', 'robots.txt', 'csp-report',
  'manifest.webmanifest', 'sw.js', 'assets', 'statics'
])

const RESERVED = new Set(RESERVED_BLOG_LABELS)

/** Strip scheme, port, path and a trailing dot from a Host value. */
export function normalizeHostname (value) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
}

/** True for a syntactically valid Hive account name. */
export function isValidHiveAccountName (value) {
  if (typeof value !== 'string') return false
  const name = value.trim().toLowerCase()
  if (!HIVE_ACCOUNT_RE.test(name)) return false
  if (name.startsWith('-') || name.endsWith('-')) return false
  if (name.startsWith('.') || name.endsWith('.')) return false
  if (/--|\.\.|-\.|\.-/.test(name)) return false
  // Hive requires every dot-separated segment to be at least three characters.
  if (name.split('.').some(part => part.length < 3)) return false
  return true
}

/** Encode an account name as one DNS label. Returns '' when invalid. */
export function encodeBlogLabel (account) {
  const name = typeof account === 'string' ? account.trim().toLowerCase() : ''
  if (!isValidHiveAccountName(name)) return ''
  const label = name.replaceAll('.', '--')
  return SINGLE_LABEL_RE.test(label) ? label : ''
}

/** Decode one DNS label back to an account name. Returns '' when invalid. */
export function decodeBlogLabel (label) {
  const value = typeof label === 'string' ? label.trim().toLowerCase() : ''
  if (!value || !SINGLE_LABEL_RE.test(value)) return ''
  const account = value.replaceAll('--', '.')
  return isValidHiveAccountName(account) ? account : ''
}

export function isReservedBlogLabel (label) {
  return RESERVED.has(String(label || '').toLowerCase())
}

/**
 * Resolve a Host value to a blog tenant.
 *
 * @returns {{ mode: 'apex'|'blog'|'unsupported', host: string, label: string, account: string, reason: string }}
 */
export function resolveBlogHost (hostname, { domain = BLOG_DOMAIN, allowLocalhost = true } = {}) {
  const host = normalizeHostname(hostname)
  const baseDomain = String(domain || BLOG_DOMAIN).toLowerCase()
  if (!host) return { mode: 'apex', host, label: '', account: '', reason: '' }

  const apexHosts = new Set([
    baseDomain,
    'www.' + baseDomain,
    'hive.ausbit.dev',
    'www.hive.ausbit.dev',
    'localhost',
    '127.0.0.1',
    '[::1]'
  ])
  if (apexHosts.has(host)) return { mode: 'apex', host, label: '', account: '', reason: '' }

  const suffixes = [baseDomain]
  if (allowLocalhost) suffixes.push('localhost')

  for (const suffix of suffixes) {
    if (!host.endsWith('.' + suffix)) continue
    const label = host.slice(0, -(suffix.length + 1))
    if (label.includes('.')) return { mode: 'unsupported', host, label, account: '', reason: 'nested' }
    if (!SINGLE_LABEL_RE.test(label)) return { mode: 'unsupported', host, label, account: '', reason: 'invalid-label' }
    if (RESERVED.has(label)) return { mode: 'apex', host, label, account: '', reason: 'reserved' }
    const account = decodeBlogLabel(label)
    if (!account) return { mode: 'unsupported', host, label, account: '', reason: 'invalid-account' }
    return { mode: 'blog', host, label, account, reason: '' }
  }

  // Unknown hosts (including custom domains, which are not enabled yet) keep
  // the normal explorer behaviour rather than rendering an arbitrary blog.
  return { mode: 'apex', host, label: '', account: '', reason: 'unknown-host' }
}

/** Convenience wrapper: the blog account for a Host value, or ''. */
export function blogAccountFromHost (hostname, options) {
  return resolveBlogHost(hostname, options).account
}

/** The public origin for an account blog. Returns '' when the name is invalid. */
export function blogBaseUrl (account, { domain = BLOG_DOMAIN } = {}) {
  const label = encodeBlogLabel(account)
  return label ? 'https://' + label + '.' + String(domain || BLOG_DOMAIN).toLowerCase() : ''
}

/** True when a host is a first-level blog host (reserved or not). */
export function isBlogHostname (hostname, options) {
  return resolveBlogHost(hostname, options).mode === 'blog'
}

/** Root-relative path for a post on a blog host. */
export function blogPostPath (permlink) {
  const value = String(permlink || '').trim()
  return PERMLINK_RE.test(value) ? '/' + value : '/'
}

/**
 * Canonical blog path for a post. A contributor keeps the author in the path;
 * the owner uses the clean root URL. A permlink that collides with a blog route
 * (`about`, `contact`, `p`, `rss.xml`, …) uses the `/p/` fallback.
 */
export function blogPostPathFor (permlink, author = '', owner = '') {
  const value = String(permlink || '').trim()
  if (!PERMLINK_RE.test(value)) return '/'
  const postAuthor = String(author || '').trim().toLowerCase()
  const blogOwner = String(owner || '').trim().toLowerCase()
  if (postAuthor && blogOwner && postAuthor !== blogOwner) {
    return '/@' + postAuthor + '/' + value
  }
  return BLOG_ROUTE_SLUGS.has(value.toLowerCase()) || value.includes('.')
    ? '/p/' + value
    : '/' + value
}

/** A collision-proof fallback path for a permlink that is also a route name. */
export function blogPostFallbackPath (permlink) {
  const value = String(permlink || '').trim()
  return PERMLINK_RE.test(value) ? '/p/' + value : '/'
}

/** Canonical absolute URL for a blog post. */
export function blogPostUrl (account, permlink, { domain = BLOG_DOMAIN } = {}) {
  const base = blogBaseUrl(account, { domain })
  if (!base) return ''
  const path = blogPostPath(permlink)
  return path === '/' ? base + '/' : base + path
}

/** Apex settings/claim URL for an account. */
export function blogSettingsUrl (account) {
  const name = String(account || '').trim().toLowerCase()
  return BLOG_APEX_URL + BLOG_SETTINGS_PATH + (name ? '?account=' + encodeURIComponent(name) : '')
}

/** Apex account URL for the owning account. */
export function apexAccountUrl (account) {
  const name = String(account || '').trim().toLowerCase()
  return name ? BLOG_APEX_URL + '/@' + name : BLOG_APEX_URL
}

export function isHostname (value) {
  return HOSTNAME_RE.test(normalizeHostname(value))
}
