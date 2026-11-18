// Pure helpers for the home dashboard.

const OPERATION_LABELS = {
  custom_json: 'custom JSON',
  transfer_to_vesting: 'power up',
  withdraw_vesting: 'power down',
  effective_comment_vote: 'vote',
  producer_reward: 'producer reward',
  author_reward: 'author reward',
  curation_reward: 'curation reward',
  comment_benefactor_reward: 'benefactor reward',
  return_vesting_delegation: 'delegation return',
  limit_order_create: 'limit order',
  limit_order_cancel: 'order cancel',
  limit_order_cancelled: 'order cancelled',
  fill_order: 'order fill',
  vote: 'vote',
  comment: 'post / comment',
  transfer: 'transfer'
}

/** Compact numbers: 103627812 → 103.6M, 1234 → 1.2K. */
export function formatCompactNumber (value, digits = 1) {
  if (value === null || value === undefined) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const abs = Math.abs(number)
  const units = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
  ]
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const scaled = number / size
      const rounded = Number(scaled.toFixed(digits))
      return rounded.toString() + suffix
    }
  }
  return number.toLocaleString('en-US', { maximumFractionDigits: digits })
}

/** Format a USD price with sensible precision for large and sub-dollar values. */
export function formatUsd (value) {
  if (value === null || value === undefined) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const abs = Math.abs(number)

  if (abs >= 10000) {
    return '$' + number.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  if (abs >= 1) {
    return '$' + number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (abs >= 0.01) {
    return '$' + number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }
  return '$' + number.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

/** Signed percentage label, e.g. +2.41% / -2.64%. */
export function formatPercent (value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const sign = number > 0 ? '+' : ''
  return sign + number.toFixed(2) + '%'
}

export function changeClass (value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 'is-flat'
  return number > 0 ? 'is-up' : 'is-down'
}

/**
 * Count operation types for a compact activity summary. Accepts operation
 * tuples (`[type, data]`) or operation objects (`{ op: [type, data] }`).
 */
export function blockOperationMix (operations, limit = 4) {
  if (!Array.isArray(operations)) return []
  const counts = new Map()

  for (const item of operations) {
    const type = Array.isArray(item) ? item[0] : item?.op?.[0]
    if (!type) continue
    counts.set(type, (counts.get(type) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([type, count]) => ({
      type,
      label: OPERATION_LABELS[type] || type.replace(/_/g, ' '),
      count
    }))
}

/** Convert witness votes (micro-VESTS) to HP using global properties. */
export function witnessVotesHp (votes, globalProps) {
  const voteValue = parseFloat(votes)
  const fund = parseFloat(globalProps && globalProps.total_vesting_fund_hive)
  const shares = parseFloat(globalProps && globalProps.total_vesting_shares)
  if (!Number.isFinite(voteValue) || !Number.isFinite(fund) || !Number.isFinite(shares) || shares <= 0) return 0
  return fund * ((voteValue / 1e6) / shares)
}

/** Put Hive assets first while keeping a stable order for the rest. */
export function sortMarketCoins (coins, order = ['hive', 'hive_dollar', 'bitcoin', 'ethereum']) {
  if (!Array.isArray(coins)) return []
  const positions = new Map(order.map((id, index) => [id, index]))
  return [...coins].sort((a, b) => {
    const aPos = positions.has(a.id) ? positions.get(a.id) : order.length
    const bPos = positions.has(b.id) ? positions.get(b.id) : order.length
    return aPos - bPos
  })
}

export function blockSizeKb (block) {
  if (!block) return 0
  try {
    return JSON.stringify(block).length / 1024
  } catch {
    return 0
  }
}

export function blockTransactionCount (block) {
  return block && Array.isArray(block.transactions) ? block.transactions.length : 0
}

/**
 * Count regular operations, optionally including a separate virtual-op list.
 * The home card calls this without virtual ops so its "Operations" figure
 * matches the block detail page; both report virtual ops separately.
 */
export function blockOperationCount (block, virtualOperations = []) {
  const regular = block && Array.isArray(block.transactions)
    ? block.transactions.reduce((total, tx) => total + (Array.isArray(tx.operations) ? tx.operations.length : 0), 0)
    : 0
  return regular + (Array.isArray(virtualOperations) ? virtualOperations.length : 0)
}
