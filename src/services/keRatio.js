// Contextual accountability view for issue #86's "KE ratio".
//
// The raw Krampus ratio — (author + curation rewards) / staked HP — is easy to
// compute and easy to misread. It ignores witness, proposal, interest and
// beneficiary income, and it treats rewards that legitimately leave the account
// (L2 liquidity, NFTs, spending, delegations) as if they vanished. This module
// therefore returns the full reward-source breakdown plus the limitations and
// is meant for an opt-in card, never a badge, ranking or score.
//
// The module is pure. The widget supplies reward history and current records.
//
// A history read is not automatically the requested window. High-frequency
// accounts — a top-20 witness earns a `producer_reward` every minute — can fill
// a 1,000-row page in under a day. Callers therefore tell us when the read was
// truncated; the summary then reports the covered span and extrapolates the
// window totals from it instead of pretending minutes are a year.

import { accountEffectiveVests, parseAmount, vestsToHp } from './witnesses'

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_COVERAGE_DAYS = 1 / 24

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

/**
 * Read the first non-zero amount from a list of aliases. Virtual operation
 * fields differ between node/condenser versions (`hbd_payout` vs `sbd_payout`,
 * `payment` vs `daily_pay`), so callers should not depend on one spelling.
 */
function amountFrom (data, keys) {
  for (const key of keys) {
    const value = parseAmount(data?.[key])
    if (value !== 0) return value
  }
  return 0
}

function addTokenAmounts (bucket, data) {
  bucket.hive += amountFrom(data, ['hive_payout', 'steem_payout'])
  bucket.hbd += amountFrom(data, ['hbd_payout', 'sbd_payout'])
  bucket.vests += amountFrom(data, ['vesting_payout', 'vests_payout'])
}

function sourceValue (bucket, hiveUsd, hbdUsd) {
  const usd = bucket.hive * hiveUsd + bucket.hbd * hbdUsd
  // Without a price feed the HBD figure is the best HIVE-equivalent.
  return hiveUsd > 0 ? usd / hiveUsd : bucket.hive + bucket.hbd
}

/**
 * Collect reward buckets plus the span they cover. `comment_reward` is not
 * counted: it reports the post's total payout, which `author_reward`,
 * `curation_reward` and `comment_benefactor_reward` already break down. Adding
 * it would double count the same payout.
 */
function collectRewards ({ history = [], windowStart = 0, globalProps = null } = {}) {
  const buckets = {
    author: newBucket(),
    curation: newBucket(),
    beneficiary: newBucket(),
    witness: newBucket(),
    interest: newBucket(),
    proposal: newBucket()
  }

  let oldestAt = 0
  let newestAt = 0
  let counted = 0

  for (const entry of Array.isArray(history) ? history : []) {
    const op = operation(entry)
    if (!op) continue
    if (!op.timestamp || op.timestamp < windowStart) continue

    switch (op.type) {
      case 'author_reward':
        addTokenAmounts(buckets.author, op.data)
        break
      case 'curation_reward':
        buckets.curation.vests += amountFrom(op.data, ['reward', 'vesting_payout'])
        break
      case 'comment_benefactor_reward': {
        const before = buckets.beneficiary.vests
        addTokenAmounts(buckets.beneficiary, op.data)
        // Some node versions expose the VESTS share as `reward` instead of
        // `vesting_payout`; only use it when the named field was absent.
        if (buckets.beneficiary.vests === before) {
          buckets.beneficiary.vests += amountFrom(op.data, ['reward'])
        }
        break
      }
      case 'producer_reward':
        buckets.witness.vests += amountFrom(op.data, ['vesting_shares', 'vesting_payout'])
        break
      case 'interest':
        buckets.interest.hbd += amountFrom(op.data, ['interest', 'amount'])
        break
      case 'proposal_pay':
        // A proposal pay is paid in HBD; `payment` is the actual transfer.
        buckets.proposal.hbd += amountFrom(op.data, ['payment', 'daily_pay', 'hbd_payout'])
        buckets.proposal.vests += amountFrom(op.data, ['vesting_payout'])
        break
      default:
        continue
    }

    counted += 1
    if (!oldestAt || op.timestamp < oldestAt) oldestAt = op.timestamp
    if (op.timestamp > newestAt) newestAt = op.timestamp
  }

  for (const bucket of Object.values(buckets)) {
    bucket.hp = vestsToHp(bucket.vests, globalProps)
    bucket.hive = round(bucket.hive + bucket.hp, 6)
    bucket.vests = round(bucket.vests, 6)
    bucket.hbd = round(bucket.hbd, 6)
  }

  return { buckets, oldestAt, newestAt, counted }
}

/**
 * Reward sources in a window. Each bucket keeps its paid units so the UI can
 * explain where the number came from instead of only showing a ratio.
 */
