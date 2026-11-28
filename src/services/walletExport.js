// Tax-friendly CSV export for wallet activity.
//
// The bridge fees are the part most wallets lose. These rows keep the sats
// amount, the fee and the reference id next to the Hive transfer so a
// spreadsheet can reconcile the bridge without double counting the notification.

import {
  parseV4vappMemo,
  isV4vappTransfer
} from './lightning'
import { parseKeepsatsCustomJson } from './keepsats'
import {
  walletTransaction,
  walletTransactionDirection,
  walletTransactionOperation
} from './wallet'
import { csvCell } from '../utils/csv'

export const WALLET_CSV_COLUMNS = [
  'timestamp',
  'rail',
  'direction',
  'asset',
  'amount',
  'sats',
  'fee_sats',
  'hive_equivalent',
  'counterparty',
  'invoice_hash',
  'parent_id',
  'txid',
  'status'
]

function escapeCell (value) {
  return csvCell(value, { quote: false })
}

function transferCells (entry, username) {
  const tx = walletTransaction(entry)
  const [type, data = {}] = walletTransactionOperation(entry)
  if (type !== 'transfer') return null
  const direction = walletTransactionDirection(entry, username)
  const v4vapp = isV4vappTransfer(data)
  const parsed = v4vapp ? parseV4vappMemo(data.memo) : null
  const amount = String(data.amount || '')
  const [value, symbol] = amount.split(/\s+/)
  const keepsatsDeposit = /#sats\b/i.test(String(data.memo || ''))
  const rail = parsed?.invoice || parsed?.kind === 'received'
    ? 'lightning'
    : v4vapp || keepsatsDeposit ? 'keepsats' : 'hive'
  return {
    timestamp: tx?.timestamp || '',
    rail,
    direction,
    asset: symbol || '',
    amount: value || '',
    sats: parsed?.sats ?? '',
    fee_sats: parsed?.feeSats ?? '',
    hive_equivalent: '',
    counterparty: direction === 'in' ? data.from : data.to,
    invoice_hash: parsed?.reference || '',
    parent_id: '',
    txid: tx?.trx_id || '',
    status: parsed ? (parsed.invoice ? 'invoice payment' : parsed.kind) : 'settled'
  }
}

function customJsonCells (entry, username) {
  const tx = walletTransaction(entry)
  const [type, data = {}] = walletTransactionOperation(entry)
  if (type !== 'custom_json') return null
  const parsed = parseKeepsatsCustomJson(data)
  if (!parsed) return null
  return {
    timestamp: tx?.timestamp || '',
    rail: 'keepsats',
    direction: walletTransactionDirection(entry, username),
    asset: 'sats',
    amount: parsed.sats ?? '',
    sats: parsed.sats ?? '',
    fee_sats: '',
    hive_equivalent: '',
    counterparty: parsed.notification ? parsed.from : parsed.to,
    invoice_hash: '',
    parent_id: parsed.parentId || '',
    txid: tx?.trx_id || '',
    status: parsed.notification ? 'notification' : 'instruction'
  }
}

export function buildWalletCsv (entries = [], { username = '' } = {}) {
  const rows = []
  for (const entry of entries) {
    const row = transferCells(entry, username) || customJsonCells(entry, username)
    if (!row) continue
    rows.push(row)
  }
  rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
  const lines = [WALLET_CSV_COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(WALLET_CSV_COLUMNS.map(column => escapeCell(row[column])).join(','))
  }
  return lines.join('\n')
}

export function walletCsvName (username, date = new Date()) {
  const day = date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  return 'hive-wallet-' + String(username || 'account') + '-' + day + '.csv'
}
