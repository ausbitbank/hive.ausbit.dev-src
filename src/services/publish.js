// Post construction and pre-publish checks for the creator workflow.
//
// A top-level Hive post is a `comment` operation with an empty parent_author.
// `parent_permlink` is the primary category/community and the first
// json_metadata tag. Everything here is pure so the publish checklist and the
// queue item cannot drift apart.

import {
  MAX_ACCEPTED_PAYOUT,
  MAX_BENEFICIARIES,
  MAX_BODY_BYTES,
  MAX_TAGS,
  MAX_TITLE_CHARS,
  normalizeBeneficiaries,
  normalizeCrossPost,
  normalizeRewards,
  normalizeTag,
  normalizeTags
} from './drafts'
import { byteLength } from '../utils/markdownEditor'

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

/** Combine the community and free tags into the metadata tag order. */
export function resolvedTags (draft) {
  const tags = normalizeTags(draft && draft.tags)
  const community = normalizeTag(draft && draft.community)
  if (!community) return tags.slice(0, MAX_TAGS)
  return [community, ...tags.filter(tag => tag !== community)].slice(0, MAX_TAGS)
}

/** The primary category, which is also `parent_permlink` for a top-level post. */
export function resolveCategory (draft) {
  const community = normalizeTag(draft && draft.community)
  if (community) return community
  return resolvedTags(draft)[0] || ''
}

/** Accept `100`, `100.000 HBD` and numbers; return chain-ready HBD text. */
export function normalizeMaxPayout (value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return value.toFixed(3) + ' HBD'
  }
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d+(?:\.\d{1,3})?)\s*(?:HBD)?$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 0) return null
  return amount.toFixed(3) + ' HBD'
}

const PERMLINK_RE = /^[a-z0-9][a-z0-9-]{0,254}$/

/**
 * Parse a Hive post URL, `@author/permlink` or a bare `author/permlink`.
 * Query strings, hashes and known front-end hosts are ignored.
 */
export function parseHivePostUrl (value) {
  const text = String(value || '').trim()
  if (!text) return null

  const urlMatch = text.match(/@([a-z0-9.-]{3,16})\/([a-z0-9-]{1,255})/i)
  const bareMatch = text.match(/^@?([a-z0-9.-]{3,16})\/([a-z0-9-]{1,255})$/i)
  const match = urlMatch || bareMatch
  if (!match) return null

  const author = match[1].toLowerCase()
  const permlink = match[2].toLowerCase()
  if (!ACCOUNT_RE.test(author) || !PERMLINK_RE.test(permlink)) return null
  return { author, permlink }
}

/** Lowercase, ASCII-only permlink with a timestamp for uniqueness. */
export function createPostPermlink (title, now = new Date()) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const base = String(title ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'post'
  const stamp = date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'z')
    .toLowerCase()
  return (base + '-' + stamp).slice(0, 255)
}

export function beneficiaryShare (list) {
  const beneficiaries = normalizeBeneficiaries(list)
  const total = beneficiaries.reduce((sum, item) => sum + item.weight, 0)
  return {
    total,
    authorShare: Math.max(0, 10000 - total),
    beneficiaries
  }
}

export function buildCommentOptions ({ username, permlink, beneficiaries, rewards } = {}) {
  const normalizedRewards = normalizeRewards(rewards)
  const share = beneficiaryShare(beneficiaries)
  const options = {
    author: username,
    permlink,
    max_accepted_payout: normalizeMaxPayout(normalizedRewards.maxAcceptedPayout) || MAX_ACCEPTED_PAYOUT,
    percent_hbd: normalizedRewards.percentHbd,
    allow_votes: normalizedRewards.allowVotes,
    allow_curation_rewards: normalizedRewards.allowCurationRewards
  }
  if (share.beneficiaries.length) {
    options.extensions = [[0, { beneficiaries: share.beneficiaries }]]
  }
  return options
}

