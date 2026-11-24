// Contextual accountability view for issue #86's "KE ratio".
//
// The raw Krampus ratio — (author + curation rewards) / staked HP — is easy to
// compute and easy to misread. It ignores witness, proposal, interest and
// beneficiary income, and it treats rewards that legitimately leave the account
// (L2 liquidity, NFTs, spending, delegations) as if they vanished. This module
// therefore returns the full reward-source breakdown plus the limitations and
// is meant for an opt-in card, never a badge, ranking or score.
//
// The module is pure. The widget supplies account history and current records.

import { accountEffectiveVests, parseAmount, vestsToHp } from './witnesses'

const DAY_MS = 24 * 60 * 60 * 1000

function round (value, digits = 6) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  const factor = Math.pow(10, digits)
  return Math.round(number * factor) / factor
}

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

function operation (entry) {
  const transaction = Array.isArray(entry) ? entry[1] : entry
  if (!transaction || !Array.isArray(transaction.op)) return null
  const [type, data] = transaction.op
  if (typeof type !== 'string' || !type) return null
  return {
    type,
    data: data && typeof data === 'object' ? data : {},
    timestamp: timestamp(transaction.timestamp)
  }
}

function newBucket () {
  return { hive: 0, hbd: 0, hp: 0, vests: 0 }
}

function addAmounts (bucket, data, { hiveKey = 'hive_payout', hbdKey = 'hbd_payout', vestsKey = 'vesting_payout' } = {}) {
  bucket.hive += parseAmount(data[hiveKey])
  bucket.hbd += parseAmount(data[hbdKey])
  bucket.vests += parseAmount(data[vestsKey])
}

/**
 * Reward sources in a window. Each bucket keeps its paid units so the UI can
 * explain where the number came from instead of only showing a ratio.
 */
export function keRewardBreakdown ({ history = [], windowStart = 0, globalProps = null } = {}) {
  const buckets = {
    author: newBucket(),
    curation: newBucket(),
    comment: newBucket(),
    beneficiary: newBucket(),
    witness: newBucket(),
    interest: newBucket(),
    proposal: newBucket()
  }

  for (const entry of Array.isArray(history) ? history : []) {
    const op = operation(entry)
    if (!op) continue
    if (!op.timestamp || op.timestamp < windowStart) continue

    switch (op.type) {
      case 'author_reward':
        addAmounts(buckets.author, op.data)
        break
      case 'curation_reward':
        buckets.curation.vests += parseAmount(op.data.reward)
        break
      case 'comment_reward':
        buckets.comment.hbd += parseAmount(op.data.payout)
        break
      case 'comment_benefactor_reward':
        addAmounts(buckets.beneficiary, op.data)
        if (!op.data.vesting_payout) {
          buckets.beneficiary.vests += parseAmount(op.data.reward)
        }
        break
      case 'producer_reward':
        buckets.witness.vests += parseAmount(op.data.vesting_shares ?? op.data.vesting_payout)
        break
      case 'interest':
        buckets.interest.hbd += parseAmount(op.data.interest ?? op.data.amount)
        break
      case 'proposal_pay':
        buckets.proposal.hbd += parseAmount(op.data.daily_pay ?? op.data.hbd_payout)
        buckets.proposal.vests += parseAmount(op.data.vesting_payout)
        break
      default:
        break
    }
  }

  for (const bucket of Object.values(buckets)) {
    bucket.hp = vestsToHp(bucket.vests, globalProps)
    bucket.hive = round(bucket.hive + bucket.hp, 6)
    bucket.vests = round(bucket.vests, 6)
    bucket.hbd = round(bucket.hbd, 6)
  }

  return buckets
}

const SOURCE_LABELS = {
  author: 'Author rewards',
  curation: 'Curation rewards',
  comment: 'Comment rewards',
  beneficiary: 'Beneficiary rewards',
  witness: 'Witness rewards',
  interest: 'HBD savings interest',
  proposal: 'DHF proposal pay'
}

/**
 * Build the contextual KE view for one account.
 *
 * The ratio is only one output: `sources` lists every reward stream it counted,
 * and `limitations` is always populated so the card cannot present the number
 * as a verdict.
 */
export function keRatioSummary ({
  history = [],
  account = null,
  globalProps = null,
  prices = null,
  windowDays = 90,
  now = Date.now(),
  historyTruncated = false
} = {}) {
  const requested = Number(windowDays)
  const days = Number.isFinite(requested) && requested > 0 ? requested : 90
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const windowStart = nowMs - days * DAY_MS
  const hiveUsd = priceUsd(prices, 'hive')
  const hbdUsd = priceUsd(prices, 'hive_dollar') || (hiveUsd > 0 ? 1 : 0)

  const breakdown = keRewardBreakdown({ history, windowStart, globalProps })
  const stakedHp = vestsToHp(parseAmount(account?.vesting_shares), globalProps)
  const effectiveHp = vestsToHp(accountEffectiveVests(account), globalProps)

  const sources = Object.entries(breakdown)
    .map(([id, bucket]) => {
      const usd = bucket.hive * hiveUsd + bucket.hbd * hbdUsd
      return {
        id,
        label: SOURCE_LABELS[id] || id,
        hive: bucket.hive,
        hbd: bucket.hbd,
        hp: bucket.hp,
        usd: round(usd, 2),
        // Without a price feed the HBD figure is the best HIVE-equivalent.
        hiveValue: round(hiveUsd > 0
          ? usd / hiveUsd
          : bucket.hive + bucket.hbd, 6)
      }
    })
    .filter(source => source.hiveValue > 0 || source.hbd > 0)

  const totalHiveValue = round(sources.reduce((sum, source) => sum + source.hiveValue, 0), 6)
  const ratio = stakedHp > 0
    ? round((totalHiveValue / stakedHp) * 100, 4)
    : null
  const annualised = ratio === null
    ? null
    : round(ratio * (365 / days), 2)

  const included = sources.map(source => source.label)

  return {
    accountName: String(account?.name || '').trim(),
    windowDays: days,
    truncated: Boolean(historyTruncated),
    stakedHp: round(stakedHp, 3),
    effectiveHp: round(effectiveHp, 3),
    totalHiveValue,
    ratio,
    ratioLabel: ratio === null ? '—' : ratio.toFixed(2) + '%',
    annualised,
    annualisedLabel: annualised === null ? '—' : annualised.toFixed(1) + '% APR (extrapolated)',
    sources,
    included,
    hasRewards: sources.length > 0,
    formula: '(all counted rewards, in HIVE) ÷ (staked HP) × 100',
    limitations: [
      'Counts author, curation, comment, beneficiary, witness, interest and proposal income when present: ' +
        (included.length ? included.join(', ') + '.' : 'none found in this window.'),
      'Ignores rewards that left the account, spending, L2 liquidity, NFTs, delegations and transfers out. Keeping rewards does not need to be a goal.',
      'Uses the current staked HP and the last ' + days + ' days of history' +
        (historyTruncated ? ', capped at the newest 1,000 operations' : '') + '.',
      'This is context, not a score. It is not a ranking and it is not evidence of wrongdoing.'
    ]
  }
}

export default keRatioSummary
