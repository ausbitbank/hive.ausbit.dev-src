// Turn a Hive listing path into a feed descriptor.
//
// Dashboard post widgets accept the same paths people already use around the
// site — `/@ausbitbank/feed`, `/c/hive-dev`, `/shorts/threads`, `/trending` or
// a bare tag — and the card header describes what the widget is actually
// showing. Everything here is pure so the parsing and the header copy can be
// unit tested without touching the network.

import { getShortFormat } from './shortForm'
import { hiveAvatarUrl } from 'src/utils/avatar'

export const DEFAULT_RANKED_SORT = 'trending'
export const DEFAULT_ACCOUNT_SORT = 'blog'
export const DEFAULT_SHORT_FORMAT = 'threads'

export const RANKED_FEED_SORTS = [
  { value: 'trending', label: 'Trending' },
  { value: 'created', label: 'New' },
  { value: 'hot', label: 'Hot' },
  { value: 'payout', label: 'Top payout' },
  { value: 'payout_comments', label: 'Top comments' },
  { value: 'muted', label: 'Muted' }
]

export const ACCOUNT_FEED_SORTS = [
  { value: 'blog', label: 'Blog', hint: 'Posts @account wrote or reblogged.' },
  { value: 'posts', label: 'Posts', hint: 'Top-level posts only.' },
  { value: 'feed', label: 'Feed', hint: 'Posts from accounts @account follows.' },
  { value: 'replies', label: 'Replies', hint: 'Replies @account has written.' },
  { value: 'comments', label: 'Comments', hint: 'Comments @account has written.' }
]

const RANKED_SORT_LABELS = Object.fromEntries(RANKED_FEED_SORTS.map(entry => [entry.value, entry.label]))
const ACCOUNT_SORT_LABELS = Object.fromEntries(ACCOUNT_FEED_SORTS.map(entry => [entry.value, entry.label]))
const ACCOUNT_SORT_VALUES = new Set(ACCOUNT_FEED_SORTS.map(entry => entry.value))

export const FEED_REFERENCE_PLACEHOLDER = '/@ausbitbank/feed, /c/hive-dev, /shorts/threads'

/**
 * Header copy for a feed. Community feeds carry a numeric `hive-xxxxx` name on
 * the chain, but readers know the community by its display title. `community`
 * is the `bridge.get_community` record (or null while it loads/fails); until it
 * arrives the descriptor's `#hive-xxxxx` heading is the honest fallback.
 */
export function feedHeader (feed, community = null) {
  if (!feed) return { eyebrow: '', heading: '' }
  const title = feed.kind === 'community' ? String(community?.title || '').trim() : ''
  return {
    eyebrow: feed.eyebrow,
    heading: title || feed.heading
  }
}

/** Avatar for a community feed, or '' for every other feed kind. */
export function feedAvatar (feed) {
  return feed && feed.kind === 'community' && feed.community
    ? hiveAvatarUrl(feed.community)
    : ''
}

/** Trim a pasted URL or path down to the part the parser understands. */
export function normaliseFeedReference (value) {
  let text = String(value ?? '').trim()
  if (!text) return ''
  text = text.replace(/^https?:\/\/[^/]+/i, '')
  // A leading # marks a tag; a # later in a path is a fragment to drop.
  const hash = text.indexOf('#')
  if (hash > 0) text = text.slice(0, hash)
  text = text.split('?')[0].trim()
  return text.replace(/\/+$/, '')
}

export function normaliseAccount (value) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase()
}

