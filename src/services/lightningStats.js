// Local Lightning-received summary for the wallet.
//
// This deliberately uses only the wallet rows already loaded in the browser.
// There is no global zap index; the card labels it as a local, loaded-rows view.

import { isV4vappTransfer, parseV4vappMemo } from './lightning'
import { parseKeepsatsCustomJson } from './keepsats'
import {
  walletTransaction,
  walletTransactionDirection,
  walletTransactionOperation
} from './wallet'

const DAY_MS = 24 * 60 * 60 * 1000

/** Chain timestamps are UTC even without a suffix; unknown values return 0. */
function timestampMs (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const parsed = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(parsed) ? parsed : 0
}

export function lightningReceivedStats (entries = [], username = '', { now = Date.now(), windowDays = 7 } = {}) {
  let count = 0
  let sats = 0
  let fees = 0
  let latest = ''
  let windowSats = 0
  let windowCount = 0
  let largestSats = 0
  let largestAt = ''
  const name = String(username || '').toLowerCase()
  const days = Number(windowDays) > 0 ? Number(windowDays) : 7
  const nowMs = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const windowStart = nowMs - days * DAY_MS

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (walletTransactionDirection(entry, name) !== 'in') continue
    const [type, data = {}] = walletTransactionOperation(entry)
    const tx = walletTransaction(entry)
    let amount

    if (type === 'transfer' && isV4vappTransfer(data)) {
      const parsed = parseV4vappMemo(data.memo)
      if (!parsed || parsed.sats === null) continue
      amount = Number(parsed.sats) || 0
      fees += Number(parsed.feeSats) || 0
    } else if (type === 'custom_json') {
      const parsed = parseKeepsatsCustomJson(data)
      if (!parsed?.notification || parsed.to !== name) continue
      amount = Number(parsed.msats) > 0 ? Number(parsed.msats) / 1000 : 0
      if (!amount) continue
    } else {
      continue
    }

    count += 1
    sats += amount
    const at = String(tx?.timestamp || '')
    if (at > latest) latest = at
    const atMs = timestampMs(at)
    if (atMs >= windowStart) {
      windowCount += 1
      windowSats += amount
    }
    if (amount > largestSats) {
      largestSats = amount
      largestAt = at
    }
  }

  return {
    count,
    sats,
    fees,
    latest,
    windowDays: days,
    windowSats,
    windowCount,
    largestSats,
    largestAt
  }
}
