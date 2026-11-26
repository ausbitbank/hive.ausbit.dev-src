// Pure helpers for the point-of-sale page.
//
// Kept dependency-free so the keypad, invoice memo and session totals can be
// unit tested without Quasar or a browser.

export const POS_CURRENCIES = [
  { label: 'Sats', value: 'sats', decimals: 0 },
  { label: 'HBD', value: 'hbd', decimals: 3 },
  { label: 'HIVE', value: 'hive', decimals: 3 },
  { label: 'USD', value: 'usd', decimals: 2 }
]

export function posCurrency (value) {
  return POS_CURRENCIES.find(entry => entry.value === value) || POS_CURRENCIES[0]
}

/**
 * Apply one keypad press. `key` is a digit, `.`, `backspace` or `clear`.
 * Amounts never start with a redundant zero and never exceed the currency's
 * decimal places.
 */
export function posKeypad (value, key, { decimals = 3, maxLength = 12 } = {}) {
  const current = String(value ?? '')
  if (key === 'clear') return ''
  if (key === 'backspace') return current.slice(0, -1)
  if (!/^[0-9.]$/.test(key)) return current
  if (key === '.' && (decimals === 0 || current.includes('.'))) return current
  if (current.includes('.')) {
    const fraction = current.split('.')[1] || ''
    if (fraction.length >= decimals) return current
  }
  if (current === '0' && key !== '.') return key
  if (current.length >= maxLength) return current
  return current + key
}

export function posAmount (value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

/** Sanitise the public memo: no pipe character, bounded, with a site marker. */
export function posInvoiceMessage (memo = '') {
  const clean = String(memo || '')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
  return [clean, 'POS via banksia.io'].filter(Boolean).join(' · ')
}

export function posReceiveCurrency (currency, requested = '') {
  const value = String(requested || '').toLowerCase()
  if (value === 'hive' || value === 'hbd') return value
  return String(currency || '').toLowerCase() === 'hive' ? 'hive' : 'hbd'
}

/** Session totals are local, not a global sales ledger. */
export function posSessionTotals (sales = []) {
  return (Array.isArray(sales) ? sales : []).reduce((totals, sale) => {
    totals.count += 1
    totals.sats += Number(sale?.sats) || 0
    return totals
  }, { count: 0, sats: 0 })
}
