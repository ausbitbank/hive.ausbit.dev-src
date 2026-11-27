// Pure helpers for the signing queue UI.
//
// Queue items stay in the existing `[owner, keyType, operation]` shape so every
// caller can keep using addToQueue. Per-item metadata (status, errors, timing)
// is kept in a parallel `queueMeta` array and persisted alongside the queue.

export const QUEUE_STATUS = {
  PENDING: 'pending',
  BROADCASTING: 'broadcasting',
  SENT: 'sent',
  FAILED: 'failed'
}

export const QUEUE_STATUSES = ['pending', 'broadcasting', 'sent', 'failed']

export const KEY_REQUIREMENTS = {
  posting: {
    key: 'posting',
    label: 'Posting key',
    shortLabel: 'Posting',
    color: 'green',
    icon: 'lock',
    summary: 'Votes, comments, follows and notification read markers.',
    detail: 'The posting key cannot move funds or change account authorities.'
  },
  active: {
    key: 'active',
    label: 'Active key',
    shortLabel: 'Active',
    color: 'orange',
    icon: 'lock',
    summary: 'Transfers, market orders, savings, power and authority changes.',
    detail: 'Keychain, SmartLock or HiveAuth asks for approval and does not keep the active key in this page.'
  }
}

const OPERATION_LABELS = {
  vote: 'Vote',
  comment: 'Post or comment',
  delete_comment: 'Delete post',
  transfer: 'Transfer',
  transfer_to_vesting: 'Power up',
  withdraw_vesting: 'Power down',
  transfer_to_savings: 'Deposit to savings',
  transfer_from_savings: 'Withdraw from savings',
  cancel_transfer_from_savings: 'Cancel savings withdrawal',
  convert: 'Convert HBD to HIVE',
  collateralized_convert: 'Convert HIVE to HBD',
  limit_order_create: 'Create limit order',
  limit_order_cancel: 'Cancel limit order',
  claim_reward_balance: 'Claim rewards',
  account_witness_vote: 'Witness vote',
  account_witness_proxy: 'Voting proxy',
  witness_update: 'Witness update',
  account_update: 'Account update',
  account_update2: 'Account update',
  delegate_vesting_shares: 'Delegate HP',
  custom_json: 'App action',
  update_proposal_votes: 'Proposal vote',
  recurrent_transfer: 'Recurring transfer'
}

/**
 * A posting-authority `account_update2` may only touch posting metadata. Hive
 * treats an empty legacy `json_metadata` as "unchanged"; echoing the current
 * value back silently escalates the operation to active authority. Repair any
 * already-queued item (for example a failed retry from an older build) before
 * it can be broadcast again.
 *
 * `comment_options` must always carry an `extensions` array. hive-tx throws
 * while serialising a missing field, which Keychain reports as the generic
 * "An error occured while signing the transaction". Repair queued posts from
 * older builds so retrying them does not need a fresh draft.
 */
export function normalizeQueueAction (action) {
  if (!Array.isArray(action) || action.length !== 3) return action
  const [owner, keyType, operation] = action
  if (keyType !== 'posting' || !Array.isArray(operation)) return action

  if (operation[0] === 'account_update2') {
    const data = operation[1]
    if (!data || typeof data !== 'object' || !data.json_metadata) return action
    return [owner, keyType, ['account_update2', { ...data, json_metadata: '' }]]
  }

  if (operation[0] === 'comment') {
    const data = operation[1]
    const options = data && data.comment_options
    if (!options || typeof options !== 'object' || Array.isArray(options.extensions)) return action
    return [owner, keyType, ['comment', {
      ...data,
      comment_options: { ...options, extensions: [] }
    }]]
  }

  return action
}

const REBLOG_ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

/**
 * The `follow`/`reblog` operation Hivemind reads to show a post on an account's
 * blog and in their followers' feeds. Used for the composer's "also reblog to
 * my blog" option and by the standalone reblog control.
 */
