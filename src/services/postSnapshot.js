// Compact post records for first-paint snapshots (home and browse).
//
// Snapshots never replace a live read; they only let a returning visitor or a
// cold shell paint the cards before the chain responds. Trimming is therefore
// allowed to drop fields the card does not render.

const DEFAULT_BODY_LIMIT = 1200

function truncate (value, limit) {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= limit) return text
  return text.slice(0, limit - 1).trimEnd() + '…'
}

function numberOrNull (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Keep only the metadata keys a preview card renders. */
export function trimJsonMetadata (value) {
  let metadata = value
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    } catch {
      metadata = null
    }
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}

  const trimmed = {}
  for (const key of ['image', 'thumbnails', 'tags', 'app', 'ai_tools', 'portfolio', 'collection', 'countdown', 'video', 'cross_post']) {
    if (metadata[key] !== undefined && metadata[key] !== null) trimmed[key] = metadata[key]
  }
  if (Array.isArray(trimmed.tags)) {
    trimmed.tags = trimmed.tags.filter(tag => typeof tag === 'string').slice(0, 8)
  }
  if (Array.isArray(trimmed.image)) trimmed.image = trimmed.image.filter(Boolean).slice(0, 4)
  if (Array.isArray(trimmed.thumbnails)) trimmed.thumbnails = trimmed.thumbnails.filter(Boolean).slice(0, 4)
  return trimmed
}

/**
 * A post as the card needs it: text for the summary, metadata for the image,
 * and the counters shown in the footer. Vote rows are omitted (the card reads
 * `stats.total_votes`) because bridge already reports the total.
 */
export function trimPost (post, { bodyLimit = DEFAULT_BODY_LIMIT } = {}) {
  if (!post || typeof post !== 'object') return null
  const author = String(post.author || '').trim()
  const permlink = String(post.permlink || '').trim()
  if (!author || !permlink) return null

  return {
    author,
    permlink,
    title: String(post.title || ''),
    created: post.created || '',
    last_update: post.last_update || post.created || '',
    category: post.category || '',
    community: post.community || '',
    community_title: post.community_title || '',
    depth: Number(post.depth) || 0,
    parent_author: post.parent_author || '',
    parent_permlink: post.parent_permlink || '',
    children: Number(post.children) || 0,
    reblogs: Number(post.reblogs) || 0,
    net_votes: Number(post.net_votes) || 0,
    author_reputation: post.author_reputation ?? 0,
    author_role: post.author_role || '',
    author_title: post.author_title || '',
    blacklists: Array.isArray(post.blacklists) ? post.blacklists.filter(Boolean).slice(0, 20) : [],
    payout: numberOrNull(post.payout) ?? 0,
    pending_payout_value: post.pending_payout_value || '0.000 HBD',
    total_payout_value: post.total_payout_value || '0.000 HBD',
    curator_payout_value: post.curator_payout_value || '0.000 HBD',
    max_accepted_payout: post.max_accepted_payout || '',
    percent_hbd: Number(post.percent_hbd) || 0,
    cashout_time: post.cashout_time || '',
    json_metadata: trimJsonMetadata(post.json_metadata),
    body: truncate(post.body, bodyLimit),
    active_votes: [],
    reblogged_by: [],
    stats: post.stats && typeof post.stats === 'object'
      ? {
          total_votes: Number(post.stats.total_votes) || 0,
          hide: post.stats.hide === true,
          hidden: post.stats.hidden === true,
          gray: post.stats.gray === true,
          flag_weight: Number(post.stats.flag_weight) || 0,
          is_pinned: post.stats.is_pinned === true,
          muted_reasons: Array.isArray(post.stats.muted_reasons)
            ? post.stats.muted_reasons.map(Number).filter(Number.isFinite).slice(0, 8)
            : undefined
        }
      : undefined
  }
}

export function trimPostsForSnapshot (posts, { limit = 20, bodyLimit = DEFAULT_BODY_LIMIT } = {}) {
  return (Array.isArray(posts) ? posts : [])
    .slice(0, Math.max(0, Number(limit) || 0))
    .map(post => trimPost(post, { bodyLimit }))
    .filter(Boolean)
}
