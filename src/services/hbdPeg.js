// Pure read model for the HBD peg dashboard widget.
//
// The internal market quotes HIVE in HBD while the witness median feed quotes
// HIVE in HBD as well. Comparing the two gives the implied HBD price: when the
// internal price is below the median, HBD trades at a premium (it buys more
// HIVE than the chain median implies), and vice versa.

import { hbdDebtRatio, parseAsset } from './network'

const PAR_BAND_PERCENT = 0.25

function positiveNumber (value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function priceLabel (value) {
  return value === null ? '—' : '$' + value.toFixed(4)
}

function medianHivePrice (median) {
  if (!median) return null
  const base = parseAsset(median.base)
  const quote = parseAsset(median.quote)
  if (base <= 0 || quote <= 0) return null
  return base / quote
}

function premiumState (premiumPercent) {
  if (premiumPercent === null) {
    return { direction: 'unknown', label: '—' }
  }
  if (Math.abs(premiumPercent) < PAR_BAND_PERCENT) {
    return { direction: 'par', label: 'At par' }
  }
  const magnitude = Math.abs(premiumPercent).toFixed(2) + '%'
  if (premiumPercent > 0) {
    return { direction: 'premium', label: '+' + magnitude + ' premium' }
  }
  return { direction: 'discount', label: '-' + magnitude + ' discount' }
}

/**
 * Summarise the internal-market peg, savings yield, debt ratio and print rate.
 *
 * `amount` is the HBD savings balance used for the projection; a zero amount is
 * valid (it produces zero earnings) while missing global properties leave the
 * APR and projection unavailable rather than assuming a rate.
 */
export function hbdPegSummary ({
  ticker,
  median,
  globalProps,
  amount = 1000,
  treasuryHbd = 0,
  now = Date.now()
} = {}) {
  const internalHiveUsd = positiveNumber(ticker?.latest)
  const medianHiveUsd = medianHivePrice(median)

  const hbdPriceUsd = internalHiveUsd && medianHiveUsd
    ? medianHiveUsd / internalHiveUsd
    : null
  const premiumPercent = hbdPriceUsd !== null
    ? (hbdPriceUsd - 1) * 100
    : null
  const premium = premiumState(premiumPercent)

  const interestRate = Number(globalProps?.hbd_interest_rate)
  const savingsApr = Number.isFinite(interestRate) ? interestRate / 100 : null

  const debtState = hbdDebtRatio({
    hbdSupply: globalProps?.current_hbd_supply,
    hiveSupply: globalProps?.current_supply,
    hiveUsd: medianHiveUsd,
    treasuryHbd
  })
  const ratio = debtState.ratio
  const distanceToSoft = ratio === null ? null : Math.max(0, debtState.softLimit - ratio)
  const distanceToHard = ratio === null ? null : Math.max(0, debtState.hardLimit - ratio)

  const printRateValue = Number(globalProps?.hbd_print_rate)
  const printRate = Number.isFinite(printRateValue) ? printRateValue / 100 : null

  const principalValue = Number(amount)
  const principal = Number.isFinite(principalValue) ? Math.max(0, principalValue) : 0
  const annualHbd = savingsApr === null ? null : principal * (savingsApr / 100)
  const monthlyHbd = annualHbd === null ? null : annualHbd / 12

  return {
    internalHiveUsd,
    internalLabel: priceLabel(internalHiveUsd),
    medianHiveUsd,
    medianLabel: priceLabel(medianHiveUsd),
    premiumPercent,
    premiumDirection: premium.direction,
    premiumLabel: premium.label,
    hbdPriceUsd,
    hbdLabel: priceLabel(hbdPriceUsd),
    savingsApr,
    debt: {
      ratio,
      label: ratio === null ? '—' : ratio.toFixed(2) + '%',
      status: debtState.status,
      softLimit: debtState.softLimit,
      hardLimit: debtState.hardLimit,
      distanceToSoft,
      distanceToHard
    },
    printRate,
    printRateLabel: printRate === null ? '—' : printRate.toFixed(2) + '%',
    projection: {
      amount: principal,
      annualHbd,
      monthlyHbd,
      apr: savingsApr
    },
    hasData: internalHiveUsd !== null ||
      medianHiveUsd !== null ||
      savingsApr !== null ||
      printRate !== null ||
      ratio !== null,
    computedAt: Number.isFinite(Number(now)) ? Number(now) : Date.now()
  }
}

export default hbdPegSummary
