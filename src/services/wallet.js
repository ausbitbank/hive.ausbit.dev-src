// Pure helpers for the wallet page.
//
// Keeping balance maths, transaction classification and operation descriptions
// here makes the wallet components layout-only and lets the behaviour be unit
// tested without mounting Quasar.

export const WALLET_ACTIVITY_CATEGORIES = [
  { value: 'all', label: 'All activity' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'staking', label: 'Power up' },
  { value: 'unstaking', label: 'Power down' },
  { value: 'savings', label: 'Savings' },
  { value: 'market', label: 'Market orders' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'interest', label: 'Interest' }
]

const CATEGORY_TYPES = {
  transfers: ['transfer'],
  staking: ['transfer_to_vesting'],
  unstaking: ['withdraw_vesting', 'fill_vesting_withdraw'],
  savings: [
    'transfer_to_savings',
    'transfer_from_savings',
    'fill_transfer_from_savings',
    'cancel_transfer_from_savings'
  ],
  market: ['fill_order', 'limit_order_create', 'limit_order_cancel'],
  conversions: ['convert', 'collateralized_convert', 'fill_convert_request', 'fill_collateralized_convert_request'],
  rewards: ['claim_reward_balance', 'liquidity_reward'],
  interest: ['interest']
}

const TRANSFER_ICONS = {
  transfer: 'swap_horizontal_circle',
  transfer_to_vesting: 'arrow_circle_up',
  withdraw_vesting: 'arrow_circle_down',
  fill_vesting_withdraw: 'arrow_circle_down',
  transfer_to_savings: 'savings',
  transfer_from_savings: 'savings',
  fill_transfer_from_savings: 'savings',
  cancel_transfer_from_savings: 'cancel',
  convert: 'cached',
  collateralized_convert: 'swap_horizontal_circle',
  fill_convert_request: 'cached',
  fill_collateralized_convert_request: 'cached',
  fill_order: 'swap_horizontal_circle',
  claim_reward_balance: 'stars',
  liquidity_reward: 'water_drop',
  interest: 'trending_up'
}

export function toNumber (value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const parsed = parseFloat(String(value).split(' ')[0])
  return Number.isFinite(parsed) ? parsed : 0
}

export function tidyNumber (value, maximumFractionDigits = 3) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0
  })
}

export function tidyAmount (value) {
  if (value === null || value === undefined || value === '') return '—'
  const parts = String(value).trim().split(/\s+/)
  const raw = parts.shift()
  const [whole, decimals] = raw.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const amount = decimals ? grouped + '.' + decimals : grouped
  return [amount, ...parts].join(' ')
}

export function formatUsd (value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return '$' + number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits
  })
}

export function vestToHive (vests, globalProps) {
  if (!globalProps || globalProps.empty) return 0
  const totalShares = toNumber(globalProps.total_vesting_shares)
  const totalFund = toNumber(globalProps.total_vesting_fund_hive)
  if (!totalShares || !totalFund) return 0
  return toNumber(vests) * totalFund / totalShares
}

export function hivePowerApr (globalProps) {
  if (!globalProps || globalProps.empty || !globalProps.head_block_number) return null
  const initialInflationRate = 9.5
  const initialBlock = 7000000
  const decreaseRate = 250000
  const decreasePercentPerIncrement = 0.01
  const deltaBlocks = globalProps.head_block_number - initialBlock
  const decreaseIncrements = deltaBlocks / decreaseRate
  let currentInflationRate = initialInflationRate - decreaseIncrements * decreasePercentPerIncrement
  if (currentInflationRate < 0.95) currentInflationRate = 0.95
  const vestingRewardPercent = globalProps.vesting_reward_percent / 10000
  const virtualSupply = toNumber(globalProps.virtual_supply)
  const totalVestingFunds = toNumber(globalProps.total_vesting_fund_hive)
  if (!virtualSupply || !totalVestingFunds) return null
  return Number(((virtualSupply * currentInflationRate * vestingRewardPercent) / totalVestingFunds).toFixed(2))
}

