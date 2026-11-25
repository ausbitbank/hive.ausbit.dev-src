// Content display decisions for feeds, comments, profiles, community feeds
// and search.
//
// Kept separate from the skin gate so feed routes do not pay for skin logic.
// This module is pure: no Vue, Pinia, storage or network.

import {
  MODERATION_PRESETS,
  displayedReputation,
  includesName,
  listHits,
  normalizeList,
  normalizeName
} from './moderationPolicy'
import { normalizeVotes, voteDirection } from './voteBreakdown'

// ---------------------------------------------------------------------------
// Content decisions (W73 Phase 1)
// ---------------------------------------------------------------------------
//
// A content decision is intentionally simpler than the skin gate: content
// fails open when the viewer context is unavailable (show it with a note), and
// only an explicit local hide removes it. "collapse" hides the body but keeps
// the author, title and an explanation with "Show anyway".

export const CONTENT_SURFACES = ['feed', 'comment', 'community', 'search', 'profile', 'post']
export const CONTENT_DISPLAY = ['show', 'label', 'collapse', 'hide']
export const CONTENT_SIGNALS = [
  'safetyFloor',
  'mute',
  'listMute',
  'blacklist',
  'community',
  'reputation',
  'downvotes',
  'nsfw',
  'followOnly'
]

const DISPLAY_RANK = { show: 0, label: 1, collapse: 2, hide: 3 }

export const CONTENT_LAYER = {
  VIEWER_SHOW: 'viewer-show',
  VIEWER_HIDE: 'viewer-hide',
  SAFETY_FLOOR: 'safety-floor',
  PERSONAL_MUTE: 'personal-mute',
  PERSONAL_BLACKLIST: 'personal-blacklist',
  FOLLOWED_MUTE_LIST: 'followed-mute-list',
  FOLLOWED_BLACKLIST: 'followed-blacklist',
  COMMUNITY_POST_MUTE: 'community-post-mute',
  COMMUNITY_ROLE: 'community-role',
  REPUTATION: 'reputation',
  DOWNVOTES: 'downvotes',
  NSFW: 'nsfw',
  FOLLOW_ONLY: 'follow-only',
  CONTEXT_UNAVAILABLE: 'context-unavailable'
}

const BALANCED_RULES = {
  safetyFloor: 'collapse',
  mute: 'collapse',
  listMute: 'collapse',
  blacklist: 'label',
  community: 'collapse',
  reputation: 'collapse',
  downvotes: 'label',
  nsfw: 'collapse',
  followOnly: 'show'
}

const OPEN_RULES = {
  safetyFloor: 'collapse',
  mute: 'label',
  listMute: 'label',
  blacklist: 'label',
  community: 'label',
  reputation: 'label',
  downvotes: 'label',
  nsfw: 'label',
  followOnly: 'show'
}

const STRICT_RULES = {
  safetyFloor: 'collapse',
  mute: 'collapse',
  listMute: 'collapse',
  blacklist: 'label',
  community: 'collapse',
  reputation: 'collapse',
  downvotes: 'collapse',
  nsfw: 'collapse',
  followOnly: 'show'
}

const FOLLOW_ONLY_RULES = {
  ...BALANCED_RULES,
  mute: 'collapse',
  listMute: 'collapse',
  blacklist: 'label',
  community: 'label',
  reputation: 'label',
  downvotes: 'label',
  nsfw: 'label',
  followOnly: 'collapse'
}

export const CONTENT_PRESET_RULES = {
  open: OPEN_RULES,
  balanced: BALANCED_RULES,
  strict: STRICT_RULES,
  'follow-only': FOLLOW_ONLY_RULES
}

export const CONTENT_CUSTOM_SURFACES = ['feed', 'comment', 'community', 'search']

export const DEFAULT_CONTENT_CUSTOM = {
  feed: { ...BALANCED_RULES },
  comment: { ...BALANCED_RULES },
  community: { ...BALANCED_RULES },
  search: { ...BALANCED_RULES }
}

