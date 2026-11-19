// Pure data shaping for the dashboard's account and network widgets.
//
// The widget components fetch through `chainData`/`useAccountWidget` and hand
// the raw records to these functions, so the numbers shown on the dashboard
// are computed in one testable place. Every function is deterministic.

import {
  accountVoteWeight,
  aggregateWitnessHealth,
  formatHp,
  MAX_WITNESS_VOTES,
  parseAmount,
  relativeTime,
  topTwentyCutoffHp,
  witnessVotesHp
} from './witnesses'
import { buildPortfolio, formatUsd, tidyAmount } from './wallet'
import { hbdDebtRatio, parseAsset, participationRate, participationStatus } from './network'
import { notificationCategory, notificationPath, plainNotificationMessage } from './notifications'

/** A price pair from `getHivePrices()`, with a safe default. */
function price (prices, id) {
  const entry = prices?.[id]
  return {
    usd: Number(entry?.usd) || 0,
    change: Number.isFinite(Number(entry?.usd_24h_change)) ? Number(entry.usd_24h_change) : null
  }
}

function amount (value) {
  return parseAmount(value)
}

/* --- wallet -------------------------------------------------------------- */

/**
 * `widgetWalletSummary`: portfolio value and the balances a compact wallet
 * widget can show. `hive`/`hbd` are `{ usd, change }` from `getHivePrices()`.
 */
export function walletWidgetSummary (account, globalProps, hive, hbd) {
  const portfolio = buildPortfolio({
    account,
    globalProps,
    hivePriceUsd: hive?.usd || 0,
    hbdPriceUsd: hbd?.usd || 0,
    hiveChange: hive?.change ?? null,
    hbdChange: hbd?.change ?? null
  })
  const change = portfolio.changePercent
  return {
    portfolio,
    totalUsd: formatUsd(portfolio.totalUsd),
    changePercent: change,
    changeLabel: change === null ? '' : (change >= 0 ? '+' : '') + change.toFixed(2) + '%',
    changeDirection: change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    rows: [
      { id: 'hive', label: 'HIVE', amount: tidyAmount(portfolio.liquidHive.toFixed(3) + ' HIVE'), usd: formatUsd(portfolio.liquidHiveUsd) },
      { id: 'hbd', label: 'HBD', amount: tidyAmount(portfolio.liquidHbd.toFixed(3) + ' HBD'), usd: formatUsd(portfolio.liquidHbdUsd) },
      { id: 'hp', label: 'HP', amount: tidyAmount(portfolio.stakedHive.toFixed(3) + ' HP'), usd: formatUsd(portfolio.stakedHiveUsd) },
      { id: 'savings', label: 'Savings', amount: tidyAmount(portfolio.savingsHbd.toFixed(3) + ' HBD'), usd: formatUsd(portfolio.savingsHbdUsd) }
    ],
    rewards: {
      has: portfolio.pendingHp > 0 || portfolio.pendingHive > 0 || portfolio.pendingHbd > 0,
      usd: formatUsd(portfolio.pendingUsd),
      parts: [
        portfolio.pendingHive > 0 ? tidyAmount(portfolio.pendingHive.toFixed(3) + ' HIVE') : null,
        portfolio.pendingHbd > 0 ? tidyAmount(portfolio.pendingHbd.toFixed(3) + ' HBD') : null,
        portfolio.pendingHp > 0 ? tidyAmount(portfolio.pendingHp.toFixed(3) + ' HP') : null
      ].filter(Boolean)
    }
  }
}

/* --- my witness ---------------------------------------------------------- */

/**
 * Where the account's witness sits in the ranked list: rank, approval HP and
 * the gap to the top-20 cut-off (in votes, micro-VESTS, and HP).
 */
