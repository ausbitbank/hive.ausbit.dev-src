// Cached, fail-open badge client for PeakD and HiveBuzz.
//
// PeakD has no browser-safe public badge API. A profile shelf does not need to
// enumerate every badge: the theme already stores up to six badge account
// names, so each is confirmed directly with
// `bridge.get_relationship_between_accounts(badge, account)`. That is one
// small Hive read per selected badge, cached for an hour.
//
// The Studio picker is different: it needs every earned badge, so it paginates
// the public `condenser_api.get_followers` list and keeps `badge-######`
// accounts. That scan runs only while the author is editing a skin.
//
// HiveBuzz is CORS-enabled but throttled: one badges request and one level
// image per account, cached for an hour. Every failure resolves to an empty
// list so a profile never blocks on badges.

import { fetchAccounts } from './chainData'
import { apiGetFollowers, bridgeRequest } from './api'
import { credentialFor } from 'src/data/badges/credentials'
import { stripHtml } from 'src/utils/safeHtml'

export const BADGE_CACHE_TTL = 60 * 60 * 1000
export const HIVEBUZZ_API = 'https://hivebuzz.me/api'
export const HIVE_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/
export const PEAKD_BADGE_RE = /^badge-\d{6}$/
export const PEAKD_FOLLOWER_PAGE_SIZE = 1000
// A Studio-only safety bound. Normal accounts finish long before this.
export const PEAKD_MAX_FOLLOWER_PAGES = 100
export const BADGE_IMAGE_HOSTS = [
  'images.hive.blog',
  'files.peakd.com',
  'hivebuzz.me',
  'cdn.steemitimages.com',
  'cdn.discordapp.com',
  'media.discordapp.net'
]

const cache = new Map()
const inflight = new Map()

export function clearBadgeCache () {
  cache.clear()
  inflight.clear()
}

function normalizeAccount (value) {
  const name = String(value || '').trim().toLowerCase()
  return HIVE_ACCOUNT_RE.test(name) ? name : ''
}

function cacheGet (key, { force = false } = {}) {
  if (force) return null
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > BADGE_CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function cacheSet (key, value) {
  cache.set(key, { at: Date.now(), value })
  return value
}

function load (key, fetcher, { force = false, fallback = [] } = {}) {
  if (force) cache.delete(key)
  const cached = cacheGet(key, { force })
  if (cached !== null) return Promise.resolve(cached)
  if (inflight.has(key)) return inflight.get(key)
  const promise = Promise.resolve()
    .then(fetcher)
    .then(value => cacheSet(key, value))
    .catch(() => fallback)
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

async function fetchJson (url, { timeout = 4000, signal = null } = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null
  const abort = () => controller?.abort()
  if (signal) {
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller?.signal
    })
    if (!response.ok) throw new Error('Badge request failed with ' + response.status)
    return await response.json()
  } finally {
    if (timer) clearTimeout(timer)
    signal?.removeEventListener?.('abort', abort)
  }
}

