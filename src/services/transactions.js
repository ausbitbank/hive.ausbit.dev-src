// Pure helpers for the transaction detail page.

/** Shorten a transaction id for titles and navigation labels. */
export function shortTxId (id, head = 10, tail = 6) {
  const value = typeof id === 'string' ? id : ''
  if (value.length <= head + tail + 1) return value
  return value.slice(0, head) + '…' + value.slice(-tail)
}

/** Human label, badge colour and detail for transaction_status_api responses. */
export function describeTransactionStatus (status) {
  switch (status?.status) {
    case 'within_reversible_block':
      return { label: 'Reversible', color: 'orange', detail: 'Within a reversible block' }
    case 'within_irreversible_block':
      return { label: 'Irreversible', color: 'blue-grey-9', detail: 'Within an irreversible block' }
    default:
      return {
        label: 'Confirmed',
        color: 'blue-grey-9',
        detail: status?.status ? String(status.status).replace(/_/g, ' ') : 'Included in block'
      }
  }
}

/** 1-based transaction number inside its block. */
export function transactionNumber (tx) {
  const value = Number(tx && tx.transaction_num)
  return Number.isFinite(value) && value >= 0 ? value + 1 : '—'
}

/** Format the RC cost reported by transaction_status_api. */
export function formatRcCost (status) {
  const value = Number(status && status.rc_cost)
  return Number.isFinite(value) && value > 0 ? value.toLocaleString('en-US') : '—'
}

/** Find the transaction's index and neighbours inside a block. */
export function findTransactionNeighbours (transactions, txId) {
  if (!Array.isArray(transactions) || !txId) {
    return { index: -1, prevId: null, nextId: null }
  }
  const index = transactions.findIndex(tx => tx && tx.transaction_id === txId)
  if (index < 0) return { index: -1, prevId: null, nextId: null }
  return {
    index,
    prevId: index > 0 ? transactions[index - 1].transaction_id : null,
    nextId: index < transactions.length - 1 ? transactions[index + 1].transaction_id : null
  }
}
