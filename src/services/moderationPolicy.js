// Pure moderation decisions.
//
// This module has no Vue, Pinia, storage or network imports. It turns chain
// facts and local overrides into a single explainable decision so the UI only
// has to render the result. W71 uses `decideSkin`; Phase 1 will add content
// decisions without changing this contract.
//
// The skin rule is deliberately fail-closed: if identity, reputation or the
// viewer's mute state cannot be proven, a custom skin does not apply.

export const MODERATION_PRESETS = ['open', 'balanced', 'strict', 'follow-only', 'custom']

export const SKIN_DECISION = {
  ALLOWED: 'allowed',
  VIEWER_SHOW: 'viewer-show',
  FOLLOWED_OVERRIDE: 'followed-override',
  VIEWER_HIDE: 'viewer-hide',
  PERSONAL_MUTE: 'personal-mute',
  NEGATIVE_REPUTATION: 'negative-reputation',
  REPUTATION_UNAVAILABLE: 'reputation-unavailable',
  FOLLOWED_MUTE_LIST: 'followed-mute-list',
  CONTEXT_UNAVAILABLE: 'context-unavailable',
  AUTHOR_UNAVAILABLE: 'author-unavailable'
}

export const SKIN_DEFAULT_SETTINGS = {
  blockMuted: true,
  blockNegativeReputation: true,
  // Following an account is treated as trusting it enough to beat a
  // subscribed mute list. Negative reputation is a separate, explicit trust
  // choice and stays blocked by default.
  followedMuteListOverride: true,
  followedReputationOverride: false
}

const MAX_NAME_LENGTH = 16

