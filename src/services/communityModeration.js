// Pure community moderation context.
//
// Bridge exposes a current muted feed and, on that feed, `stats.muted_reasons`
// with five categories. It does not reliably expose per-post moderator notes
// or a complete historical audit, so this module only describes what the
// response actually contains. No reason is invented when the field is absent.

export const COMMUNITY_MUTE_REASON_LABELS = {
  0: 'Hidden by community moderation',
  1: 'Restricted by the community type',
  2: 'Reply to a post the community muted',
  3: 'Low reputation',
  4: 'Muted community role'
}

export const COMMUNITY_MUTE_REASON_HINTS = {
  0: 'A community moderator muted this post.',
  1: 'The community type restrictions apply to this post.',
  2: 'The parent post was muted by the community.',
  3: 'Hive bridge marked this post low reputation.',
  4: 'The author has a muted role in this community.'
}

const REASON_ORDER = [0, 1, 2, 3, 4]
const ROLE_ORDER = { owner: 0, admin: 1, mod: 2, muted: 3 }

function number (value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function postReasons (post) {
  const stats = post && typeof post.stats === 'object' && post.stats ? post.stats : {}
  const raw = Array.isArray(stats.muted_reasons)
    ? stats.muted_reasons.map(number).filter(code => code !== null)
    : []
  const reasons = [...new Set(raw.filter(code => code >= 0 && code <= 4))]
  if (reasons.length) return reasons
  if (raw.length) return ['unknown-code']
  if (stats.hide === true) return ['hidden']
  if (stats.gray === true) return ['gray']
  return ['unknown']
}

function reasonKeysForPost (post) {
  return postReasons(post)
}

function reasonDescriptor (key) {
  const code = number(key)
  if (code !== null && code >= 0 && code <= 4) {
    return {
      key: String(code),
      code,
      label: COMMUNITY_MUTE_REASON_LABELS[code],
      hint: COMMUNITY_MUTE_REASON_HINTS[code]
    }
  }
  if (key === 'unknown-code') {
    return {
      key: 'unknown-code',
      code: null,
      label: 'Unrecognised bridge reason',
      hint: 'Bridge returned a reason code this client does not recognise.'
    }
  }
  if (key === 'hidden') {
    return {
      key: 'hidden',
      code: null,
      label: 'Hidden by Hive bridge',
      hint: 'Bridge hid this post but did not expose a category.'
    }
  }
  if (key === 'gray') {
    return {
      key: 'gray',
      code: null,
      label: 'Greyed by Hive bridge',
      hint: 'Bridge greyed this post but did not expose a category.'
    }
  }
  return {
    key: 'unknown',
    code: null,
    label: 'Reason not exposed',
    hint: 'The post is in the muted feed without a reason field.'
  }
}

function cleanTitle (value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > 120 ? text.slice(0, 119) + '…' : text
}

function teamRows (community) {
  const team = Array.isArray(community?.team) ? community.team : []
  const rows = []
  for (const entry of team) {
    const account = Array.isArray(entry) ? entry[0] : entry?.account
    const role = Array.isArray(entry) ? entry[1] : entry?.role
    const title = Array.isArray(entry) ? entry[2] : entry?.title
    const name = String(account || '').trim().toLowerCase()
    const value = String(role || '').trim().toLowerCase()
    if (!name || !value) continue
    rows.push({ account: name, role: value, title: String(title || '').trim() })
  }
  return rows
}

/**
 * Describe the current muted feed and community roles.
 *
 * `mutedCount` is a sample count from the current bridge muted feed, not a
 * historical total. `reasons` only contains categories the bridge returned.
 */
export function communityModerationContext({ community = null, posts = [] } = {}) {
  const list = (Array.isArray(posts) ? posts : [])
    .filter(post => post && typeof post === 'object' && post.author && post.permlink)

  const counts = new Map()
  const recent = []
  for (const post of list) {
    const keys = reasonKeysForPost(post)
    for (const key of keys) {
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const descriptors = keys.map(reasonDescriptor)
    recent.push({
      author: String(post.author),
      permlink: String(post.permlink),
      title: cleanTitle(post.title || post.permlink),
      created: String(post.created || ''),
      reasons: descriptors.map(row => row.label),
      reasonLabel: descriptors.map(row => row.label).join(' · ')
    })
  }

  const reasons = [...counts.entries()]
    .map(([key, count]) => ({ ...reasonDescriptor(key), count }))
    .sort((a, b) => {
      const rankA = a.code === null ? REASON_ORDER.length : a.code
      const rankB = b.code === null ? REASON_ORDER.length : b.code
      return rankA - rankB || a.label.localeCompare(b.label)
    })

  const roles = new Map()
  for (const member of teamRows(community)) {
    roles.set(member.role, (roles.get(member.role) || 0) + 1)
  }

  const settings = community?.settings && typeof community.settings === 'object'
    ? community.settings
    : {}
  const flagText = String(settings.flag_text || community?.flag_text || '').trim()

  return {
    mutedCount: list.length,
    reasons,
    recent: recent.slice(0, 5),
    hasReasons: reasons.some(row => row.code !== null),
    roles: [...roles.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) =>
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
        b.count - a.count ||
        a.role.localeCompare(b.role)
      ),
    teamSize: teamRows(community).length,
    flagText,
    nsfw: Boolean(settings.nsfw || community?.is_nsfw),
    restricted: Boolean(settings.restricted || settings.posting_restricted),
    mutedFeed: community?.name
      ? '/muted/' + encodeURIComponent(community.name)
      : ''
  }
}
