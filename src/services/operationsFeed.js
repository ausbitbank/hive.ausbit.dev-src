// Account-history filters for the live operations dashboard widget.
//
// Hive returns history entries as `[index, { timestamp, trx_id, block, op }]`.
// The widget filters those entries by operation family, then reuses the queue
// labels and summaries so its wording matches the account page.

import { operationLabel, operationSummary } from './queue'

export const OPERATION_FILTERS = [
  {
    value: 'transfers',
    label: 'Transfers & staking',
    types: [
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'transfer_to_savings',
      'transfer_from_savings', 'cancel_transfer_from_savings', 'fill_transfer_from_savings',
      'recurrent_transfer', 'delegate_vesting_shares'
    ]
  },
  {
    value: 'market',
    label: 'Market & rewards',
    types: [
      'limit_order_create', 'limit_order_create2', 'limit_order_cancel', 'fill_order',
      'convert', 'collateralized_convert', 'claim_reward_balance'
    ]
  },
  {
    value: 'witness',
    label: 'Witness',
    types: ['witness_update', 'witness_set_properties', 'feed_publish', 'account_witness_vote', 'account_witness_proxy']
  },
  {
    value: 'votes',
    label: 'Votes',
    types: ['vote']
  },
  {
    value: 'comments',
    label: 'Posts & comments',
    types: ['comment', 'delete_comment']
  },
  {
    value: 'custom',
    label: 'App actions',
    types: ['custom_json']
  },
  {
    value: 'governance',
    label: 'Governance',
    types: ['update_proposal_votes', 'update_proposal', 'proposal_create', 'proposal_delete']
  }
]

export const OPERATION_FILTER_CHOICES = OPERATION_FILTERS.map(entry => ({
  value: entry.value,
  label: entry.label
}))

const TYPE_TO_FILTER = new Map()
for (const filter of OPERATION_FILTERS) {
  for (const type of filter.types) TYPE_TO_FILTER.set(type, filter.value)
}

export function operationFilterFor (type) {
  return TYPE_TO_FILTER.get(type) || ''
}

/** Turn one history row into the shape the widget renders. */
export function normaliseHistoryEntry (entry) {
  const record = Array.isArray(entry) ? entry[1] : entry
  const op = Array.isArray(record?.op) ? record.op : null
  if (!op || !op[0]) return null
  const type = op[0]
  const data = op[1] && typeof op[1] === 'object' ? op[1] : {}
  const action = ['history', 'posting', [type, data]]
  return {
    index: Array.isArray(entry) ? entry[0] : record?.index,
    type,
    filter: operationFilterFor(type),
    data,
    timestamp: record.timestamp || '',
    block: Number(record.block) || null,
    trxId: record.trx_id || '',
    label: operationLabel(action),
    summary: operationSummary(action)
  }
}

/** Keep entries matching any selected family, plus an optional custom_json id. */
export function filterOperations (entries, { filters = [], jsonIds = [] } = {}) {
  const families = Array.isArray(filters) ? filters.filter(Boolean) : []
  const ids = (Array.isArray(jsonIds) ? jsonIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
  const all = families.length === 0 || families.includes('all')
  return (Array.isArray(entries) ? entries : [])
    .map(normaliseHistoryEntry)
    .filter(Boolean)
    .filter(entry => {
      if (!all && !families.includes(entry.filter)) return false
      if (entry.type === 'custom_json' && ids.length) return ids.includes(String(entry.data.id || ''))
      return true
    })
}

/** Human label for the active filters, shown in the widget header. */
export function filterLabel (filters = []) {
  const selected = (Array.isArray(filters) ? filters : []).filter(Boolean)
  if (!selected.length || selected.includes('all')) return 'All operations'
  return OPERATION_FILTERS
    .filter(entry => selected.includes(entry.value))
    .map(entry => entry.label)
    .join(' · ')
}