const MUTED_REASON_LABELS = {
  0: 'Hidden by community moderation',
  1: 'Restricted by the community type',
  2: 'Reply to a post the community muted',
  3: 'Low reputation',
  4: 'Muted community role'
}

const MUTED_REASON_LAYERS = {
  0: CONTENT_LAYER.COMMUNITY_POST_MUTE,
  1: CONTENT_LAYER.COMMUNITY_POST_MUTE,
  2: CONTENT_LAYER.COMMUNITY_POST_MUTE,
  3: CONTENT_LAYER.REPUTATION,
  4: CONTENT_LAYER.COMMUNITY_ROLE
}

function normalizeKeys (value) {
  if (!value) return []
  const list = typeof value.values === 'function' ? [...value.values()] : value
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = typeof item === 'string' ? item.trim().slice(0, 200) : ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function validDisplay (value, fallback = 'label') {
  return CONTENT_DISPLAY.includes(value) ? value : fallback
}

function strongest (a, b) {
  return DISPLAY_RANK[b] > DISPLAY_RANK[a] ? b : a
}

function contentRule (preset, surface, signal, custom) {
  if (preset === 'custom') {
    const surfaceRules = custom && custom[surface]
    if (surfaceRules && CONTENT_SIGNALS.includes(signal)) {
      return validDisplay(surfaceRules[signal], BALANCED_RULES[signal] || 'label')
    }
    return BALANCED_RULES[signal] || 'label'
  }
  const rules = CONTENT_PRESET_RULES[preset] || BALANCED_RULES
  return rules[signal] || 'label'
}

function mutedReasonList (value) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => Number(item))
    .filter(item => Number.isFinite(item) && item >= 0 && item <= 4)
}

function contentReason (layer, source, label, detail, evidence = {}, overrideKey = null) {
  return { layer, source, label, detail, evidence, overrideKey }
}

/**
 * Decide how one feed/comment/profile item should be displayed.
 *
 * @param {object} input
 * @param {string} input.surface  feed | comment | community | search | profile | post
 * @param {string} input.author
 * @param {*} input.reputation    raw or displayed reputation
 * @param {object} [input.post]   Raw post-ish object; stats/community/nsfw are read.
 * @param {object} [input.viewer] Viewer context (same shape as decideSkin plus
 *                                blacklist lists and item overrides).
 * @param {string} [input.preset]
 * @param {object} [input.custom]
 * @param {boolean} [input.listsOverrideFollows]
 * @param {string} [input.itemKey]
 */