export function reblogOperation ({ account, author, permlink, remove = false } = {}) {
  const owner = String(account || '').trim().toLowerCase()
  const targetAuthor = String(author || '').trim().toLowerCase()
  const targetPermlink = String(permlink || '').trim()
  if (!REBLOG_ACCOUNT_RE.test(owner)) throw new Error('A valid Hive account is required to reblog.')
  if (!targetAuthor || !targetPermlink) throw new Error('A post is required to reblog.')
  const payload = ['reblog', {
    account: owner,
    author: targetAuthor,
    permlink: targetPermlink,
    ...(remove ? { delete: 'delete' } : {})
  }]
  return ['custom_json', {
    required_auths: [],
    required_posting_auths: [owner],
    id: 'follow',
    json: JSON.stringify(payload)
  }]
}

/**
 * Expand one queued operation into the exact chain operations to broadcast.
 * A queued `comment` may carry app-only markers and nested `comment_options`:
 * `_edit` labels an edit, `_reblog` asks for a same-transaction self-reblog,
 * and `comment_options` is a separate on-chain operation. Keeping the reblog
 * in the same transaction guarantees Hivemind sees the post first; a second
 * queue item could be reblogged before the post is indexed.
 */
export function expandQueueOperation (operation, owner = '') {
  if (!Array.isArray(operation) || typeof operation[0] !== 'string' || !operation[1] || typeof operation[1] !== 'object') {
    throw new Error('Invalid operation for broadcast.')
  }
  const normalized = JSON.parse(JSON.stringify(operation))
  const operations = [normalized]
  if (normalized[0] !== 'comment') return operations

  const body = normalized[1]
  const wantsReblog = body._reblog === true
  delete body._edit
  delete body._reblog

  if (body.comment_options) {
    const options = body.comment_options
    delete body.comment_options
    operations.push(['comment_options', {
      ...options,
      extensions: Array.isArray(options.extensions) ? options.extensions : []
    }])
  }
  if (wantsReblog) {
    const account = String(owner || body.author || '').trim().toLowerCase()
    const author = String(body.author || '').trim().toLowerCase()
    if (account !== author) {
      throw new Error('A self-reblog must use the post author as the queue owner.')
    }
    operations.push(reblogOperation({
      account,
      author,
      permlink: body.permlink
    }))
  }
  return operations
}

/**
 * How a queued `comment` should be handed to Keychain.
 *
 * `requestPost` is convenient for normal top-level posts because it also adds
 * comment options, but Keychain returns "incomplete" for a top-level comment
 * with no `comment_options` (the Vault product and container). Replies and
 * edits already require the exact raw operation. Send those through
 * `requestBroadcast` instead of guessing at requestPost's defaults.
 *
 * @returns {'raw'|'post'}
 */
export function commentBroadcastMode (operation) {
  if (!Array.isArray(operation) || operation[0] !== 'comment') return 'raw'
  const data = operation[1] && typeof operation[1] === 'object' ? operation[1] : {}
  if (data._edit === true || data._reblog === true) return 'raw'
  if (data.parent_author) return 'raw'
  if (!data.comment_options) return 'raw'
  return 'post'
}

export function operationType (action) {
  const op = Array.isArray(action) ? action[2] : null
  return Array.isArray(op) ? op[0] : ''
}

export function operationData (action) {
  const op = Array.isArray(action) ? action[2] : null
  return Array.isArray(op) && op[1] && typeof op[1] === 'object' ? op[1] : {}
}

export function operationLabel (action) {
  const type = operationType(action)
  return OPERATION_LABELS[type] || type.replace(/_/g, ' ') || 'Action'
}

/**
 * Keychain's requestPost expects json_metadata as a JSON string. Queue items
 * already store the operation's metadata as a string, so only stringify raw
 * objects; double-encoding would make tags and cross-post metadata unreadable.
 */
export function postMetadataArgument (value) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