/**
 * Read a cross-post reference from post metadata.
 *
 * The current convention is `cross_post: true` plus `original_author` /
 * `original_permlink` (Ecency, PeakD and the hive-cross-post extension). Older
 * drafts written by this app stored `cross_post` as an `{ author, permlink }`
 * object. Both shapes are accepted here so edits preserve what was published.
 */
export function readCrossPostMetadata (metadata) {
  const source = metadata && typeof metadata === 'object' ? metadata : {}
  const legacy = normalizeCrossPost(source.cross_post)
  if (legacy) return legacy
  if (source.cross_post === true || source.cross_post === 'true') {
    return normalizeCrossPost({
      author: source.original_author,
      permlink: source.original_permlink
    })
  }
  return null
}

/** Metadata for a post, including tags and an optional cross-post reference. */
export function buildPostMetadata (draft) {
  const metadata = {
    app: 'hive.ausbit.dev',
    format: 'markdown',
    tags: resolvedTags(draft)
  }
  const crossPost = normalizeCrossPost(draft && draft.crossPost)
  if (crossPost) {
    // Write the interoperable flags used by other cross-post tools, plus the
    // legacy object so older drafts round-trip through this app unchanged.
    metadata.cross_post = true
    metadata.original_author = crossPost.author
    metadata.original_permlink = crossPost.permlink
  }
  return metadata
}

/**
 * Build the `comment` operation for a top-level post.
 *
 * On the chain an edit is another `comment` operation with the same author and
 * permlink. Hive requires `parent_author` and `parent_permlink` to stay
 * identical to the original, and ignores `comment_options` on edits — those are
 * set once by a separate `comment_options` operation at publish time. Pass
 * `parentPermlink` and `commentOptions: false` when editing.
 *
 * The queue splits `comment_options` into the on-chain operation at broadcast.
 */
export function buildPostOperation ({ username, draft, permlink, now = new Date(), parentPermlink = null, parentAuthor = '', commentOptions = true, previousMetadata = null } = {}) {
  const author = String(username || '').trim().toLowerCase()
  if (!ACCOUNT_RE.test(author)) throw new Error('A valid Hive account is required to publish.')
  // A comment edit keeps its parent author. Comments never have a title.
  const isComment = Boolean(parentAuthor)
  const parent = String(parentAuthor || '').trim().toLowerCase()

  // parent_permlink is a category tag for a top-level post, but the target's
  // permlink for a comment. Use the recorded value verbatim on an edit so a
  // comment reply target is not mangled by tag normalisation.
  const category = parentPermlink
    ? (isComment ? String(parentPermlink).trim().toLowerCase() : normalizeTag(parentPermlink))
    : resolveCategory(draft)
  if (!category) {
    throw new Error(isComment ? 'The comment parent is required to edit.' : 'A community or first tag is required to publish.')
  }
  if (isComment && !/^[a-z0-9][a-z0-9-]{0,254}$/.test(category)) {
    throw new Error('The comment parent permlink is not valid.')
  }

  const postPermlink = String(permlink || '').trim() || createPostPermlink(draft && draft.title, now)
  if (!/^[a-z0-9][a-z0-9-]{0,254}$/.test(postPermlink)) throw new Error('The post permlink is not valid.')

  // Merge onto the original metadata so an edit does not silently drop keys a
  // different client wrote (images, description, app-specific data).
  const metadata = isComment
    ? {
        ...(previousMetadata && typeof previousMetadata === 'object' ? previousMetadata : {}),
        app: 'hive.ausbit.dev',
        format: 'markdown'
      }
    : {
        ...(previousMetadata && typeof previousMetadata === 'object' ? previousMetadata : {}),
        ...buildPostMetadata(draft)
      }

  const operation = {
    parent_author: parent,
    parent_permlink: category,
    author,
    permlink: postPermlink,
    title: isComment ? '' : String(draft && draft.title || '').trim(),
    body: String(draft && draft.body || ''),
    json_metadata: JSON.stringify(metadata)
  }

  // Queue-only marker so the action list can label this as an edit.
  if (!commentOptions) operation._edit = true

  // Comments never carry comment_options on edit; a new top-level post does.
  if (commentOptions && !isComment) {
    operation.comment_options = buildCommentOptions({
      username: author,
      permlink: postPermlink,
      beneficiaries: draft && draft.beneficiaries,
      rewards: draft && draft.rewards
    })
  }

  return ['comment', operation]
}