export function myWitnessPosition (witnesses, owner, globalProps) {
  const name = String(owner || '').replace(/^@/, '')
  const list = (Array.isArray(witnesses) ? witnesses : [])
    .filter(witness => witness && witness.owner)
    .slice()
    .sort((a, b) => amount(b.votes) - amount(a.votes))
    .map((witness, index) => ({
      owner: witness.owner,
      rank: Number(witness.rank) || index + 1,
      votes: amount(witness.votes),
      hp: witnessVotesHp(witness.votes, globalProps),
      runningVersion: witness.running_version || '',
      missed: Number(witness.total_missed) || 0,
      lastFeed: witness.last_hbd_exchange_update || ''
    }))

  const me = list.find(row => row.owner === name)
  if (!me) return { found: false, owner: name }

  const cutoffHp = topTwentyCutoffHp(witnesses, globalProps)
  const cutoff = list.find(row => row.hp === cutoffHp) || null
  const gapHp = Math.max(0, cutoffHp - me.hp)
  return {
    found: true,
    owner: name,
    rank: me.rank,
    total: list.length,
    hp: me.hp,
    hpLabel: formatHp(me.hp),
    missed: me.missed,
    lastFeed: me.lastFeed,
    inTopTwenty: me.rank <= 20,
    cutoffHp,
    gapHp,
    gapLabel: me.rank <= 20 ? 'In the top 20' : 'Gap to #20: ' + formatHp(gapHp),
    progress: cutoff > 0 ? Math.min(100, (me.votes / cutoff.votes) * 100) : 100
  }
}

/* --- witness health ------------------------------------------------------ */

/**
 * How healthy the witnesses one account votes for are, plus vote weight.
 * `witnesses` is the ranked list; unknown names are reported as missing.
 */
export function voteHealthSummary (witnesses, account, globalProps, { hardforkVersion = '', now = Date.now() } = {}) {
  const list = Array.isArray(witnesses) ? witnesses : []
  const votes = Array.isArray(account?.witness_votes) ? account.witness_votes : []
  const byName = new Map(list.map(witness => [witness.owner, witness]))
  const voted = votes.map(name => byName.get(name)).filter(Boolean)
  const summary = aggregateWitnessHealth(voted, { globalProps, hardforkVersion, now })
  const weight = accountVoteWeight(account, globalProps)
  return {
    votesUsed: votes.length,
    votesMax: MAX_WITNESS_VOTES,
    votesLeft: Math.max(0, MAX_WITNESS_VOTES - votes.length),
    missing: votes.filter(name => !byName.has(name)).length,
    weightHp: weight.hp,
    weightLabel: formatHp(weight.hp),
    ...summary,
    notHealthy: summary.critical + summary.warning
  }
}

/* --- network ------------------------------------------------------------- */

/**
 * Headline network numbers from dynamic global properties.
 * `participation_count` is signatures in the last 128 blocks.
 */
export function networkStats (globalProps, { medianHiveUsd = 0 } = {}) {
  const props = globalProps || {}
  const participation = participationRate(props.participation_count)
  const status = participationStatus(participation)
  const debt = hbdDebtRatio({
    hbdSupply: props.current_hbd_supply,
    hiveSupply: props.current_supply,
    hiveUsd: medianHiveUsd
  })
  return {
    headBlock: Number(props.head_block_number) || 0,
    irreversible: Number(props.last_irreversible_block_num) || 0,
    participation,
    participationLabel: participation.toFixed(1) + '%',
    participationStatus: status.key,
    hbdSupply: parseAsset(props.current_hbd_supply),
    hiveSupply: parseAsset(props.current_supply),
    stakedHive: parseAsset(props.total_vesting_fund_hive),
    debtRatio: debt.ratio,
    debtLabel: debt.ratio === null ? '—' : debt.ratio.toFixed(2) + '%',
    debtStatus: debt.status.key,
    hbdSavingsApr: Number(props.hbd_interest_rate) / 100
  }
}

/* --- notifications ------------------------------------------------------- */

/**
 * The newest notifications for the widget, one compact row each. Rows are
 * deduplicated by id and sorted newest first; `limit` caps the output.
 */
export function notificationRows (notifications, { limit = 5 } = {}) {
  const seen = new Map()
  for (const item of Array.isArray(notifications) ? notifications : []) {
    if (item?.id && !seen.has(item.id)) seen.set(item.id, item)
  }
  const rows = [...seen.values()]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, Math.max(1, Number(limit) || 5))
    .map(item => ({
      id: item.id,
      category: notificationCategory(item),
      message: plainNotificationMessage(item.msg, 120),
      actor: (String(item.msg || '').match(/@([a-z0-9][a-z0-9.-]*)/i) || [])[1] || '',
      to: notificationPath(item.url),
      time: relativeTime(item.date)
    }))
  return rows
}

export { price }
