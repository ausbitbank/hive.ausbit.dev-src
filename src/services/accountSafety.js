// Warning-only account safety checks for the dashboard.
//
// There is no global Hive reputation authority, so this module only compares an
// account name against curated public warning lists that already ship with the
// moderation layer. It never ranks, scores or blocks an account: a match is a
// labelled warning with a source and a date, and no match is explicitly not a
// guarantee.
//
// This module is pure. The widget performs the cached list reads.

export const SAFETY_SOURCES = [
  {
    id: 'hive-blog-phishing',
    owner: 'hive.blog',
    type: 'mute',
    title: 'hive.blog phishing and hacked-account list',
    asOf: '2026-11-24',
    caution: 'Narrow phishing and compromised-account list.'
  },
  {
    id: 'plentyofphish',
    owner: 'plentyofphish',
    type: 'mute',
    title: 'Plenty of Phish source list',
    asOf: '2021-02-26',
    caution: 'Static since 2021; useful as a legacy phishing reference.'
  },
  {
    id: 'spaminator-blacklist',
    owner: 'spaminator',
    type: 'blacklist',
    title: 'Spaminator / Hivewatchers blacklist',
    asOf: '2023-03-05',
    caution: 'Legacy warning list with a documented appeal path.'
  }
]

export const DEFAULT_SAFETY_SOURCES = SAFETY_SOURCES.map(source => source.id)
export const MAX_SAFETY_SOURCES = 4

const NAME = /^[a-z0-9][a-z0-9.-]{1,15}$/

export function safetySourceById (id) {
  return SAFETY_SOURCES.find(source => source.id === id) || null
}

/** Keep only known source ids, in the catalogue's order. */
export function normaliseSafetySources (ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : [])
  return SAFETY_SOURCES
    .filter(source => wanted.has(source.id))
    .map(source => source.id)
    .slice(0, MAX_SAFETY_SOURCES)
}

function normaliseName (value) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase()
}

/**
 * Compare one account against the supplied list reads.
 *
 * `reads` is `[{ id, names, error }]`. A failed read is reported, never treated
 * as an empty list, and a match in any source outranks a partial failure.
 */
export function safetySummary ({ account = '', reads = [] } = {}) {
  const name = normaliseName(account)
  const rows = Array.isArray(reads) ? reads : []
  const matches = []
  const failures = []
  let checked = 0

  for (const read of rows) {
    const source = safetySourceById(read?.id)
    if (!source) continue
    if (read?.error) {
      failures.push({
        id: source.id,
        title: source.title,
        owner: source.owner,
        error: String(read.error)
      })
      continue
    }
    const names = Array.isArray(read?.names) ? read.names : []
    checked += 1
    if (!name) continue
    if (names.some(entry => normaliseName(typeof entry === 'string' ? entry : entry?.name) === name)) {
      matches.push({
        id: source.id,
        title: source.title,
        owner: source.owner,
        asOf: source.asOf,
        caution: source.caution
      })
    }
  }

  const total = rows.filter(read => safetySourceById(read?.id)).length
  const level = matches.length
    ? 'listed'
    : failures.length
      ? 'partial'
      : checked > 0
        ? 'clear'
        : 'unknown'

  const levelLabel = {
    listed: 'On a warning list',
    partial: 'Partial check',
    clear: 'No warning found',
    unknown: 'Not checked'
  }[level]

  return {
    account: name,
    validAccount: NAME.test(name),
    level,
    levelLabel,
    matches,
    failures,
    checked,
    total,
    hasWarnings: matches.length > 0,
    limitation: 'A warning is informational only. This widget never hides, downvotes or blocks an account, and no match is not a safety guarantee.'
  }
}

export default safetySummary