export function normaliseTag (value) {
  return String(value ?? '').trim().replace(/^[#/]+/, '').toLowerCase()
}

export function normaliseRankedSort (value) {
  return RANKED_SORT_LABELS[value] ? value : DEFAULT_RANKED_SORT
}

export function normaliseAccountSort (value) {
  return ACCOUNT_SORT_VALUES.has(value) ? value : DEFAULT_ACCOUNT_SORT
}

function accountFeed (account, sort) {
  const label = ACCOUNT_SORT_LABELS[sort] || ACCOUNT_SORT_LABELS[DEFAULT_ACCOUNT_SORT]
  return {
    kind: 'account',
    method: 'account',
    account,
    sort,
    tag: '',
    key: 'account:' + account + ':' + sort,
    eyebrow: label,
    heading: '@' + account,
    link: '/@' + account + '/' + sort,
    linkLabel: label,
    sortable: false
  }
}

function communityFeed (community, sort) {
  const label = RANKED_SORT_LABELS[sort] || RANKED_SORT_LABELS[DEFAULT_RANKED_SORT]
  return {
    kind: 'community',
    method: 'ranked',
    sort,
    community,
    tag: community,
    key: 'community:' + community + ':' + sort,
    eyebrow: 'Community · ' + label,
    heading: '#' + community,
    link: '/c/' + community,
    linkLabel: 'Community',
    sortable: true
  }
}

function tagFeed (tag, sort) {
  const label = RANKED_SORT_LABELS[sort] || RANKED_SORT_LABELS[DEFAULT_RANKED_SORT]
  return {
    kind: 'tag',
    method: 'ranked',
    sort,
    tag,
    key: 'tag:' + tag + ':' + sort,
    eyebrow: 'Tag · ' + label,
    heading: '#' + tag,
    link: '/' + sort + '/' + tag,
    linkLabel: 'Tag',
    sortable: true
  }
}

function globalFeed (sort) {
  const label = RANKED_SORT_LABELS[sort] || RANKED_SORT_LABELS[DEFAULT_RANKED_SORT]
  return {
    kind: 'global',
    method: 'ranked',
    sort,
    tag: '',
    key: 'global:' + sort,
    eyebrow: 'Across Hive',
    heading: label + ' on Hive',
    link: '/' + sort,
    linkLabel: 'Hive',
    sortable: true
  }
}

function shortFeed (formatId) {
  const format = getShortFormat(formatId) || getShortFormat(DEFAULT_SHORT_FORMAT)
  return {
    kind: 'short',
    method: 'short',
    shortFormat: format.id,
    sort: 'new',
    tag: '',
    key: 'short:' + format.id,
    eyebrow: 'Short posts · ' + format.app,
    heading: format.label,
    link: '/shorts/' + format.id,
    linkLabel: 'Shorts',
    sortable: false
  }
}

function applyMe (feed, loggedInUser) {
  const account = normaliseAccount(loggedInUser)
  if (!account || feed.kind !== 'account' || feed.account !== 'me') return feed
  return accountFeed(account, feed.sort)
}

/**
 * Parse a listing path. Returns a descriptor, or `null` when the text is not a
 * recognised Hive path/tag. `sort` is only used for references that do not
 * carry one themselves (a bare tag, `/c/community` or `/shorts`).
 */
export function parseFeedReference (reference, { sort = DEFAULT_RANKED_SORT } = {}) {
  const text = normaliseFeedReference(reference)
  if (!text) return null

  const short = text.match(/^\/?(?:shorts?|short-form)(?:\/([a-z][a-z0-9-]*))?$/i)
  if (short) {
    const format = short[1] ? short[1].toLowerCase() : DEFAULT_SHORT_FORMAT
    if (short[1] && !getShortFormat(format)) return null
    return shortFeed(format)
  }

  const account = text.match(/^\/?@([a-z][a-z0-9.-]{0,15})(?:\/([a-z_]+))?$/i)
  if (account) {
    const requested = account[2] ? account[2].toLowerCase() : DEFAULT_ACCOUNT_SORT
    if (!ACCOUNT_SORT_VALUES.has(requested)) return null
    return accountFeed(account[1].toLowerCase(), requested)
  }

  // Also accept `ausbitbank/feed` without the @, which is how people often
  // paste a profile sub-page.
  const bareAccount = text.match(/^([a-z][a-z0-9.-]{2,15})\/([a-z_]+)$/i)
  if (bareAccount && ACCOUNT_SORT_VALUES.has(bareAccount[2].toLowerCase())) {
    return accountFeed(bareAccount[1].toLowerCase(), bareAccount[2].toLowerCase())
  }

  const community = text.match(/^\/?c\/([a-z0-9][a-z0-9-]*)(?:\/([a-z_]+))?$/i)
  if (community) {
    const requested = community[2] ? community[2].toLowerCase() : normaliseRankedSort(sort)
    if (community[2] && !RANKED_SORT_LABELS[requested]) return null
    return communityFeed(community[1].toLowerCase(), requested)
  }

  const ranked = text.match(/^\/?([a-z_]+)(?:\/([a-z0-9][a-z0-9-]*))?$/i)
  if (ranked && RANKED_SORT_LABELS[ranked[1].toLowerCase()]) {
    const rankedSort = ranked[1].toLowerCase()
    return ranked[2] ? tagFeed(ranked[2].toLowerCase(), rankedSort) : globalFeed(rankedSort)
  }

  const tag = normaliseTag(text)
  if (/^[a-z0-9][a-z0-9-]*$/.test(tag)) return tagFeed(tag, normaliseRankedSort(sort))
  return null
}

/**
 * Feed for the "Posts on Hive" widget: a reference wins, then a community or
 * tag, then the global sort.
 */
export function resolvePostsFeed ({ reference = '', source = DEFAULT_RANKED_SORT, tag = '' } = {}, { loggedInUser = '' } = {}) {
  const sort = normaliseRankedSort(source)
  const parsed = parseFeedReference(reference, { sort })
  if (parsed) return applyMe(parsed, loggedInUser)
  const cleanTag = normaliseTag(tag)
  if (cleanTag) return tagFeed(cleanTag, sort)
  return globalFeed(sort)
}

/**
 * Feed for the "Account posts" widget. A reference can point anywhere; without
 * one the account and feed type build an account descriptor.
 */
export function resolveAccountFeed ({ reference = '', account = '', sort = DEFAULT_ACCOUNT_SORT } = {}, { loggedInUser = '', fallbackAccount = '' } = {}) {
  const parsed = parseFeedReference(reference, { sort: DEFAULT_RANKED_SORT })
  if (parsed) return applyMe(parsed, loggedInUser)
  const name = normaliseAccount(account || loggedInUser || fallbackAccount)
  return applyMe(accountFeed(name, normaliseAccountSort(sort)), loggedInUser)
}