export function decideContent ({
  surface = 'feed',
  author,
  reputation = null,
  post = null,
  viewer = {},
  preset = 'balanced',
  custom = null,
  listsOverrideFollows = false,
  itemKey = ''
} = {}) {
  const name = normalizeName(author)
  const safeSurface = CONTENT_SURFACES.includes(surface) ? surface : 'feed'
  const repSource = (reputation === null || reputation === undefined) && post
    ? post.author_reputation
    : reputation
  const safePreset = MODERATION_PRESETS.includes(preset) ? preset : 'balanced'
  const status = String(viewer.status || 'ready')
  const following = normalizeList(viewer.following)
  const followed = includesName(following, name)
  const muted = includesName(viewer.muted, name)
  const blacklisted = includesName(viewer.blacklisted, name)
  const showAuthors = normalizeList(viewer.showAuthors)
  const hideAuthors = normalizeList(viewer.hideAuthors)
  const showItems = normalizeKeys(viewer.showItems)
  const hideItems = normalizeKeys(viewer.hideItems)
  const key = String(itemKey || '').slice(0, 200)
  const muteHits = listHits(viewer.followedMuteLists, name)
  const blacklistHits = listHits(viewer.followedBlacklistLists, name)
  const listErrors = Math.max(0, Number(viewer.listErrors) || 0)
  const listTruncated = Array.isArray(viewer.listTruncated) ? viewer.listTruncated : []
  const ignoredVoters = normalizeList(viewer.ignoredVoters)
  const safetyFloor = viewer.safetyFloor && typeof viewer.safetyFloor === 'object'
    ? viewer.safetyFloor
    : null
  const safetyFloorEnabled = Boolean(safetyFloor && safetyFloor.enabled !== false)
  const safetyFloorNames = safetyFloor && Array.isArray(safetyFloor.names) ? safetyFloor.names : []

  const stats = post && typeof post.stats === 'object' && post.stats ? post.stats : {}
  const metadata = post && typeof post === 'object' ? post : {}
  const reasons = []
  let display = 'show'
  let conflict = null
  const downvoters = []

  const add = (signal, reason) => {
    display = strongest(display, contentRule(safePreset, safeSurface, signal, custom))
    if (reason) reasons.push(reason)
  }

  if (hideItems.includes(key) || includesName(hideAuthors, name)) {
    reasons.push(contentReason(
      CONTENT_LAYER.VIEWER_HIDE,
      'viewer',
      'Hidden by you',
      'You chose to hide this author or item locally.'
    ))
    display = 'hide'
  } else {
    if (showItems.includes(key) || includesName(showAuthors, name)) {
      reasons.push(contentReason(
        CONTENT_LAYER.VIEWER_SHOW,
        'viewer',
        'Shown by your override',
        'You chose to show this author or item locally.'
      ))
    }

    if (safetyFloorEnabled && includesName(safetyFloorNames, name)) {
      const source = safetyFloor.source && typeof safetyFloor.source === 'object'
        ? safetyFloor.source
        : {}
      const sourceOwner = normalizeName(source.owner)
      add('safetyFloor', contentReason(
        CONTENT_LAYER.SAFETY_FLOOR,
        'site',
        'Known phishing or compromised account',
        'This account is on the ' +
          (sourceOwner ? '@' + sourceOwner + ' phishing/hacked-account list' : 'site phishing safety list') +
          '. The item is collapsed by default so links and media are not shown; you can show it anyway.',
        {
          safetyFloor: true,
          sourceId: String(source.id || ''),
          sourceOwner,
          sourceTitle: String(source.title || ''),
          sourceAsOf: String(source.asOf || ''),
          total: Number(safetyFloor.total) || safetyFloorNames.length
        },
        'show-item'
      ))
    }

    if (muted) {
      add('mute', contentReason(
        CONTENT_LAYER.PERSONAL_MUTE,
        'viewer',
        'Muted by you',
        'You added @' + name + ' to your Hive mute list.'
      ))
    }

    if (muteHits.length) {
      if (followed && !listsOverrideFollows) {
        conflict = { kind: 'follow-vs-mutelist', owners: muteHits }
        reasons.push(contentReason(
          CONTENT_LAYER.FOLLOWED_MUTE_LIST,
          'list-owner',
          'On @' + muteHits[0] + "'s mute list",
          'You follow @' + name + ', so the skin/content is still shown. The list conflict is visible here.',
          { owners: muteHits },
          'always-show-author'
        ))
      } else {
        add('listMute', contentReason(
          CONTENT_LAYER.FOLLOWED_MUTE_LIST,
          'list-owner',
          'On @' + muteHits[0] + "'s mute list",
          'An account or list you subscribe to includes @' + name + '.',
          { owners: muteHits }
        ))
      }
    }

    if (blacklisted) {
      add('blacklist', contentReason(
        CONTENT_LAYER.PERSONAL_BLACKLIST,
        'viewer',
        'On your blacklist',
        'You marked @' + name + ' with a warning, not a mute.'
      ))
    } else if (blacklistHits.length) {
      add('blacklist', contentReason(
        CONTENT_LAYER.FOLLOWED_BLACKLIST,
        'list-owner',
        'On @' + blacklistHits[0] + "'s blacklist",
        'A warning list you subscribe to includes @' + name + '.',
        { owners: blacklistHits }
      ))
    }

    const reasonsList = mutedReasonList(stats.muted_reasons)
    if (reasonsList.length) {
      for (const code of reasonsList) {
        const layer = MUTED_REASON_LAYERS[code] || CONTENT_LAYER.COMMUNITY_POST_MUTE
        add(layer === CONTENT_LAYER.REPUTATION ? 'reputation' : 'community', contentReason(
          layer,
          layer === CONTENT_LAYER.REPUTATION ? 'bridge' : 'community',
          MUTED_REASON_LABELS[code] || 'Muted by the community',
          'Hive bridge reports mute reason ' + code + ' for this post.',
          { reason: code }
        ))
      }
    } else if (stats.hide || stats.hidden) {
      add('community', contentReason(
        CONTENT_LAYER.COMMUNITY_POST_MUTE,
        safeSurface === 'community' ? 'community' : 'bridge',
        safeSurface === 'community' ? 'Muted in this community' : 'Hidden by Hive bridge',
        safeSurface === 'community'
          ? 'A community moderator or bridge rule hid this post. The exact reason is not exposed.'
          : 'Hive bridge hid this post. The exact reason is not exposed.'
      ))
    } else if (stats.gray) {
      add('community', contentReason(
        CONTENT_LAYER.COMMUNITY_POST_MUTE,
        'bridge',
        'Greyed by Hive bridge',
        'Hive bridge marked this post grey; the exact reason is not exposed.',
        { gray: true }
      ))
    }

    if (metadata.author_role === 'muted') {
      add('community', contentReason(
        CONTENT_LAYER.COMMUNITY_ROLE,
        'community',
        'Muted community role',
        '@' + name + ' has a muted role in this community.',
        { role: 'muted' }
      ))
    }

    const score = displayedReputation(repSource)
    if (score !== null && score < 0) {
      add('reputation', contentReason(
        CONTENT_LAYER.REPUTATION,
        'chain',
        'Negative reputation',
        '@' + name + ' has a negative displayed reputation (' + score + ').',
        { reputation: score }
      ))
    }

    const rawNetRshares = Number(metadata.net_rshares ?? stats.net_rshares)
    const rawDownvoteCount = Number(metadata.downvote_count ?? stats.downvote_count)
    const activeDownVotes = normalizeVotes(metadata.active_votes)
      .filter(vote => voteDirection(vote) < 0)
    const ignoredDownVotes = []
    for (const vote of activeDownVotes) {
      const voter = normalizeName(vote.voter)
      if (!voter) continue
      const ignored = ignoredVoters.includes(voter)
      if (ignored) ignoredDownVotes.push(vote)
      if (!downvoters.some(row => row.voter === voter)) downvoters.push({ voter, ignored })
    }

    // A local ignored voter is excluded from the local downvote label, but the
    // raw chain values stay in the evidence. Without active_votes we cannot
    // identify voters, so the local value falls back to the chain value.
    let netRshares = rawNetRshares
    let downvoteCount = rawDownvoteCount
    if (ignoredDownVotes.length) {
      const excludedRshares = ignoredDownVotes.reduce((sum, vote) => sum + vote.rshares, 0)
      if (Number.isFinite(netRshares)) netRshares -= excludedRshares
      if (Number.isFinite(downvoteCount)) downvoteCount = Math.max(0, downvoteCount - ignoredDownVotes.length)
    }
    if (!Number.isFinite(downvoteCount) && activeDownVotes.length) {
      downvoteCount = Math.max(0, activeDownVotes.length - ignoredDownVotes.length)
    }

    if ((Number.isFinite(netRshares) && netRshares < 0) || (Number.isFinite(downvoteCount) && downvoteCount > 0)) {
      add('downvotes', contentReason(
        CONTENT_LAYER.DOWNVOTES,
        'chain',
        'Downvoted',
        ignoredDownVotes.length
          ? 'This item still has net-negative votes after excluding ' + ignoredDownVotes.length + ' downvote(s) from voters you ignore locally. Raw chain weight is unchanged.'
          : 'This item has net-negative votes. Open the votes view for the voter evidence.',
        {
          netRshares: Number.isFinite(netRshares) ? netRshares : null,
          rawNetRshares: Number.isFinite(rawNetRshares) ? rawNetRshares : null,
          downvoteCount: Number.isFinite(downvoteCount) ? downvoteCount : null,
          rawDownvoteCount: Number.isFinite(rawDownvoteCount) ? rawDownvoteCount : null,
          ignoredDownvotes: ignoredDownVotes.length,
          downvoters: downvoters.slice(0, 8)
        }
      ))
    }

    if (metadata.nsfw === true) {
      add('nsfw', contentReason(
        CONTENT_LAYER.NSFW,
        'chain',
        'NSFW',
        'The author or community marked this content NSFW.'
      ))
    }

    if (!followed && safeSurface !== 'profile' && safeSurface !== 'post') {
      add('followOnly', contentReason(
        CONTENT_LAYER.FOLLOW_ONLY,
        'viewer',
        'Not followed',
        'Follow-only mode shows content from accounts you follow.'
      ))
    }
  }

  // A deliberate visit to a profile or post should not collapse or remove the
  // item the viewer opened. It can still carry labels and management actions.
  if (safeSurface === 'profile' || safeSurface === 'post') {
    display = display === 'hide' ? 'label' : (display === 'collapse' ? 'label' : display)
  }
  if (safeSurface === 'comment' && display === 'hide') display = 'collapse'

  if (status === 'loading' || status === 'idle' || status === 'error') {
    reasons.push(contentReason(
      CONTENT_LAYER.CONTEXT_UNAVAILABLE,
      'site',
      'Moderation data unavailable',
      status === 'error'
        ? 'Your mute list could not be loaded; content is shown and labeled only with signals in the payload.'
        : 'Your mute list is still loading; content is shown and labeled only with signals in the payload.',
      { status },
      null
    ))
  }

  if (listErrors > 0 && !followed) {
    reasons.push(contentReason(
      CONTENT_LAYER.CONTEXT_UNAVAILABLE,
      'site',
      'Some mute lists could not be read',
      listErrors + ' subscribed list' + (listErrors === 1 ? '' : 's') + ' could not be loaded.',
      { listErrors },
      null
    ))
  }

  if (listTruncated.length && !followed) {
    const partialMute = listTruncated.some(item => item && item.type === 'muted')
    reasons.push(contentReason(
      CONTENT_LAYER.CONTEXT_UNAVAILABLE,
      'site',
      'Some list entries are not indexed',
      listTruncated.length + ' list index' + (listTruncated.length === 1 ? ' is' : 'es are') +
        ' partial. Members beyond the indexed cap are treated as unknown, not as safe' +
        (partialMute ? ' (including mute-list membership)' : '') + '.',
      {
        listTruncated: listTruncated.length,
        owners: [...new Set(listTruncated.map(item => normalizeName(item && item.owner)).filter(Boolean))].slice(0, 8)
      },
      null
    ))
  }

  if (reasons.some(reason => reason.layer === CONTENT_LAYER.VIEWER_SHOW)) {
    display = 'show'
  }
  if (reasons.some(reason => reason.layer === CONTENT_LAYER.VIEWER_HIDE)) {
    display = 'hide'
  }
  if (safeSurface === 'comment' && display === 'hide') display = 'collapse'

  const primary = reasons.find(reason => reason.layer !== CONTENT_LAYER.CONTEXT_UNAVAILABLE) || reasons[0] || null
  const overrides = ['show-item', 'always-show-author', 'always-hide-author', 'manage']
  if (reasons.some(reason => reason.layer === CONTENT_LAYER.DOWNVOTES) && downvoters.length) {
    overrides.push('ignore-voter')
  }

  return {
    display,
    visible: display !== 'hide',
    author: name,
    itemKey: key,
    community: typeof metadata.community === 'string' ? metadata.community : '',
    primary,
    reasons,
    conflict,
    downvoters,
    overrides,
    unknownContext: status !== 'ready',
    disclosureKey: safePreset + ':' + safeSurface
  }
}