/** Posting-key queue item for a top-level post (new or edited). */
export function postQueueItem ({ username, draft, permlink, now = new Date(), parentPermlink = null, commentOptions = true, previousMetadata = null } = {}) {
  return [
    String(username || '').trim().toLowerCase(),
    'posting',
    buildPostOperation({ username, draft, permlink, now, parentPermlink, commentOptions, previousMetadata })
  ]
}

function checklistItem (id, label, status, detail) {
  return { id, label, status, detail }
}

/**
 * Pre-publish checklist shared by the UI and tests. `error` blocks publishing,
 * `warn` is advisory and `ok` confirms the requirement.
 */
export function publishChecklist (draft, { username = null } = {}) {
  const source = draft && typeof draft === 'object' ? draft : {}
  const items = []
  const user = String(username || '').trim().toLowerCase()

  if (!ACCOUNT_RE.test(user)) {
    items.push(checklistItem('login', 'Sign in with a posting key', 'error', 'Log in with Keychain or SmartLock from the header, then publish.'))
  } else {
    items.push(checklistItem('login', 'Sign in with a posting key', 'ok', 'Will be queued for @' + user + ' and signed with the posting key.'))
  }

  // A comment edit has no title, and replies never did. Only require one when
  // the draft is a real post.
  const isCommentEdit = Boolean(source.editing && source.editing.parentAuthor)
  if (isCommentEdit) {
    items.push(checklistItem('title', 'Title', 'ok', 'Comments have no title.'))
  } else {
    const title = String(source.title || '').trim()
    if (!title) {
      items.push(checklistItem('title', 'Title', 'error', 'Add a title before publishing.'))
    } else if (title.length > MAX_TITLE_CHARS) {
      items.push(checklistItem('title', 'Title', 'error', 'Titles are limited to ' + MAX_TITLE_CHARS + ' characters.'))
    } else if (title.length > 120) {
      items.push(checklistItem('title', 'Title', 'warn', 'Long titles are truncated on cards and search results.'))
    } else {
      items.push(checklistItem('title', 'Title', 'ok', title))
    }
  }

  const body = String(source.body || '')
  const bytes = byteLength(body)
  if (!body.trim()) {
    items.push(checklistItem('body', 'Body', 'error', 'Write the post body before publishing.'))
  } else if (bytes > MAX_BODY_BYTES) {
    items.push(checklistItem('body', 'Body', 'error', 'The body is ' + bytes + ' bytes; the Hive limit is ' + MAX_BODY_BYTES + '.'))
  } else {
    items.push(checklistItem('body', 'Body', 'ok', bytes + ' / ' + MAX_BODY_BYTES + ' bytes'))
  }

  const tags = resolvedTags(source)
  const community = normalizeTag(source.community)
  if (isCommentEdit) {
    items.push(checklistItem('tags', 'Tags and community', 'ok', 'Comments inherit their parent’s category.'))
  } else if (!tags.length) {
    items.push(checklistItem('tags', 'Tags and community', 'error', 'Add a community or at least one tag.'))
  } else {
    items.push(checklistItem(
      'tags',
      'Tags and community',
      'ok',
      (community ? 'Posted in #' + community + ' · ' : 'Category #' + tags[0] + ' · ') +
        tags.slice(0, MAX_TAGS).map(tag => '#' + tag).join(' ')
    ))
  }

  const rawBeneficiaries = Array.isArray(source.beneficiaries) ? source.beneficiaries : []
  const share = beneficiaryShare(source.beneficiaries)
  const invalidBene = rawBeneficiaries.find(item => {
    const account = String(item && item.account || '').trim().toLowerCase()
    const weight = Number(item && item.weight)
    return !ACCOUNT_RE.test(account) || !Number.isFinite(weight) || weight <= 0 || weight > 10000
  })
  if (isCommentEdit) {
    items.push(checklistItem('beneficiaries', 'Beneficiaries', 'ok', 'Comment edits keep the original payout settings.'))
  } else if (invalidBene) {
    items.push(checklistItem('beneficiaries', 'Beneficiaries', 'error', 'Each beneficiary needs a valid account and a share between 0.01% and 100%.'))
  } else if (rawBeneficiaries.length > MAX_BENEFICIARIES) {
    items.push(checklistItem('beneficiaries', 'Beneficiaries', 'error', 'Up to ' + MAX_BENEFICIARIES + ' beneficiaries are allowed.'))
  } else if (share.total > 10000) {
    items.push(checklistItem('beneficiaries', 'Beneficiaries', 'error', 'Beneficiary shares total more than 100%.'))
  } else if (!share.beneficiaries.length) {
    items.push(checklistItem('beneficiaries', 'Beneficiaries', 'ok', 'No beneficiaries — the author receives 100% of rewards.'))
  } else {
    items.push(checklistItem(
      'beneficiaries',
      'Beneficiaries',
      'ok',
      share.beneficiaries.map(item => '@' + item.account + ' ' + (item.weight / 100) + '%').join(' · ') +
        ' · author ' + (share.authorShare / 100) + '%'
    ))
  }

  const rewards = normalizeRewards(source.rewards)
  const payout = normalizeMaxPayout(rewards.maxAcceptedPayout)
  if (isCommentEdit) {
    items.push(checklistItem('rewards', 'Reward settings', 'ok', 'Comment edits do not resend comment_options.'))
  } else if (!payout) {
    items.push(checklistItem('rewards', 'Reward settings', 'error', 'Enter a valid maximum accepted payout in HBD.'))
  } else {
    const split = rewards.percentHbd === 10000
      ? '100% HBD'
      : rewards.percentHbd === 0
        ? '100% Hive Power'
        : (rewards.percentHbd / 100) + '% HBD / ' + ((10000 - rewards.percentHbd) / 100) + '% HP'
    items.push(checklistItem(
      'rewards',
      'Reward settings',
      'ok',
      payout + ' cap · ' + split + (rewards.allowVotes ? ' · votes on' : ' · votes off')
    ))
  }

  const crossPost = normalizeCrossPost(source.crossPost)
  if (source.crossPost) {
    if (!crossPost) {
      items.push(checklistItem('crossPost', 'Cross-post source', 'error', 'The cross-post author or permlink is not valid.'))
    } else if (crossPost.author === normalizeTag(source.owner)) {
      items.push(checklistItem('crossPost', 'Cross-post source', 'warn', 'This credits your own post. Edit the original instead if you meant to update it.'))
    } else {
      items.push(checklistItem('crossPost', 'Cross-post source', 'ok', 'Credits @' + crossPost.author + '/' + crossPost.permlink + ' via cross_post metadata.'))
    }
  }

  if (source.editing) {
    if (isCommentEdit) {
      items.push(checklistItem('editCategory', 'Edit keeps identity', 'ok', 'Replies to @' + source.editing.parentAuthor + '; comment options are not resent.'))
    } else {
      const changedCategory = source.editing.parentPermlink &&
        normalizeTag(source.community) &&
        normalizeTag(source.community) !== normalizeTag(source.editing.parentPermlink)
      if (changedCategory) {
        items.push(checklistItem('editCategory', 'Edit category', 'warn', 'Hive keeps the original category on edit. The new community/tag is stored in metadata only.'))
      } else {
        items.push(checklistItem('editCategory', 'Edit keeps identity', 'ok', 'Same permlink and parent; comment options are not resent.'))
      }
    }
  }

  items.push(checklistItem(
    'authority',
    'Authority',
    'ok',
    'Publishing needs the posting key only. No active-key operation is created.'
  ))

  return items
}

export function checklistErrors (items) {
  return (Array.isArray(items) ? items : []).filter(item => item.status === 'error')
}

export function canPublish (draft, { username = null } = {}) {
  return checklistErrors(publishChecklist(draft, { username })).length === 0
}