export function keRewardBreakdown (options = {}) {
  return collectRewards(options).buckets
}

const SOURCE_LABELS = {
  author: 'Author rewards',
  curation: 'Curation rewards',
  beneficiary: 'Beneficiary rewards',
  witness: 'Witness rewards',
  interest: 'HBD savings interest',
  proposal: 'DHF proposal pay'
}

/**
 * Build the contextual KE view for one account.
 *
 * The ratio is only one output: `sources` lists every reward stream it counted,
 * `coverageDays` reports how much of the window the read actually covered, and
 * `limitations` is always populated so the card cannot present the number as a
 * verdict. When `historyTruncated` is true the totals are scaled from the
 * covered span to the requested window and `estimated` is set.
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

  const { buckets, oldestAt, newestAt, counted } = collectRewards({ history, windowStart, globalProps })
  const stakedHp = vestsToHp(parseAmount(account?.vesting_shares), globalProps)
  const effectiveHp = vestsToHp(accountEffectiveVests(account), globalProps)

  // For a truncated read, the covered span is measured against wall-clock now:
  // a gap since the last reward belongs in the denominator too. For a complete
  // read the window really is covered, so only the account's own age can make
  // the effective span shorter than the requested window.
  const truncated = Boolean(historyTruncated)
  const accountCreated = timestamp(account?.created)
  const accountAgeDays = accountCreated > 0 ? (nowMs - accountCreated) / DAY_MS : days
  const coveredDays = truncated && oldestAt > 0
    ? Math.min(days, Math.max(MIN_COVERAGE_DAYS, (nowMs - oldestAt) / DAY_MS))
    : Math.min(days, Math.max(MIN_COVERAGE_DAYS, accountAgeDays))
  const scale = truncated && oldestAt > 0 && coveredDays < days ? days / coveredDays : 1
  // A sub-0.1% difference is rounding, not a meaningful extrapolation.
  const estimated = scale > 1.001

  const sources = Object.entries(buckets)
    .map(([id, bucket]) => {
      const hive = round(bucket.hive * scale, 6)
      const hbd = round(bucket.hbd * scale, 6)
      const hp = round(bucket.hp * scale, 6)
      const scaled = { hive, hbd }
      const usd = round(hive * hiveUsd + hbd * hbdUsd, 2)
      return {
        id,
        label: SOURCE_LABELS[id] || id,
        hive,
        hbd,
        hp,
        usd,
        hiveValue: round(sourceValue(scaled, hiveUsd, hbdUsd), 6),
        estimated
      }
    })
    .filter(source => source.hiveValue > 0 || source.hbd > 0)

  const totalHiveValue = round(sources.reduce((sum, source) => sum + source.hiveValue, 0), 6)
  const observedHiveValue = scale > 0 ? totalHiveValue / scale : totalHiveValue
  const observedRatio = stakedHp > 0 ? (observedHiveValue / stakedHp) * 100 : null
  const annualised = observedRatio === null
    ? null
    : round(observedRatio * (365 / coveredDays), 2)
  const ratio = stakedHp > 0 ? round((totalHiveValue / stakedHp) * 100, 4) : null

  const included = sources.map(source => source.label)
  const span = counted > 0
    ? 'Rewards span ' + round((newestAt - oldestAt) / DAY_MS, 1) + ' days.'
    : ''

  const limitations = [
    'Counts author, curation, beneficiary, witness, interest and proposal income when present: ' +
      (included.length ? included.join(', ') + '.' : 'none found in this window.'),
    estimated
      ? 'Reward history was capped before the window start, so the figures are estimated from the last ' +
        round(coveredDays, 1) + ' of ' + days + ' days' +
        (span ? ' (' + span + ')' : '') + '.'
      : truncated
        ? 'Reward history was capped, so the ratio may cover less than the selected window.'
        : 'Uses reward history from the full ' + days + '-day window' +
          (counted ? ' (' + counted + ' reward operations)' : '') + '.',
    'Ignores rewards that left the account, spending, L2 liquidity, NFTs, delegations and transfers out. Keeping rewards does not need to be a goal.',
    'Uses the current staked HP and converts all VESTS at the current chain ratio, so long windows are approximate even when complete.',
    'This is context, not a score. It is not a ranking and it is not evidence of wrongdoing.'
  ]
  if (estimated && coveredDays < 1) {
    limitations.splice(2, 0, 'Less than a day of reward history was readable, so the estimate is very rough.')
  }

  return {
    accountName: String(account?.name || '').trim(),
    windowDays: days,
    truncated,
    estimated,
    countedOperations: counted,
    coverageDays: round(coveredDays, 2),
    coveragePercent: round((coveredDays / days) * 100, 1),
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
    limitations
  }
}

export default keRatioSummary
