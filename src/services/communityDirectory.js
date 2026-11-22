// Public community directory helpers.
//
// `bridge.list_communities` returns one page at a time and can sort by rank,
// newest or subscribers. Activity (active authors) has no server sort, so the
// directory sorts the pages it has loaded locally. Everything here is pure so
// the page can be tested without a node.

import { cleanCommunityText } from './community'

const TYPE_LABELS = {
  1: 'Topic',
  2: 'Journal',
  3: 'Council'
}

const TYPE_KEYS = {
  1: 'topic',
  2: 'journal',
  3: 'council'
}

// Category chips map to a title/about query. Hivemind only accepts one query
// string, so a category is a curated search rather than a fixed taxonomy.
export const COMMUNITY_CATEGORIES = [
  { value: 'art', label: 'Art & design', query: 'art' },
  { value: 'photography', label: 'Photography', query: 'photography' },
  { value: 'gaming', label: 'Gaming', query: 'gaming' },
  { value: 'music', label: 'Music', query: 'music' },
  { value: 'writing', label: 'Writing', query: 'writing' },
  { value: 'crypto', label: 'Crypto & finance', query: 'crypto' },
  { value: 'travel', label: 'Travel', query: 'travel' },
  { value: 'food', label: 'Food', query: 'food' },
  { value: 'health', label: 'Health', query: 'health' },
  { value: 'tech', label: 'Technology', query: 'technology' },
  { value: 'nature', label: 'Nature', query: 'nature' },
  { value: 'sports', label: 'Sports', query: 'sports' }
]

export const COMMUNITY_SORTS = [
  { value: 'rank', label: 'Trending', icon: 'local_fire_department' },
  { value: 'subs', label: 'Subscribers', icon: 'groups' },
  { value: 'active', label: 'Active authors', icon: 'edit_note' },
  { value: 'new', label: 'Newest', icon: 'fiber_new' }
]

export function communityNumber (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function isHiveCommunityName (value) {
  return /^hive-[1-9][0-9]{0,6}$/.test(String(value || '').trim().toLowerCase())
}

export function communityTypeLabel (record) {
  return TYPE_LABELS[Number(record?.type_id)] || 'Topic'
}

export function communityTypeKey (record) {
  return TYPE_KEYS[Number(record?.type_id)] || 'topic'
}

function createdAt (value) {
  if (!value) return 0
  const text = String(value).trim().replace(' ', 'T')
  const parsed = Date.parse(/[zZ]$|[+-][0-9]{2}:?[0-9]{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(parsed) ? parsed : 0
}

/** Normalise one bridge record into the card shape used by CommunityCard. */
export function buildDirectoryCard (record, index = 0) {
  if (!record || typeof record.name !== 'string' || !record.name) return null
  const name = record.name
  const type = communityTypeKey(record)
  return {
    name,
    title: cleanCommunityText(record.title) || name,
    about: cleanCommunityText(record.about),
    role: '',
    roleLabel: '',
    type,
    typeLabel: communityTypeLabel(record),
    subscribers: communityNumber(record.subscribers),
    authors: communityNumber(record.num_authors),
    pendingRewards: communityNumber(record.sum_pending),
    weeklyInteractions: communityNumber(record.num_pending),
    nsfw: Boolean(record.is_nsfw),
    restricted: type !== 'topic',
    known: true,
    lang: String(record.lang || '').trim().toLowerCase(),
    createdAt: createdAt(record.created_at),
    link: '/c/' + name + '/trending',
    order: index
  }
}

/** Build a de-duplicated page of directory cards, preserving server order. */
export function buildDirectoryCards (records, { aboutLength = 200 } = {}) {
  const seen = new Set()
  const cards = []
  for (const record of Array.isArray(records) ? records : []) {
    const card = buildDirectoryCard(record, cards.length)
    if (!card || seen.has(card.name)) continue
    seen.add(card.name)
    cards.push({ ...card, about: card.about.slice(0, aboutLength) })
  }
  return cards
}

export function directoryCategory (query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return null
  return COMMUNITY_CATEGORIES.find(category => category.query === needle) || null
}

/**
 * Local sort for loaded results. Rank keeps the server's order, so it is left
 * untouched; active authors, subscribers and creation time sort client-side.
 */
export function sortDirectoryCards (cards, sort = 'rank') {
  const list = Array.isArray(cards) ? [...cards] : []
  if (sort === 'subs') {
    return list.sort((a, b) =>
      b.subscribers - a.subscribers ||
      b.authors - a.authors ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
    )
  }
  if (sort === 'active') {
    return list.sort((a, b) =>
      b.authors - a.authors ||
      b.subscribers - a.subscribers ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
    )
  }
  if (sort === 'new') {
    return list.sort((a, b) =>
      b.createdAt - a.createdAt ||
      b.subscribers - a.subscribers ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
    )
  }
  return list
}

export function summarizeDirectory (cards) {
  const summary = {
    communities: 0,
    subscribers: 0,
    authors: 0,
    pendingRewards: 0,
    nsfw: 0
  }
  for (const card of Array.isArray(cards) ? cards : []) {
    summary.communities += 1
    summary.subscribers += card.subscribers
    summary.authors += card.authors
    summary.pendingRewards += card.pendingRewards
    if (card.nsfw) summary.nsfw += 1
  }
  return summary
}
