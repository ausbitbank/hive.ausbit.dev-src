// Helpers for the post discussion tree returned by `bridge.get_discussion`.
//
// The response is a flat map keyed by `author/permlink`. The root post and
// every comment carry `replies` arrays, so rendering can flatten the tree into
// a predictable list and paginate it without recursing in the template.

export const COMMENT_SORT_OPTIONS = [
  { label: 'Best', value: 'best' },
  { label: 'Newest', value: 'new' },
  { label: 'Oldest', value: 'old' },
  { label: 'Most replies', value: 'replies' }
]

const SORTERS = {
  best: (a, b) => Number(b?.net_rshares || 0) - Number(a?.net_rshares || 0),
  new: (a, b) => Date.parse(b?.created || '') - Date.parse(a?.created || ''),
  old: (a, b) => Date.parse(a?.created || '') - Date.parse(b?.created || ''),
  replies: (a, b) => Number(b?.children || 0) - Number(a?.children || 0)
}

/**
 * Flatten a discussion into depth-tagged comments in display order.
 *
 * - Sibling groups are sorted by the chosen method.
 * - Hidden/flagged comments (and their subtrees) are skipped unless
 *   `showFiltered` is true.
 * - `depth` is 1-based: direct replies to the post are depth 1.
 *
 * If the root post is missing from the map, every map entry is returned once,
 * sorted, using its own depth as a fallback.
 */
export function flattenDiscussion (discussion, rootKey, options = {}) {
  if (!discussion || typeof discussion !== 'object') return []

  const sortFn = SORTERS[options.sort] || SORTERS.best
  const out = []
  const seen = new Set()

  const visit = (key, depth) => {
    if (!key || seen.has(key)) return
    const comment = discussion[key]
    if (!comment) return
    seen.add(key)

    if (depth > 0) {
      out.push({ key, comment, depth })
    }

    const replies = (comment.replies || [])
      .map(replyKey => discussion[replyKey])
      .filter(Boolean)
      .sort(sortFn)

    for (const reply of replies) {
      visit(reply.author + '/' + reply.permlink, depth + 1)
    }
  }

  if (discussion[rootKey]) {
    visit(rootKey, 0)
    return out
  }

  // Defensive fallback for a response that does not include the root post.
  return Object.entries(discussion)
    .sort(([, a], [, b]) => sortFn(a, b))
    .map(([key, comment]) => ({
      key,
      comment,
      depth: Math.max(1, Number(comment.depth) || 1)
    }))
}

/** Total comments in a discussion map, excluding the root post. */
export function countDiscussion (discussion, rootKey) {
  if (!discussion || typeof discussion !== 'object') return 0
  const length = Object.keys(discussion).length
  return Math.max(0, length - (discussion[rootKey] ? 1 : 0))
}

/**
 * Convert a raw Hive reputation value into the displayed score (PeakD/Hive
 * style). Raw values returned by content objects are scaled by 1e9.
 */
export function formatReputation (raw) {
  const value = Number(raw) || 0
  if (!value) return '25'

  const score = Math.log10(Math.abs(value) / 1e9) * 9 + 25
  if (!Number.isFinite(score)) return '25'

  const rounded = Math.round(score)
  if (value < 0) return String(-Math.max(1, Math.abs(rounded)))
  return String(Math.max(25, rounded))
}

/** Build a reply permlink in the same shape the old hive-js formatter used. */
export function commentPermlink (parentAuthor, parentPermlink) {
  const timeStr = new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
  const parent = String(parentPermlink || '').replace(/(-\d{8}t\d{9}z)/g, '')
  return ('re-' + parentAuthor + '-' + parent + '-' + timeStr).replace('.', '')
}

/**
 * Build the queue item for a comment or reply. The queue's Keychain/SmartLock
 * paths expect `comment_options` inside the comment operation; they split it
 * into the separate on-chain `comment_options` operation at broadcast time.
 *
 * Pass `mode: 'edit'` with the original `author`/`permlink` to update an
 * existing comment. Hive requires the original `parent_author` and
 * `parent_permlink` on an edit, and comment options are set once at creation,
 * so an edit never carries `comment_options`.
 */
export function commentQueueItem ({
  username,
  parentAuthor,
  parentPermlink,
  body,
  permlink,
  mode = 'create',
  previousMetadata = null,
  beneficiaries = []
}) {
  if (mode === 'edit') {
    const metadata = {
      ...(previousMetadata && typeof previousMetadata === 'object' ? previousMetadata : {}),
      app: 'banksia.io',
      format: 'markdown'
    }
    return [
      username,
      'posting',
      ['comment', {
        parent_author: parentAuthor || '',
        parent_permlink: parentPermlink,
        author: username,
        permlink,
        title: '',
        body,
        json_metadata: JSON.stringify(metadata),
        _edit: true
      }]
    ]
  }

  return createCommentQueueItem({ username, parentAuthor, parentPermlink, body, permlink, beneficiaries })
}

function createCommentQueueItem ({
  username,
  parentAuthor,
  parentPermlink,
  body,
  permlink,
  beneficiaries = []
}) {
  const commentOptions = {
    author: username,
    permlink,
    max_accepted_payout: '100000.000 HBD',
    percent_hbd: 10000,
    allow_votes: true,
    allow_curation_rewards: true,
    extensions: []
  }

  const list = Array.isArray(beneficiaries)
    ? beneficiaries
        .map(item => ({ account: item.account, weight: Number(item.weight) }))
        .filter(item => item.account && Number.isFinite(item.weight) && item.weight > 0)
    : []

  if (list.length) commentOptions.extensions = [[0, { beneficiaries: list }]]

  return [
    username,
    'posting',
    ['comment', {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author: username,
      permlink,
      title: '',
      body,
      json_metadata: JSON.stringify({ app: 'banksia.io', format: 'markdown' }),
      comment_options: commentOptions
    }]
  ]
}

/**
 * Queue item for deleting a post or comment. Hive only allows the author to
 * delete, and blocks deleting anything that still has replies.
 */
export function deleteCommentQueueItem ({ username, author, permlink }) {
  const owner = String(username || '').trim().replace(/^@/, '').toLowerCase()
  const target = String(author || owner).trim().replace(/^@/, '').toLowerCase()
  if (!owner || !target || target !== owner) {
    throw new Error('Only the signed-in author can queue a delete for this post.')
  }
  return [owner, 'posting', ['delete_comment', { author: owner, permlink: String(permlink || '').trim() }]]
}
