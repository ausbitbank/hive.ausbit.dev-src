// Pure, deterministic shaping for the creator-stats dashboard widget.
//
// The widget fetches the account record, its recent posts and its account
// history, then hands everything here. Keeping the reward parsing and window
// maths pure means they can be unit tested without a node.
//
// History timestamps are chain timestamps without a zone suffix; they are UTC.

import { postCommentCount, postDisplayTitle, postPayoutValue, postVotes } from './posts'
import { accountEffectiveVests, parseAmount, vestsToHp } from './witnesses'

const DAY_MS = 24 * 60 * 60 * 1000

function round (value, digits = 6) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  const factor = Math.pow(10, digits)
  return Math.round(number * factor) / factor
}

/** Chain timestamps ("2026-11-18T10:00:00") are UTC even without a suffix. */
function timestamp (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const parsed = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(parsed) ? parsed : 0
}

function priceUsd (prices, id) {
  const value = Number(prices?.[id]?.usd)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function historyTransaction (entry) {
  // `get_account_history` rows are `[index, transaction]`; accept a bare
  // transaction too so fixtures and alternate nodes both work.
  return Array.isArray(entry) ? entry[1] : entry
}

function historyOperation (entry) {
  const transaction = historyTransaction(entry)
  if (!transaction || !Array.isArray(transaction.op)) return null
  const [type, data] = transaction.op
  if (typeof type !== 'string' || !type) return null
  return {
    type,
    data: data && typeof data === 'object' ? data : {},
    timestamp: timestamp(transaction.timestamp)
  }
}

function pendingPayout (post) {
  return parseAmount(post?.pending_payout_value)
}

function isExplicitlyUnpaid (post) {
  return post?.is_paidout === false || post?.is_paidout === 'false'
}

function pendingPost (post) {
  return isExplicitlyUnpaid(post) || pendingPayout(post) > 0
}

function postRow (post, payoutHbd) {
  return {
    title: postDisplayTitle(post),
    permlink: String(post?.permlink || ''),
    author: String(post?.author || ''),
    payoutHbd: round(payoutHbd),
    // HBD is USD-pegged, so without a feed the HBD figure is the best estimate.
    payoutUsd: round(payoutHbd),
    votes: postVotes(post),
    comments: postCommentCount(post),
    created: post?.created || null
  }
}

function rewardTotals (history, { windowStart, globalProps }) {
  const rewards = {
    authorHive: 0,
    authorHbd: 0,
    authorHp: 0,
    curationHive: 0,
    curationHp: 0,
    commentHbd: 0
  }

  let authorVests = 0
  let curationVests = 0

  for (const entry of Array.isArray(history) ? history : []) {
    const op = historyOperation(entry)
    if (!op) continue
    // An operation without a usable timestamp cannot be placed inside the
    // window, so it is ignored rather than silently counted.
    if (!op.timestamp || op.timestamp < windowStart) continue

    switch (op.type) {
      case 'author_reward':
        rewards.authorHive += parseAmount(op.data.hive_payout)
        rewards.authorHbd += parseAmount(op.data.hbd_payout)
        authorVests += parseAmount(op.data.vesting_payout)
        break
      case 'curation_reward':
        curationVests += parseAmount(op.data.reward)
        break
      case 'comment_reward':
        rewards.commentHbd += parseAmount(op.data.payout)
        break
      default:
        break
    }
  }

  rewards.authorHp = vestsToHp(authorVests, globalProps)
  rewards.curationHp = vestsToHp(curationVests, globalProps)
  // Curation rewards are paid in VESTS; express the HIVE value of those HP.
  rewards.curationHive = rewards.curationHp

  for (const key of Object.keys(rewards)) rewards[key] = round(rewards[key])

  return rewards
}

/**
 * Summarise one creator's recent rewards, pending payouts, output and best post.
 *
 * `posts` is the account's bridge post feed (`get_account_posts`),
 * `history` is `get_account_history`, and `prices` is the `getHivePrices()`
 * map (`hive` / `hive_dollar` entries with a `usd` field). Everything is
 * defensive: a missing field contributes zero, never NaN.
 */
export function creatorStatsSummary ({
  posts = [],
  history = [],
  account = null,
  globalProps = null,
  prices = null,
  windowDays = 7,
  now = Date.now(),
  historyTruncated = false
} = {}) {
  const requestedDays = Number(windowDays)
  const days = Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : 7
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const windowStart = nowMs - days * DAY_MS

  const list = (Array.isArray(posts) ? posts : []).filter(Boolean)
  const hiveUsd = priceUsd(prices, 'hive')
  const hbdUsd = priceUsd(prices, 'hive_dollar') || (hiveUsd > 0 ? 1 : 0)

  const rewards = rewardTotals(history, { windowStart, globalProps })
  const rewardsUsd = round(
    rewards.authorHive * hiveUsd +
    rewards.authorHbd * hbdUsd +
    rewards.authorHp * hiveUsd +
    rewards.curationHive * hiveUsd +
    rewards.commentHbd * hbdUsd
  )
  const rewardsHive = round(
    hiveUsd > 0
      ? rewardsUsd / hiveUsd
      : rewards.authorHive + rewards.authorHp + rewards.curationHive + rewards.authorHbd + rewards.commentHbd
  )

  const inWindow = list.filter(post => {
    const created = timestamp(post?.created)
    return created > 0 && created >= windowStart
  })

  const pendingPosts = list
    .filter(pendingPost)
    .map(post => postRow(post, pendingPayout(post)))
    .sort((a, b) => b.payoutHbd - a.payoutHbd || a.title.localeCompare(b.title))
  const pendingHbd = round(pendingPosts.reduce((sum, post) => sum + post.payoutHbd, 0))

  const counts = {
    posts: inWindow.length,
    votes: inWindow.reduce((sum, post) => sum + postVotes(post), 0),
    comments: inWindow.reduce((sum, post) => sum + postCommentCount(post), 0)
  }

  const bestPending = pendingPosts.find(post => post.payoutHbd > 0) || null
  const bestFallback = list
    .map(post => ({ post, row: postRow(post, postPayoutValue(post)) }))
    .sort((a, b) => b.row.payoutHbd - a.row.payoutHbd || a.row.title.localeCompare(b.row.title))[0] || null
  const topPostRow = row => {
    const { created: _created, ...rest } = row
    return rest
  }
  const topPost = bestPending
    ? { ...topPostRow(bestPending), pending: true }
    : bestFallback
      ? { ...topPostRow(bestFallback.row), pending: pendingPost(bestFallback.post) }
      : null

  const hp = vestsToHp(accountEffectiveVests(account), globalProps)
  const curationApr = hp > 0
    ? round((rewards.curationHive * (365 / days) / hp) * 100, 2)
    : null
  const curationAprLabel = curationApr === null
    ? ''
    : '~' + curationApr.toFixed(1) + '% APR (estimate)'

  return {
    accountName: String(account?.name || '').trim(),
    windowDays: days,
    truncated: Boolean(historyTruncated),
    rewards: {
      ...rewards,
      totalUsd: rewardsUsd,
      totalHive: rewardsHive
    },
    pending: {
      count: pendingPosts.length,
      hbd: pendingHbd,
      usd: round(pendingHbd * hbdUsd),
      posts: pendingPosts
    },
    counts,
    topPost,
    curationApr,
    curationAprLabel,
    hasData: Boolean(
      counts.posts ||
      pendingPosts.length ||
      topPost ||
      rewards.authorHive ||
      rewards.authorHbd ||
      rewards.authorHp ||
      rewards.curationHive ||
      rewards.commentHbd
    )
  }
}

export default creatorStatsSummary