export function isSafeBadgeImage (value) {
  if (typeof value !== 'string' || value.length > 500) return false
  if (!/^https:\/\//i.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && BADGE_IMAGE_HOSTS.includes(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function plainText (value, max) {
  return stripHtml(value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function badgeKind (title, credential) {
  if (credential) return 'credential'
  if (/witness|developer|\bdev\b|curator|founder/i.test(title)) return 'role'
  return 'achievement'
}

function badgeImage (value) {
  if (Array.isArray(value)) return value.find(isSafeBadgeImage) || ''
  return isSafeBadgeImage(value) ? value : ''
}

function peakdBadge (account) {
  if (!account?.name || !PEAKD_BADGE_RE.test(account.name)) return null
  let metadata
  try {
    metadata = typeof account.posting_json_metadata === 'string'
      ? JSON.parse(account.posting_json_metadata)
      : (account.posting_json_metadata || {})
  } catch {
    metadata = {}
  }
  const profile = metadata?.profile && typeof metadata.profile === 'object' ? metadata.profile : {}
  const title = plainText(profile.name, 80)
  const image = badgeImage(profile.profile_image)
  if (!title || !image) return null
  const credential = credentialFor('peakd', account.name)
  const description = plainText(profile.about, 320)
  return {
    source: 'peakd',
    id: account.name,
    title: credential?.title || title,
    issuer: credential?.issuer || 'PeakD',
    description,
    image,
    url: 'https://peakd.com/b/' + account.name,
    kind: badgeKind(title, credential),
    verified: Boolean(credential)
  }
}

function followersBadgeNames (rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map(row => (typeof row === 'string' ? row : row?.follower))
    .filter(name => typeof name === 'string' && PEAKD_BADGE_RE.test(name))
}

/**
 * Full follower pagination, only used by the Studio picker. The profile shelf
 * never calls this: it confirms the selected badge accounts directly.
 */
async function scanPeakdBadgeNames (account) {
  const names = []
  const seen = new Set()
  let start = ''
  for (let page = 0; page < PEAKD_MAX_FOLLOWER_PAGES; page += 1) {
    let rows
    try {
      rows = await apiGetFollowers(account, start, PEAKD_FOLLOWER_PAGE_SIZE)
    } catch {
      break
    }
    if (!Array.isArray(rows) || rows.length === 0) break
    for (const name of followersBadgeNames(rows)) {
      if (!seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
    if (rows.length < PEAKD_FOLLOWER_PAGE_SIZE) break
    const last = rows[rows.length - 1]
    const cursor = typeof last === 'string' ? last : last?.follower
    if (!cursor || cursor === start) break
    start = cursor
  }
  return names.slice(0, 200)
}

export function fetchPeakdBadgeAccountNames (account, { force = false } = {}) {
  const name = normalizeAccount(account)
  if (!name) return Promise.resolve([])
  return load('peakd:badge-accounts:' + name, () => scanPeakdBadgeNames(name), { force })
}

/**
 * Confirm one selected badge account still follows the profile owner.
 * `bridge.get_relationship_between_accounts(badge, account).follows` is the
 * direct chain answer, so no follower list is needed on profile views.
 */
export function checkPeakdMembership (badgeAccount, account, { force = false } = {}) {
  const badge = normalizeAccount(badgeAccount)
  const name = normalizeAccount(account)
  if (!badge || !name || !PEAKD_BADGE_RE.test(badge)) return Promise.resolve(false)
  return load('peakd:membership:' + badge + ':' + name, async () => {
    const relationship = await bridgeRequest('get_relationship_between_accounts', [badge, name])
    return relationship?.follows === true
  }, { force, fallback: false })
}

async function fetchSelectedPeakdBadges (account, selected, { force = false, signal = null } = {}) {
  const names = [...new Set(
    (Array.isArray(selected) ? selected : [])
      .filter(item => item?.source === 'peakd')
      .map(item => String(item.id || '').toLowerCase())
      .filter(name => PEAKD_BADGE_RE.test(name))
  )].slice(0, 6)
  if (!names.length) return []
  const confirmed = []
  const results = await Promise.allSettled(names.map(name => checkPeakdMembership(name, account, { force })))
  for (let index = 0; index < names.length; index += 1) {
    if (results[index].status === 'fulfilled' && results[index].value === true) confirmed.push(names[index])
  }
  if (signal?.aborted || !confirmed.length) return []
  try {
    const accounts = await fetchAccounts(confirmed, { force })
    return accounts.map(peakdBadge).filter(Boolean)
  } catch {
    return []
  }
}

/** Every earned PeakD badge, for the Studio picker only. */
export async function fetchPeakdBadges (account, { force = false, signal = null } = {}) {
  const names = await fetchPeakdBadgeAccountNames(account, { force })
  if (!names.length) return []
  try {
    const accounts = await fetchAccounts(names, { force })
    if (signal?.aborted) return []
    return accounts.map(peakdBadge).filter(Boolean)
  } catch {
    return []
  }
}

function hivebuzzBadge (account, item) {
  if (!item) return null
  const id = String(item.id || item.name || '').trim()
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id)) return null
  const title = plainText(item.title || item.name || id, 80)
  if (!title) return null
  const image = badgeImage(item.url || item.image)
  if (!image) return null
  const credential = credentialFor('hivebuzz', id)
  return {
    source: 'hivebuzz',
    id,
    title: credential?.title || title,
    issuer: credential?.issuer || 'HiveBuzz',
    description: plainText(item.description || item.description_title, 320),
    image,
    url: 'https://hivebuzz.me/@' + account,
    kind: badgeKind(title, credential),
    verified: Boolean(credential),
    earned: item.state === 'on'
  }
}

export function fetchHiveBuzzCatalog (account, { force = false } = {}) {
  const name = normalizeAccount(account)
  if (!name) return Promise.resolve([])
  return load('hivebuzz:badges:' + name, async () => {
    try {
      const payload = await fetchJson(HIVEBUZZ_API + '/badges/' + encodeURIComponent(name))
      const rows = Array.isArray(payload) ? payload : payload?.badges
      if (!Array.isArray(rows)) return []
      return rows.map(item => hivebuzzBadge(name, item)).filter(Boolean)
    } catch {
      return []
    }
  }, { force })
}

export async function fetchHiveBuzzBadges (account, { force = false } = {}) {
  const catalog = await fetchHiveBuzzCatalog(account, { force })
  return catalog.filter(badge => badge.earned)
}

export function hivebuzzLevelBadge (account) {
  const name = normalizeAccount(account)
  if (!name) return null
  return {
    source: 'hivebuzz',
    id: 'level',
    title: 'HiveBuzz level',
    issuer: 'HiveBuzz',
    description: 'HiveBuzz level for @' + name + '.',
    image: HIVEBUZZ_API + '/level/' + encodeURIComponent(name),
    url: 'https://hivebuzz.me/@' + name,
    kind: 'achievement',
    verified: false
  }
}

export function badgeKey (badge) {
  return badge?.source && badge?.id ? badge.source + ':' + badge.id : ''
}

/**
 * Resolve the author's selected badges. Missing or failed lookups are simply
 * omitted; the shelf hides itself when nothing resolves.
 */
export async function resolveProfileBadges (theme, account, { force = false, signal = null } = {}) {
  const name = normalizeAccount(account)
  if (!name) return []
  const selected = Array.isArray(theme?.profile?.badges?.selected)
    ? theme.profile.badges.selected.slice(0, 6)
    : []
  const showLevel = theme?.profile?.badges?.showLevel !== false
  if (!selected.length && !showLevel) return []

  const needsPeakd = selected.some(item => item.source === 'peakd')
  const needsHivebuzz = showLevel || selected.some(item => item.source === 'hivebuzz')
  const [peakd, hivebuzz] = await Promise.allSettled([
    needsPeakd ? fetchSelectedPeakdBadges(name, selected, { force, signal }) : Promise.resolve([]),
    needsHivebuzz ? fetchHiveBuzzBadges(name, { force }) : Promise.resolve([])
  ])
  if (signal?.aborted) return []
  const catalog = new Map()
  for (const badge of [...(peakd.status === 'fulfilled' ? peakd.value : []), ...(hivebuzz.status === 'fulfilled' ? hivebuzz.value : [])]) {
    const key = badgeKey(badge)
    if (key) catalog.set(key, badge)
  }
  const resolved = []
  if (showLevel && hivebuzz.status === 'fulfilled') {
    const level = hivebuzzLevelBadge(name)
    if (level) resolved.push(level)
  }
  for (const item of selected) {
    const badge = catalog.get(item.source + ':' + item.id)
    if (badge) resolved.push(badge)
  }
  return resolved
}

/** Every earned badge for the Studio picker, with the level kept separate. */
export async function fetchBadgeSuggestions (account, { force = false, onUpdate = null } = {}) {
  const name = normalizeAccount(account)
  if (!name) return { peakd: [], hivebuzz: [], level: null }
  const emit = patch => {
    if (typeof onUpdate === 'function') onUpdate(patch)
  }
  const [peakd, hivebuzz] = await Promise.all([
    fetchPeakdBadges(name, { force }).then(value => {
      emit({ peakd: value })
      return value
    }),
    fetchHiveBuzzCatalog(name, { force }).then(value => {
      emit({ hivebuzz: value, level: hivebuzzLevelBadge(name) })
      return value
    })
  ])
  return {
    peakd,
    hivebuzz,
    level: hivebuzzLevelBadge(name)
  }
}

/** Normalised shape helper for tests and UI copy. */
export function normalizeBadge (badge) {
  if (!badge || !badge.source || !badge.id) return null
  return {
    source: badge.source,
    id: badge.id,
    title: plainText(badge.title, 80),
    issuer: plainText(badge.issuer, 40) || (badge.source === 'peakd' ? 'PeakD' : 'HiveBuzz'),
    description: plainText(badge.description, 320),
    image: badgeImage(badge.image),
    url: typeof badge.url === 'string' && /^https:\/\//.test(badge.url) ? badge.url : '',
    kind: ['credential', 'achievement', 'role', 'activity'].includes(badge.kind) ? badge.kind : 'achievement',
    verified: badge.verified === true,
    earned: badge.earned !== false
  }
}
