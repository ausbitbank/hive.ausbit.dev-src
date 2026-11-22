// Pure read model for the price alert dashboard widget.
//
// The widget compares the live HIVE USD price against a user-chosen target.
// Nothing here notifies, signs or talks to the chain: it only turns the last
// price read into labels and a triggered flag for the in-page status badge.

const USD_PREFIX = 'US$'

function positiveNumber (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function validTarget (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  // A zero or negative target is the same as "no target set": it is the
  // default setting and a negative USD price is meaningless.
  return Number.isFinite(number) && number > 0 ? number : null
}

function usdLabel (value) {
  if (value === null) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 0.01 ? 4 : 6
  return USD_PREFIX + value.toFixed(digits)
}

function normalizeDirection (value) {
  return String(value ?? '').trim().toLowerCase() === 'below' ? 'below' : 'above'
}

/**
 * Summarise the distance from the current HIVE USD price to `target`.
 *
 * `prices` is the shape returned by `getHivePrices()` (`hive.usd`,
 * `hive.btc`). A missing or non-finite price leaves the alert unavailable
 * rather than assuming zero. `direction` is how the alert triggers: `above`
 * fires at or above the target, `below` at or below it. `distancePercent` is
 * the absolute gap as a percentage of the target.
 */
export function priceAlertSummary ({
  prices,
  target = 0,
  direction = 'above',
  now = Date.now()
} = {}) {
  const currentUsd = positiveNumber(prices?.hive?.usd)
  const currentBtc = positiveNumber(prices?.hive?.btc)
  const goal = validTarget(target)
  const dir = normalizeDirection(direction)

  const available = currentUsd !== null
  const hasTarget = goal !== null
  const comparable = available && hasTarget

  const distance = comparable ? Math.abs(goal - currentUsd) : null
  const distancePercent = comparable && goal > 0
    ? Number(((distance / goal) * 100).toFixed(2))
    : null
  const distanceLabel = distance === null ? '—' : usdLabel(distance)

  let triggered = false
  if (comparable) {
    triggered = dir === 'above' ? currentUsd >= goal : currentUsd <= goal
  }

  let statusLabel
  if (!available) {
    statusLabel = 'Price unavailable'
  } else if (!hasTarget) {
    statusLabel = 'No target set'
  } else if (triggered) {
    statusLabel = 'Target reached'
  } else {
    statusLabel = distanceLabel + ' to go'
  }

  return {
    currentUsd,
    currentBtc,
    currentLabel: usdLabel(currentUsd),
    target: goal,
    targetLabel: usdLabel(goal),
    direction: dir,
    distance,
    distancePercent,
    distanceLabel,
    triggered,
    statusLabel,
    available,
    hasTarget,
    computedAt: Number.isFinite(Number(now)) ? Number(now) : Date.now()
  }
}

export default priceAlertSummary
