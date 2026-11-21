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

export function lightningReceivedStats (entries = [], username = '') {
  let count = 0
  let sats = 0
  let fees = 0
  let latest = ''
  const name = String(username || '').toLowerCase()

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
  }

  return { count, sats, fees, latest }
}