export function normalizeName (value) {
  return String(value ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .slice(0, MAX_NAME_LENGTH)
}

/**
 * Convert raw chain reputation (scaled by 1e9) or an already-displayed score
 * into the familiar display score.
 *
 * Returns `null` for missing/non-finite input. This is intentionally different
 * from `formatReputation()`, which returns `"25"` for missing values and would
 * let an unknown reputation pass a safety gate.
 */
export function displayedReputation (value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  if (numeric === 0) return 25
  if (Math.abs(numeric) > 1e9) {
    const score = Math.log10(Math.abs(numeric) / 1e9) * 9 + 25
    if (!Number.isFinite(score)) return null
    const rounded = Math.round(score)
    return numeric < 0 ? -Math.max(1, Math.abs(rounded)) : Math.max(25, rounded)
  }
  return numeric
}

export function includesName (list, name) {
  if (!list || !name) return false
  if (typeof list.has === 'function') return list.has(name)
  if (Array.isArray(list)) return list.some(item => normalizeName(item) === name)
  return false
}

export function normalizeList (value) {
  if (!value) return []
  const list = typeof value.values === 'function' ? [...value.values()] : value
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const name = normalizeName(item && typeof item === 'object' ? item.name : item)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

export function listHits (lists, author) {
  if (!Array.isArray(lists)) return []
  const owners = []
  for (const list of lists) {
    if (!list || typeof list !== 'object') continue
    const owner = normalizeName(list.owner)
    if (!owner) continue
    if (!includesName(list.members, author)) continue
    if (!owners.includes(owner)) owners.push(owner)
  }
  return owners
}

function decision (code, allowed, { author, reputation, owners = [], followed = false, detail = '' } = {}) {
  const base = {
    code,
    allowed,
    author,
    reputation,
    followed,
    owners,
    detail
  }
  switch (code) {
    case SKIN_DECISION.VIEWER_SHOW:
      return {
        ...base,
        label: 'Skin shown by your local override',
        overrides: ['clear-override', 'manage']
      }
    case SKIN_DECISION.FOLLOWED_OVERRIDE:
      return {
        ...base,
        label: owners.length
          ? 'Skin shown because you follow @' + author + '; they are on @' + owners[0] + "'s mute list"
          : 'Skin shown because you follow @' + author,
        conflict: owners.length ? { kind: 'follow-vs-mutelist', owners } : null,
        overrides: ['hide-author', 'manage']
      }
    case SKIN_DECISION.VIEWER_HIDE:
      return {
        ...base,
        label: 'Skin hidden by you',
        overrides: ['show-author', 'manage']
      }
    case SKIN_DECISION.PERSONAL_MUTE:
      return {
        ...base,
        label: 'Skin hidden: you mute @' + author,
        overrides: ['show-author', 'manage']
      }
    case SKIN_DECISION.NEGATIVE_REPUTATION:
      return {
        ...base,
        label: 'Skin hidden: @' + author + ' has negative reputation',
        overrides: ['show-author', 'followed-override', 'manage']
      }
    case SKIN_DECISION.REPUTATION_UNAVAILABLE:
      return {
        ...base,
        label: 'Skin hidden: @' + author + "'s reputation could not be checked",
        overrides: ['show-author', 'manage']
      }
    case SKIN_DECISION.FOLLOWED_MUTE_LIST:
      return {
        ...base,
        label: 'Skin hidden: @' + author + ' is on @' + (owners[0] || 'a list') + "'s mute list",
        overrides: ['show-author', 'followed-override', 'manage']
      }
    case SKIN_DECISION.CONTEXT_UNAVAILABLE:
      return {
        ...base,
        label: 'Skin hidden: moderation lists could not be checked',
        overrides: ['show-author', 'manage']
      }
    case SKIN_DECISION.AUTHOR_UNAVAILABLE:
      return {
        ...base,
        label: 'Skin hidden: the author could not be verified',
        overrides: ['show-author', 'manage']
      }
    default:
      return {
        ...base,
        label: '',
        overrides: ['hide-author', 'manage']
      }
  }
}

/**
 * Decide whether a custom profile skin may be applied.
 *
 * @param {object} input
 * @param {string} input.author       Account that owns the metadata (not theme.author).
 * @param {*} input.reputation        Raw or displayed reputation; missing means unknown.
 * @param {object} [input.viewer]     Viewer context: status, muted, following,
 *                                    followedMuteLists, showAuthors, hideAuthors,
 *                                    listErrors.
 * @param {object} [input.settings]   Skin settings (blockMuted, blockNegativeReputation,
 *                                    followedOverride).
 * @returns {{allowed: boolean, code: string, label: string, detail: string, owners: string[], overrides: string[]}}
 */
export function decideSkin ({
  author,
  reputation = null,
  viewer = {},
  settings = {}
} = {}) {
  const name = normalizeName(author)
  const score = displayedReputation(reputation)
  const follow = normalizeList(viewer.following)
  const followed = includesName(follow, name)
  const ownersInLists = listHits(viewer.followedMuteLists, name)
  const showAuthors = normalizeList(viewer.showAuthors)
  const hideAuthors = normalizeList(viewer.hideAuthors)
  const listErrors = Math.max(0, Number(viewer.listErrors) || 0)
  const status = String(viewer.status || 'ready')
  const rules = { ...SKIN_DEFAULT_SETTINGS, ...(settings && typeof settings === 'object' ? settings : {}) }

  const base = { author: name, reputation: score, owners: ownersInLists, followed }

  if (!name) {
    return decision(SKIN_DECISION.AUTHOR_UNAVAILABLE, false, base)
  }

  if (includesName(hideAuthors, name)) {
    return decision(SKIN_DECISION.VIEWER_HIDE, false, base)
  }

  if (includesName(showAuthors, name)) {
    return decision(SKIN_DECISION.VIEWER_SHOW, true, base)
  }

  if (status === 'loading' || status === 'idle') {
    return decision(SKIN_DECISION.CONTEXT_UNAVAILABLE, false, base)
  }

  if (status === 'error') {
    return decision(SKIN_DECISION.CONTEXT_UNAVAILABLE, false, base)
  }

  if (rules.blockMuted && includesName(viewer.muted, name)) {
    return decision(SKIN_DECISION.PERSONAL_MUTE, false, base)
  }

  if (rules.blockNegativeReputation) {
    if (score === null) {
      return decision(SKIN_DECISION.REPUTATION_UNAVAILABLE, false, base)
    }
    if (score < 0) {
      if (rules.followedReputationOverride && followed) {
        return decision(SKIN_DECISION.FOLLOWED_OVERRIDE, true, base)
      }
      return decision(SKIN_DECISION.NEGATIVE_REPUTATION, false, base)
    }
  }

  if (ownersInLists.length) {
    if (rules.followedMuteListOverride && followed) {
      return decision(SKIN_DECISION.FOLLOWED_OVERRIDE, true, base)
    }
    return decision(SKIN_DECISION.FOLLOWED_MUTE_LIST, false, base)
  }

  // A subscribed list could not be read. A follow that wins the conflict can
  // still allow the skin; otherwise we cannot prove the author is not on it.
  if (listErrors > 0) {
    const detail = listErrors === 1
      ? 'One mute list you follow could not be loaded.'
      : listErrors + ' mute lists you follow could not be loaded.'
    if (rules.followedMuteListOverride && followed) {
      return decision(SKIN_DECISION.FOLLOWED_OVERRIDE, true, { ...base, detail })
    }
    return decision(SKIN_DECISION.CONTEXT_UNAVAILABLE, false, { ...base, detail })
  }

  return decision(SKIN_DECISION.ALLOWED, true, base)
}

/**
 * Normalize a viewer's list snapshot into the shape `decideSkin` expects.
 * Kept here so the store and tests agree on the contract.
 */
export function normalizeViewerContext (context = {}) {
  const lists = Array.isArray(context.followedMuteLists)
    ? context.followedMuteLists
      .map(list => ({
        owner: normalizeName(list && list.owner),
        members: normalizeList(list && list.members)
      }))
      .filter(list => list.owner)
    : []
  return {
    status: ['idle', 'loading', 'ready', 'error'].includes(context.status) ? context.status : 'idle',
    muted: normalizeList(context.muted),
    following: normalizeList(context.following),
    followedMuteLists: lists,
    showAuthors: normalizeList(context.showAuthors),
    hideAuthors: normalizeList(context.hideAuthors),
    listErrors: Math.max(0, Number(context.listErrors) || 0)
  }
}
