// Pure daily pick for the dashboard's community spotlight widget.
//
// The widget loads one page of `bridge.list_communities`, turns it into
// directory cards and hands the cards to this helper. The pick is stable for a
// calendar day (UTC) and changes on the next day, so every visitor sees the
// same community without a server-side cache.

import { cleanCommunityText } from './community'
import { communityNumber } from './communityDirectory'

const DAY_MS = 24 * 60 * 60 * 1000

function parseDate (value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : new Date()
}

/** UTC day of year, 1-based. Used as the deterministic rotation counter. */
export function utcDayOfYear (value = Date.now()) {
  const date = parseDate(value)
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((current - start) / DAY_MS) + 1
}

function buildCard (community) {
  const name = String(community?.name || '').trim()
  if (!name) return null
  return {
    name,
    title: cleanCommunityText(community.title) || name,
    about: cleanCommunityText(community.about),
    subscribers: communityNumber(community.subscribers),
    authors: communityNumber(community.authors ?? community.num_authors),
    pendingRewards: communityNumber(community.pendingRewards ?? community.sum_pending),
    link: '/c/' + encodeURIComponent(name),
    nsfw: Boolean(community.nsfw ?? community.is_nsfw)
  }
}

/**
 * Choose today's community from the supplied cards.
 *
 * NSFW communities are filtered out by default. When nothing remains the card
 * is null and `hasCard`/`hasData` are false, which the widget renders as an
 * empty state.
 */
export function communitySpotlightSummary ({
  communities = [],
  date = Date.now(),
  hideNsfw = true
} = {}) {
  const day = parseDate(date)
  const dayKey = day.toISOString().slice(0, 10)
  const cards = []

  for (const community of Array.isArray(communities) ? communities : []) {
    const card = buildCard(community)
    if (!card) continue
    if (hideNsfw && card.nsfw) continue
    cards.push(card)
  }

  if (!cards.length) {
    return {
      card: null,
      hasCard: false,
      hasData: false,
      candidates: 0,
      dayKey
    }
  }

  const index = utcDayOfYear(day) % cards.length
  return {
    card: cards[index],
    hasCard: true,
    hasData: true,
    candidates: cards.length,
    dayKey
  }
}