// A tiny duplicate of the keepsats label rules keeps the keepsats parser out of
// the main bundle; the operation builders live in services/keepsats.js.
function keepsatsSummary (data = {}) {
  if (data.id !== 'v4vapp_transfer' && data.id !== 'v4vapp_notification') return ''
  let json = data.json
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json)
    } catch {
      json = null
    }
  }
  if (!json || typeof json !== 'object') return 'Keepsats action'
  if (data.id === 'v4vapp_notification') {
    return 'v4vapp notification' + (json.parent_id ? ' · ' + json.parent_id : '')
  }
  const memo = String(json.memo || '')
  if (/^lnbc[0-9a-z]+$/i.test(memo)) return 'Pay Lightning invoice with keepsats'
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(memo)) return 'Send keepsats to ' + memo
  if (/^#HBD\b/i.test(memo)) return 'Convert keepsats to HBD'
  if (/^#HIVE\b/i.test(memo)) return 'Convert keepsats to HIVE'
  if (json.to_account && json.to_account !== 'v4vapp') return 'Send keepsats to @' + json.to_account
  return 'Keepsats action'
}

function shorten (value, max = 70) {
  const text = String(value || '')
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function mention (author, permlink) {
  if (!author) return ''
  return '@' + author + (permlink ? '/' + shorten(permlink, 28) : '')
}

function baseOperationSummary (action) {
  const type = operationType(action)
  const data = operationData(action)

  switch (type) {
    case 'vote':
      return 'Vote on ' + mention(data.author, data.permlink)
    case 'comment':
      // An edit is a `comment` operation targeted at the same permlink. It has
      // no comment_options and either matches an existing parent or carries an
      // explicit edit marker from the composer.
      if (data._edit) {
        return data.parent_author
          ? 'Edit reply on ' + mention(data.parent_author, data.parent_permlink)
          : 'Edit ' + shorten(data.title || data.permlink || 'a post', 58)
      }
      if (data.parent_author) return 'Reply to ' + mention(data.parent_author, data.parent_permlink)
      return 'Publish ' + shorten(data.title || data.permlink || 'a post', 58)
    case 'delete_comment':
      return 'Delete ' + mention(data.author, data.permlink)
    case 'transfer':
      if (data.to === 'v4vapp' && /#sats\b/i.test(String(data.memo || ''))) {
        return 'Deposit ' + (data.amount || '') + ' to keepsats'
      }
      if (data.to === 'v4vapp' && /lnbc[0-9a-z]+/i.test(String(data.memo || ''))) {
        return 'Pay Lightning invoice with ' + String(data.amount || '').split(/\s+/)[1]
      }
      return (data.amount || 'Transfer') + ' to @' + (data.to || 'unknown')
    case 'transfer_to_vesting':
      return 'Power up ' + (data.amount || 'HIVE') + (data.to ? ' to @' + data.to : '')
    case 'withdraw_vesting':
      return 'Power down ' + (data.vesting_shares || 'HP')
    case 'transfer_to_savings':
      return 'Deposit ' + (data.amount || '') + ' to savings'
    case 'transfer_from_savings':
      return 'Withdraw ' + (data.amount || '') + ' from savings'
    case 'cancel_transfer_from_savings':
      return 'Cancel savings withdrawal #' + (data.request_id ?? '')
    case 'limit_order_create':
      return (data.amount_to_sell || 'Order') + ' → min ' + (data.min_to_receive || '')
    case 'limit_order_cancel':
      return 'Cancel order #' + (data.orderid ?? '')
    case 'convert':
      return 'Convert ' + (data.amount || 'HBD') + ' to HIVE'
    case 'collateralized_convert':
      return 'Convert ' + (data.amount || 'HIVE') + ' to HBD'
    case 'claim_reward_balance':
      return 'Claim pending rewards'
    case 'account_witness_vote':
      return (data.approve ? 'Vote for @' : 'Unvote @') + (data.witness || 'witness')
    case 'account_witness_proxy':
      return data.proxy ? 'Set voting proxy to @' + data.proxy : 'Clear voting proxy'
    case 'witness_update':
      return 'Update witness settings'
    case 'account_update':
    case 'account_update2':
      return 'Update account settings'
    case 'delegate_vesting_shares':
      return 'Delegate ' + (data.vesting_shares || 'HP') + ' to @' + (data.delegatee || '')
    case 'custom_json': {
      const keepsats = keepsatsSummary(data)
      return keepsats || ((data.id || 'custom') + ' app action')
    }
    case 'update_proposal_votes':
      return 'Update proposal votes'
    default:
      return operationLabel(action)
  }
}

/** A short human summary of the queued operation, independent of the raw JSON. */
export function operationSummary (action) {
  const summary = baseOperationSummary(action)
  if (operationType(action) === 'comment' && operationData(action)._reblog === true) {
    return summary + ' + reblog to blog'
  }
  return summary
}

export function keyRequirement (action) {
  const type = Array.isArray(action) ? action[1] : ''
  return KEY_REQUIREMENTS[type] || {
    key: type || 'unknown',
    label: type ? type + ' key' : 'Unknown key',
    shortLabel: type || 'Unknown',
    color: 'grey',
    icon: 'help_outline',
    summary: 'The required key could not be determined.',
    detail: ''
  }
}

export function statusMeta (status) {
  switch (status) {
    case QUEUE_STATUS.BROADCASTING:
      return { label: 'Sending', color: 'blue', icon: 'sync' }
    case QUEUE_STATUS.SENT:
      return { label: 'Sent', color: 'green', icon: 'check_circle' }
    case QUEUE_STATUS.FAILED:
      return { label: 'Failed', color: 'red', icon: 'error' }
    default:
      return { label: 'Queued', color: 'grey', icon: 'schedule' }
  }
}

export function createQueueMeta (now = Date.now(), { manualOnly = false } = {}) {
  const meta = {
    status: QUEUE_STATUS.PENDING,
    error: '',
    txId: '',
    addedAt: now,
    updatedAt: now
  }
  if (manualOnly) meta.manualOnly = true
  return meta
}

export function normalizeQueueMetaEntry (entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object') return createQueueMeta(now)
  const status = QUEUE_STATUSES.includes(entry.status) ? entry.status : QUEUE_STATUS.PENDING
  const normalized = {
    status,
    error: typeof entry.error === 'string' ? entry.error : '',
    txId: typeof entry.txId === 'string' ? entry.txId : '',
    addedAt: Number.isFinite(Number(entry.addedAt)) ? Number(entry.addedAt) : now,
    updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : now
  }
  if (entry.manualOnly === true) normalized.manualOnly = true
  return normalized
}

/** Keep metadata aligned with queue items, including legacy queues with no meta. */
export function normalizeQueueMeta (items, meta, now = Date.now()) {
  const size = Array.isArray(items) ? items.length : 0
  return Array.from({ length: size }, (_, index) => normalizeQueueMetaEntry(meta?.[index], now))
}

export function queueCounts (meta) {
  const counts = {
    pending: 0,
    broadcasting: 0,
    sent: 0,
    failed: 0,
    active: 0,
    total: Array.isArray(meta) ? meta.length : 0
  }
  for (const entry of Array.isArray(meta) ? meta : []) {
    const status = QUEUE_STATUSES.includes(entry?.status) ? entry.status : QUEUE_STATUS.PENDING
    counts[status] += 1
  }
  counts.active = counts.pending + counts.broadcasting + counts.failed
  return counts
}

export function canBroadcast (status) {
  return status === QUEUE_STATUS.PENDING || status === QUEUE_STATUS.FAILED
}

export function canRemove (status) {
  return status !== QUEUE_STATUS.BROADCASTING
}

export function isComplete (status) {
  return status === QUEUE_STATUS.SENT
}

/**
 * First item that may be broadcast. Auto-send skips failed items until retried,
 * and never auto-broadcasts `manualOnly` actions (Lightning payments).
 */
export function nextActionableIndex (meta, { includeFailed = false, skip = [], auto = false } = {}) {
  if (!Array.isArray(meta)) return -1
  const skipped = new Set(skip)
  for (let index = 0; index < meta.length; index++) {
    if (skipped.has(index)) continue
    const entry = normalizeQueueMetaEntry(meta[index])
    if (auto && entry.manualOnly) continue
    if (entry.status === QUEUE_STATUS.PENDING) return index
    if (includeFailed && entry.status === QUEUE_STATUS.FAILED) return index
  }
  return -1
}

export function queueBadgeCount (meta) {
  const counts = queueCounts(meta)
  return counts.pending + counts.broadcasting + counts.failed
}