export function buildPortfolio ({ account, globalProps, hivePriceUsd, hbdPriceUsd, hiveChange, hbdChange } = {}) {
  const data = account || {}
  const hivePrice = toNumber(hivePriceUsd)
  const hbdPrice = toNumber(hbdPriceUsd)

  const liquidHive = toNumber(data.balance)
  const stakedHive = vestToHive(toNumber(data.vesting_shares), globalProps)
  const receivedHp = vestToHive(toNumber(data.received_vesting_shares), globalProps)
  const delegatedHp = vestToHive(toNumber(data.delegated_vesting_shares), globalProps)
  const powerdownHp = vestToHive(toNumber(data.vesting_withdraw_rate), globalProps)
  const liquidHbd = toNumber(data.hbd_balance)
  const savingsHive = toNumber(data.savings_balance)
  const savingsHbd = toNumber(data.savings_hbd_balance)

  const pendingHive = toNumber(data.reward_hive_balance)
  const pendingHbd = toNumber(data.reward_hbd_balance)
  const pendingHp = vestToHive(toNumber(data.reward_vesting_balance), globalProps)

  const liquidHiveUsd = liquidHive * hivePrice
  const stakedHiveUsd = stakedHive * hivePrice
  const liquidHbdUsd = liquidHbd * hbdPrice
  const savingsHiveUsd = savingsHive * hivePrice
  const savingsHbdUsd = savingsHbd * hbdPrice
  const pendingUsd = pendingHive * hivePrice + pendingHbd * hbdPrice + pendingHp * hivePrice

  const holdingsUsd = liquidHiveUsd + stakedHiveUsd + liquidHbdUsd + savingsHiveUsd + savingsHbdUsd

  const hiveWeight = (liquidHive + stakedHive + savingsHive) * hivePrice
  const hbdWeight = (liquidHbd + savingsHbd) * hbdPrice
  let weightedChange = 0
  let changeWeight = 0
  if (Number.isFinite(Number(hiveChange)) && hiveWeight > 0) {
    weightedChange += hiveWeight * Number(hiveChange)
    changeWeight += hiveWeight
  }
  if (Number.isFinite(Number(hbdChange)) && hbdWeight > 0) {
    weightedChange += hbdWeight * Number(hbdChange)
    changeWeight += hbdWeight
  }

  const hbdApr = globalProps && globalProps.hbd_interest_rate
    ? Number(globalProps.hbd_interest_rate) / 100
    : 0

  return {
    liquidHive,
    stakedHive,
    receivedHp,
    delegatedHp,
    effectiveHp: stakedHive + receivedHp - delegatedHp - powerdownHp,
    powerdownHp,
    liquidHbd,
    savingsHive,
    savingsHbd,
    pendingHive,
    pendingHbd,
    pendingHp,
    liquidHiveUsd,
    stakedHiveUsd,
    liquidHbdUsd,
    savingsHiveUsd,
    savingsHbdUsd,
    pendingUsd,
    holdingsUsd,
    totalUsd: holdingsUsd,
    pricesReady: hivePrice > 0 || hbdPrice > 0,
    changePercent: changeWeight > 0 ? weightedChange / changeWeight : null,
    hiveApr: hivePowerApr(globalProps),
    hbdApr
  }
}

export function hasPendingRewards (account) {
  if (!account) return false
  return toNumber(account.reward_hive_balance) > 0 ||
    toNumber(account.reward_hbd_balance) > 0 ||
    toNumber(account.reward_vesting_balance) > 0
}

export function walletTransaction (entry) {
  return Array.isArray(entry) ? entry[1] : entry
}

export function walletTransactionOperation (entry) {
  const tx = walletTransaction(entry)
  return Array.isArray(tx && tx.op) ? tx.op : ['unknown', {}]
}

export function walletTransactionType (entry) {
  return walletTransactionOperation(entry)[0]
}

export function walletTransactionCategory (entry) {
  const type = walletTransactionType(entry)
  for (const category of Object.keys(CATEGORY_TYPES)) {
    if (CATEGORY_TYPES[category].includes(type)) return category
  }
  return 'other'
}

export function walletTransactionDirection (entry, username) {
  const [type, data = {}] = walletTransactionOperation(entry)
  switch (type) {
    case 'transfer':
      return data.to === username ? 'in' : data.from === username ? 'out' : 'neutral'
    case 'transfer_to_vesting':
      return data.to === username ? 'in' : 'out'
    case 'withdraw_vesting':
    case 'transfer_to_savings':
      return 'out'
    case 'transfer_from_savings':
    case 'fill_vesting_withdraw':
    case 'fill_transfer_from_savings':
    case 'interest':
    case 'claim_reward_balance':
    case 'liquidity_reward':
    case 'fill_convert_request':
    case 'fill_collateralized_convert_request':
      return 'in'
    default:
      return 'neutral'
  }
}

