// Composer community-picker helpers.
//
// Hivemind returns subscriptions as short rows: [name, title, role, guestTitle].
// The picker merges those rows with recent destinations and cached community
// records so the composer can show a title, avatar and subscriber count without
// treating a free-form tag as a community.

import { normalizeTag } from './drafts'

const COMMUNITY_RE = /^[a-z][a-z0-9.-]{2,15}$/

/** Normalise strings, tuples and objects into `{ name, title, role }` rows. */
export function normalizeSubscriptionRows (subscriptions) {
  const rows = []
  for (const item of Array.isArray(subscriptions) ? subscriptions : []) {
    let name = ''
    let title = ''
    let role = ''
    if (typeof item === 'string') {
      name = item
    } else if (Array.isArray(item)) {
      name = item[0]
      title = item[1]
      role = item[2]
    } else if (item && typeof item === 'object') {
      name = item.name
      title = item.title
      role = item.role
    }
    const tag = normalizeTag(name)
    if (!tag) continue
    rows.push({
      name: tag,
      title: String(title || '').trim() || tag,
      role: String(role || '').trim().toLowerCase()
    })
  }
  return rows
}

export function subscribedCommunityNames (subscriptions) {
  return new Set(normalizeSubscriptionRows(subscriptions).map(row => row.name))
}

export function communityAvatarUrl (name, owner = null) {
  const tag = String(name || '').trim().toLowerCase()
  if (COMMUNITY_RE.test(tag)) return 'https://images.hive.blog/u/' + tag + '/avatar'
  const account = String(owner || '').trim().toLowerCase()
  return COMMUNITY_RE.test(account) ? 'https://images.hive.blog/u/' + account + '/avatar' : ''
}

/** The community About tab renders the rules text. */
export function communityRulesLink (name) {
  const tag = normalizeTag(name)
  return tag ? '/c/' + tag + '?tab=about' : ''
}

function infoFor (info, name) {
  if (!info || typeof info !== 'object') return null
  return info[name] || null
}

/**
 * Build q-select options. "My blog" stays first, the current destination comes
 * next, then subscribed communities (most subscribers first), recent
 * destinations and finally cached community records.
 */
export function buildCommunityPickerOptions ({
  subscriptions = [],
  recent = [],
  info = {},
  selected = '',
  owner = null
} = {}) {
  const rows = normalizeSubscriptionRows(subscriptions)
  const subscribedNames = new Set(rows.map(row => row.name))
  const recentNames = new Set(
    (Array.isArray(recent) ? recent : []).map(value => normalizeTag(value)).filter(Boolean)
  )
  const selectedTag = normalizeTag(selected)
  const options = new Map()

  const add = ({ name, title = '', record = null, subscribed = false, isRecent = false }) => {
    const tag = normalizeTag(name)
    if (!tag) return
    const existing = options.get(tag) || {}
    const community = record || infoFor(info, tag)
    const finalTitle = String(community?.title || title || existing.title || '').trim() || tag
    options.set(tag, {
      value: tag,
      name: tag,
      label: finalTitle + ' · ' + tag,
      title: finalTitle,
      avatar: communityAvatarUrl(tag),
      subscribers: Number(community?.subscribers) || Number(existing.subscribers) || 0,
      about: String(community?.about || existing.about || '').trim(),
      subscribed: Boolean(subscribed || existing.subscribed || subscribedNames.has(tag)),
      recent: Boolean(isRecent || existing.recent),
      rulesLink: communityRulesLink(tag),
      isBlog: false
    })
  }

  options.set('', {
    value: '',
    name: '',
    label: 'My blog (no community)',
    title: 'My blog',
    avatar: communityAvatarUrl('', owner),
    subscribers: 0,
    about: '',
    subscribed: false,
    recent: false,
    rulesLink: '',
    isBlog: true
  })

  for (const row of rows) add({ ...row, subscribed: true })
  for (const name of recentNames) add({ name, isRecent: true })
  for (const [name, record] of Object.entries(info && typeof info === 'object' ? info : {})) {
    if (record && record.name) add({ name: record.name, title: record.title, record })
    else add({ name, record })
  }
  if (selectedTag) add({ name: selectedTag })

  return [...options.values()].sort((a, b) => {
    if (a.isBlog) return -1
    if (b.isBlog) return 1
    if (selectedTag) {
      if (a.value === selectedTag) return -1
      if (b.value === selectedTag) return 1
    }
    return Number(b.subscribed) - Number(a.subscribed) ||
      b.subscribers - a.subscribers ||
      Number(b.recent) - Number(a.recent) ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
  })
}

/** True when a non-empty community is outside the account's subscriptions. */
export function isOutsideSubscriptions (name, subscriptions) {
  const tag = normalizeTag(name)
  if (!tag) return false
  return !subscribedCommunityNames(subscriptions).has(tag)
}

/** Case-insensitive title, name or #tag search for the picker. */
export function filterCommunityOptions (options, query) {
  const text = String(query || '').trim().replace(/^#/, '').toLowerCase()
  if (!text) return options
  return (Array.isArray(options) ? options : []).filter(option => {
    const label = String(option?.label || '').toLowerCase()
    const name = String(option?.name || '').toLowerCase()
    const title = String(option?.title || '').toLowerCase()
    return label.includes(text) || name.includes(text) || title.includes(text)
  })
}

/** Advisory copy for posting in an unsubscribed community. */
export function communitySubscriptionWarning (name, {
  subscriptions = [],
  owner = null,
  loaded = true
} = {}) {
  const tag = normalizeTag(name)
  if (!tag || !owner || !loaded) return ''
  if (!isOutsideSubscriptions(tag, subscriptions)) return ''
  return 'You are posting in #' + tag +
    ', which is not one of your subscribed communities. Check its rules before publishing.'
}


