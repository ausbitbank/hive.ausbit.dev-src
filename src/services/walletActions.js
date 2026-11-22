// Pure data shaping for the wallet-actions dashboard widget.
//
// Power-down, savings withdrawals, conversions, open orders, pending rewards
// and HBD interest are all described from raw chain records here. The widget
// only renders the result, which keeps the pending maths testable without
// mounting Quasar.
//
// This module intentionally has no Vue imports and no signing helpers.

import moment from '../utils/time'
import {
  buildPortfolio,
  formatUsd,
  hasPendingRewards,
  tidyAmount,
  toNumber,
  vestToHive
} from './wallet'

const MICRO_VESTS = 1e6
const INTEREST_PERIOD_DAYS = 30

function relativeLabel (timestamp, now) {
  if (!timestamp) return ''
  const at = moment.utc(timestamp)
  if (!at.isValid()) return ''
  const minutes = at.diff(moment.utc(now), 'minutes')
  if (minutes === 0) return 'now'
  return moment.duration(minutes, 'minutes').humanize(true)
}

function rewardParts (portfolio) {
  return [
    portfolio.pendingHive > 0 ? tidyAmount(portfolio.pendingHive.toFixed(3) + ' HIVE') : null,
    portfolio.pendingHbd > 0 ? tidyAmount(portfolio.pendingHbd.toFixed(3) + ' HBD') : null,
    portfolio.pendingHp > 0 ? tidyAmount(portfolio.pendingHp.toFixed(3) + ' HP') : null
  ].filter(Boolean)
}

function powerdownSummary (account, globalProps, portfolio, now) {
  if (!account) {
    return {
      active: false,
      nextHp: 0,
      nextLabel: '—',
      progress: 0,
      cyclesLeft: 0,
      countdown: '',
      toWithdraw: 0,
      withdrawn: 0
    }
  }

  const weeklyVests = toNumber(account.vesting_withdraw_rate)
  const rawToWithdraw = toNumber(account.to_withdraw)
  const rawWithdrawn = toNumber(account.withdrawn)
  const active = weeklyVests > 0 || (rawToWithdraw > 0 && rawToWithdraw > rawWithdrawn)

  if (!active) {
    return {
      active: false,
      nextHp: 0,
      nextLabel: '—',
      progress: 0,
      cyclesLeft: 0,
      countdown: '',
      toWithdraw: 0,
      withdrawn: 0
    }
  }

  const toWithdrawVests = rawToWithdraw / MICRO_VESTS
  const withdrawnVests = rawWithdrawn / MICRO_VESTS
  const remainingVests = Math.max(0, toWithdrawVests - withdrawnVests)
  const nextHp = portfolio.powerdownHp

  return {
    active: true,
    nextHp,
    nextLabel: tidyAmount(nextHp.toFixed(3) + ' HP'),
    progress: rawToWithdraw > 0 ? Math.min(1, Math.max(0, rawWithdrawn / rawToWithdraw)) : 0,
    cyclesLeft: weeklyVests > 0 ? Math.ceil(remainingVests / weeklyVests) : 0,
    countdown: relativeLabel(account.next_vesting_withdrawal, now),
    toWithdraw: vestToHive(toWithdrawVests, globalProps),
    withdrawn: vestToHive(withdrawnVests, globalProps)
  }
}

function savingsRows (savingsWithdrawals, now) {
  return (Array.isArray(savingsWithdrawals) ? savingsWithdrawals : []).map((request, index) => ({
    id: String(request.request_id ?? request.id ?? index),
    amount: tidyAmount(request.amount),
    to: request.to || '',
    complete: request.complete || null,
    countdown: relativeLabel(request.complete, now)
  }))
}

function conversionRows (conversions, collateralizedConversions, now) {
  const normal = (Array.isArray(conversions) ? conversions : []).map((conversion, index) => ({
    id: String(conversion.id ?? conversion.requestid ?? index),
    amount: tidyAmount(conversion.amount),
    direction: 'to HIVE',
    date: conversion.conversion_date || null,
    countdown: relativeLabel(conversion.conversion_date, now)
  }))

  const collateralized = (Array.isArray(collateralizedConversions) ? collateralizedConversions : []).map((conversion, index) => ({
    id: String(conversion.id ?? conversion.requestid ?? 'collateral-' + index),
    amount: tidyAmount(conversion.collateral_amount ?? conversion.amount),
    direction: 'collateral to HBD',
    date: conversion.conversion_date || null,
    countdown: relativeLabel(conversion.conversion_date, now)
  }))

  return [...normal, ...collateralized]
}

function orderRows (openOrders) {
  return (Array.isArray(openOrders) ? openOrders : []).map((order, index) => {
    const base = order?.sell_price?.base
    const quote = order?.sell_price?.quote
    const baseAmount = toNumber(base)
    const quoteAmount = toNumber(quote)
    return {
      id: String(order?.orderid ?? order?.id ?? index),
      sell: tidyAmount(base),
      receive: tidyAmount(quote),
      price: baseAmount > 0 ? quoteAmount / baseAmount : 0
    }
  })
}

function interestSummary (account, pendingInterest, now) {
  const amount = Number(pendingInterest)
  const pending = Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(3)) : 0
  const lastPayment = account?.savings_hbd_last_interest_payment
  let claimable = false
  let nextLabel = '—'

  if (lastPayment) {
    const paidAt = moment.utc(lastPayment)
    if (paidAt.isValid()) {
      const next = paidAt.add(INTEREST_PERIOD_DAYS, 'days')
      const minutes = next.diff(moment.utc(now), 'minutes')
      claimable = minutes <= 0 && toNumber(account?.savings_hbd_seconds) > 0
      nextLabel = minutes <= 0 ? 'Ready to claim' : moment.duration(minutes, 'minutes').humanize(true)
    }
  }

  return { amount: pending, claimable, nextLabel }
}

/**
 * Summarise everything the wallet-actions widget shows.
 *
 * `pendingInterest` is computed by the widget from the account's HBD savings
 * accrual fields; everything else is shaped from the supplied chain records.
 * Missing inputs produce an "all clear" summary rather than throwing.
 */
export function walletActionsSummary ({
  account = null,
  globalProps = null,
  prices = null,
  openOrders = [],
  conversions = [],
  collateralizedConversions = [],
  savingsWithdrawals = [],
  pendingInterest = 0,
  now = Date.now()
} = {}) {
  const portfolio = buildPortfolio({
    account,
    globalProps,
    hivePriceUsd: prices?.hive?.usd || 0,
    hbdPriceUsd: prices?.hive_dollar?.usd || 0
  })
  const powerdown = powerdownSummary(account, globalProps, portfolio, now)
  const savings = savingsRows(savingsWithdrawals, now)
  const conversionList = conversionRows(conversions, collateralizedConversions, now)
  const orders = orderRows(openOrders)
  const rewards = {
    has: hasPendingRewards(account),
    parts: rewardParts(portfolio),
    usd: formatUsd(portfolio.pendingUsd)
  }
  const interest = interestSummary(account, pendingInterest, now)

  return {
    accountName: account?.name || '',
    powerdown,
    savingsWithdrawals: savings,
    conversions: conversionList,
    orders,
    rewards,
    interest,
    hasAnything: powerdown.active ||
      savings.length > 0 ||
      conversionList.length > 0 ||
      orders.length > 0 ||
      rewards.has ||
      interest.amount > 0.01
  }
}

export default walletActionsSummary