export function filterWalletTransactions (entries, { username, category = 'all', direction = 'all', search = '' } = {}) {
  const list = Array.isArray(entries) ? entries : []
  const query = String(search || '').trim().toLowerCase()
  return list.filter(entry => {
    if (category !== 'all' && walletTransactionCategory(entry) !== category) return false
    if (direction !== 'all' && walletTransactionDirection(entry, username) !== direction) return false
    if (query) {
      const tx = walletTransaction(entry)
      const haystack = [
        JSON.stringify((tx && tx.op && tx.op[1]) || {}),
        tx && tx.trx_id,
        tx && tx.block,
        tx && tx.timestamp
      ].join(' ').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export function groupWalletTransactions (entries) {
  const groups = []
  const byDate = new Map()
  for (const entry of entries || []) {
    const tx = walletTransaction(entry)
    const date = tx && tx.timestamp ? String(tx.timestamp).slice(0, 10) : 'unknown'
    if (!byDate.has(date)) {
      const group = { date, entries: [] }
      byDate.set(date, group)
      groups.push(group)
    }
    byDate.get(date).entries.push(entry)
  }
  return groups
}

function part (text, sign = 'none') {
  return { text: String(text), sign }
}

function hiveText (value, toHive) {
  const converted = typeof toHive === 'function' ? toHive(value) : toNumber(value)
  return tidyAmount(converted.toFixed(3) + ' HIVE')
}

export function walletOperationView (entry, { username, toHive } = {}) {
  const tx = walletTransaction(entry)
  const [type, data = {}] = walletTransactionOperation(entry)
  const direction = walletTransactionDirection(entry, username)
  const view = {
    type,
    icon: TRANSFER_ICONS[type] || 'receipt_long',
    label: type.replace(/_/g, ' '),
    counterparty: null,
    parts: [],
    tone: direction === 'in' ? 'in' : direction === 'out' ? 'out' : 'neutral',
    memo: '',
    virtual: Boolean(tx && tx.virtual_op)
  }

  switch (type) {
    case 'transfer': {
      const incoming = data.to === username
      view.label = incoming ? 'Received' : 'Sent'
      view.counterparty = incoming ? data.from : data.to
      view.parts = [part(data.amount, incoming ? '+' : '-')]
      view.memo = typeof data.memo === 'string' ? data.memo : ''
      view.tone = incoming ? 'in' : 'out'
      break
    }
    case 'transfer_to_vesting': {
      const incoming = data.to === username
      view.label = incoming ? 'Powered up' : 'Powered up for'
      view.counterparty = incoming ? null : data.to
      view.parts = [part(data.amount, incoming ? '+' : '-')]
      view.tone = incoming ? 'in' : 'out'
      break
    }
    case 'withdraw_vesting': {
      if (data.vesting_shares === '0.000000 VESTS') {
        view.label = 'Cancelled power down'
        view.tone = 'neutral'
      } else {
        view.label = 'Power down started'
        view.parts = [part(hiveText(data.vesting_shares, toHive), '-')]
        view.tone = 'out'
      }
      break
    }
    case 'fill_vesting_withdraw':
      view.label = 'Power down payment'
      view.parts = [part(data.deposited, '+')]
      view.tone = 'in'
      break
    case 'interest':
      view.label = 'HBD savings interest'
      view.counterparty = data.owner
      view.parts = [part(data.interest, '+')]
      view.tone = 'in'
      break
    case 'transfer_to_savings':
      view.label = 'Deposited to savings'
      view.counterparty = data.to !== username ? data.to : null
      view.parts = [part(data.amount, '-')]
      view.memo = typeof data.memo === 'string' ? data.memo : ''
      view.tone = 'out'
      break
    case 'transfer_from_savings':
      view.label = 'Savings withdrawal started'
      view.counterparty = data.to !== username ? data.to : null
      view.parts = [part(data.amount, 'none')]
      view.memo = typeof data.memo === 'string' ? data.memo : ''
      view.tone = 'neutral'
      break
    case 'fill_transfer_from_savings':
      view.label = 'Savings withdrawal received'
      view.counterparty = data.to !== username ? data.to : null
      view.parts = [part(data.amount, '+')]
      view.tone = 'in'
      break
    case 'cancel_transfer_from_savings':
      view.label = 'Savings withdrawal cancelled'
      view.counterparty = data.from !== username ? data.from : null
      view.tone = 'neutral'
      break
    case 'fill_convert_request':
      view.label = 'Conversion completed'
      view.counterparty = data.owner
      view.parts = [part(data.amount_in, '-'), part(data.amount_out, '+')]
      view.tone = 'in'
      break
    case 'convert':
      view.label = 'Conversion started'
      view.counterparty = data.owner
      view.parts = [part(data.amount, 'none')]
      view.tone = 'neutral'
      break
    case 'collateralized_convert':
      view.label = 'Collateralized conversion started'
      view.counterparty = data.owner
      view.parts = [part(data.amount, 'none')]
      view.tone = 'neutral'
      break
    case 'fill_order': {
      view.label = 'Order filled'
      view.counterparty = data.open_owner !== username ? data.open_owner : data.current_owner
      view.parts = data.open_owner === username
        ? [part(data.open_pays, '-'), part(data.current_pays, '+')]
        : [part(data.current_pays, '-'), part(data.open_pays, '+')]
      view.tone = 'neutral'
      break
    }
    case 'claim_reward_balance': {
      view.label = 'Claimed rewards'
      view.counterparty = data.account
      view.parts = []
      if (data.reward_hive && data.reward_hive !== '0.000 HIVE') view.parts.push(part(data.reward_hive, '+'))
      if (data.reward_hbd && data.reward_hbd !== '0.000 HBD') view.parts.push(part(data.reward_hbd, '+'))
      if (data.reward_vests && data.reward_vests !== '0.000000 VESTS') view.parts.push(part(hiveText(data.reward_vests, toHive).replace('HIVE', 'HP'), '+'))
      view.tone = 'in'
      break
    }
    case 'liquidity_reward':
      view.label = 'Liquidity reward'
      view.counterparty = data.owner
      view.parts = [part(data.payout, '+')]
      view.tone = 'in'
      break
    default:
      view.label = type.replace(/_/g, ' ')
      view.tone = 'neutral'
  }

  return view
}
