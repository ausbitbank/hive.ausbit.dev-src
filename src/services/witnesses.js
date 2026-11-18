// Pure helpers and queue builders for the witness directory and witness tools.
//
// The directory keeps its filters, sorting, health checks and vote-weight
// calculations here so they can be unit tested without mounting a page.
import moment from '../utils/time'

export const DISABLED_SIGNING_KEY = 'STM1111111111111111111111111111111114T1Anm'
export const MAX_WITNESS_VOTES = 30
export const CONSENSUS_WITNESSES = 21
/** The top 20 witnesses are elected; rank 21 is the backup that only signs on demand. */
export const SCHEDULED_WITNESSES = 20
export const PARTICIPATION_WINDOW = 128
export const PRICE_FEED_STALE_HOURS = 24
/** Tolerate head lag and schedule position across several 21-block rounds. */
export const MISSED_BLOCK_GAP = 60
export const HARDFORK_TAG_BASE = 'https://gitlab.syncad.com/hive/hive/-/tags/v'

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
const ACCOUNT_NAME_RE = /^[a-z][a-z0-9.-]{2,15}$/
const SIGNING_KEY_RE = /^STM[1-9A-HJ-NP-Za-km-z]{48,52}$/

export function parseAmount (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

export function vestsToHp (vests, globalProps) {
  const shares = parseAmount(globalProps?.total_vesting_shares)
  const fund = parseAmount(globalProps?.total_vesting_fund_hive)
  if (!shares || !fund) return 0
  return (parseAmount(vests) / shares) * fund
}

/** Witness approval is stored in micro-VESTS. */
export function witnessVotesHp (votes, globalProps) {
  return vestsToHp(parseAmount(votes) / 1e6, globalProps)
}

export function accountEffectiveVests (account) {
  if (!account) return 0
  const owned = parseAmount(account.vesting_shares)
  const received = parseAmount(account.received_vesting_shares)
  const delegated = parseAmount(account.delegated_vesting_shares)
  const withdrawing = parseAmount(account.vesting_withdraw_rate)
  return Math.max(0, owned + received - delegated - withdrawing)
}

export function accountVoteWeight (account, globalProps) {
  const effectiveVests = accountEffectiveVests(account)
  const hp = vestsToHp(effectiveVests, globalProps)
  const networkHp = parseAmount(globalProps?.total_vesting_fund_hive)
  const votesUsed = Array.isArray(account?.witness_votes) ? account.witness_votes.length : 0

  return {
    hp,
    networkHp,
    percent: networkHp > 0 ? (hp / networkHp) * 100 : 0,
    votesUsed,
    votesLeft: Math.max(0, MAX_WITNESS_VOTES - votesUsed)
  }
}

export function formatHp (value, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }) + ' HP'
}

export function formatPercent (value, digits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toFixed(digits) + '%'
}

export function relativeTime (timestamp, now = Date.now()) {
  if (!timestamp) return 'never'
  const parsed = moment.utc(timestamp)
  if (!parsed.isValid()) return 'never'
  const diffMs = Number(now) - parsed.valueOf()
  if (!Number.isFinite(diffMs)) return 'never'
  if (diffMs < 0) return 'in ' + moment.duration(-diffMs, 'ms').humanize()
  if (diffMs < 60 * 1000) return 'just now'
  return moment.duration(diffMs, 'ms').humanize() + ' ago'
}

export function ageHours (timestamp, now = Date.now()) {
  if (!timestamp) return Infinity
  const parsed = moment.utc(timestamp)
  if (!parsed.isValid()) return Infinity
  return Math.max(0, (Number(now) - parsed.valueOf()) / (60 * 60 * 1000))
}

export function versionParts (version) {
  return String(version || '')
    .replace(/^v/i, '')
    .split('.')
    .map(part => parseInt(part, 10))
    .filter(Number.isFinite)
}

export function versionMatches (runningVersion, networkVersion) {
  const running = versionParts(runningVersion)
  const network = versionParts(networkVersion)
  if (running.length < 2 || network.length < 2) return true
  return running[0] === network[0] && running[1] === network[1]
}

/**
 * Describe the health problems for one witness.
 *
 * `headBlock` makes the missed-block check relative to the current chain head.
 * A healthy scheduled witness signs about once per 21-block round, but schedule
 * position and head lag can leave it quiet for a few rounds, so it is only
 * flagged after MISSED_BLOCK_GAP blocks. Total missed blocks are kept as
 * informational context because the counter is cumulative for the whole chain.
 */
export function witnessHealth (witness, {
  globalProps = null,
  hardforkVersion = '',
  headBlock = 0,
  now = Date.now(),
  staleHours = PRICE_FEED_STALE_HOURS,
  missedGap = MISSED_BLOCK_GAP,
  scheduled = null
} = {}) {
  if (!witness) return []
  const warnings = []
  const disabled = witness.signing_key === DISABLED_SIGNING_KEY
  const feedAge = ageHours(witness.last_hbd_exchange_update, now)
  const head = Number(headBlock) || parseAmount(globalProps?.head_block_number)
  const lastConfirmed = Number(witness.last_confirmed_block_num) || 0
  const gap = head > 0 && lastConfirmed > 0 ? Math.max(0, head - lastConfirmed) : 0

  if (disabled) {
    warnings.push({
      id: 'signing-disabled',
      label: 'Signing disabled',
      detail: 'The block signing key is the null key, so this witness cannot sign blocks.',
      severity: 'critical',
      icon: 'key_off'
    })
  }

  if (!witness.last_hbd_exchange_update || feedAge > staleHours) {
    warnings.push({
      id: 'stale-price-feed',
      label: 'Stale price feed',
      detail: witness.last_hbd_exchange_update
        ? 'Last HBD price feed was ' + relativeTime(witness.last_hbd_exchange_update, now) + '.'
        : 'No HBD price feed has been published.',
      severity: 'warning',
      icon: 'price_change'
    })
  }

  if (gap > missedGap && scheduled !== false) {
    warnings.push({
      id: 'missed-blocks',
      label: 'Missed blocks',
      detail: 'Last confirmed block was ' + gap.toLocaleString('en-US') + ' blocks ago; scheduled witnesses should confirm within ' + missedGap + ' blocks.',
      severity: 'warning',
      icon: 'block'
    })
  }

  if (!versionMatches(witness.running_version, hardforkVersion)) {
    warnings.push({
      id: 'version-mismatch',
      label: 'Version mismatch',
      detail: 'Running v' + (witness.running_version || '?') + ' while the network consensus version is v' + hardforkVersion + '.',
      severity: 'warning',
      icon: 'system_update'
    })
  }

  return warnings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

export function witnessStatus (warnings) {
  if (!Array.isArray(warnings)) return 'ok'
  if (warnings.some(item => item.severity === 'critical')) return 'critical'
  if (warnings.some(item => item.severity === 'warning')) return 'warning'
  return 'ok'
}

export function warningCount (warnings) {
  if (!Array.isArray(warnings)) return 0
  return warnings.filter(item => item.severity !== 'info').length
}

export function aggregateWitnessHealth (witnesses, options = {}) {
  const summary = {
    total: 0,
    critical: 0,
    warning: 0,
    ok: 0,
    disabled: 0,
    staleFeeds: 0,
    versionMismatches: 0,
    missedSlots: 0
  }

  for (const witness of Array.isArray(witnesses) ? witnesses : []) {
    const rows = Array.isArray(witness.health)
      ? witness.health
      : witnessHealth(witness, options)
    const status = witnessStatus(rows)
    summary.total += 1
    summary[status] += 1
    if (rows.some(item => item.id === 'signing-disabled')) summary.disabled += 1
    if (rows.some(item => item.id === 'stale-price-feed')) summary.staleFeeds += 1
    if (rows.some(item => item.id === 'version-mismatch')) summary.versionMismatches += 1
    if (rows.some(item => item.id === 'missed-blocks')) summary.missedSlots += 1
  }

  return summary
}

export function searchWitnesses (witnesses, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return Array.isArray(witnesses) ? witnesses : []
  return (Array.isArray(witnesses) ? witnesses : []).filter(witness => {
    const haystack = [
      witness.owner,
      witness.url,
      witness.running_version,
      witness.hardfork_version_vote,
      witness.props?.account_creation_fee
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

function sortValue (witness, key) {
  switch (key) {
    case 'votes':
      return Number(witness.votes) || 0
    case 'missed':
      return Number(witness.total_missed) || 0
    case 'pricefeed':
      return witness.last_hbd_exchange_update ? moment.utc(witness.last_hbd_exchange_update).valueOf() : 0
    case 'version':
      return String(witness.running_version || '')
    case 'name':
      return String(witness.owner || '').toLowerCase()
    case 'warnings':
      return Number(witness.warningCount) || 0
    case 'rank':
    default:
      return Number(witness.rank) || Number.MAX_SAFE_INTEGER
  }
}

export function sortWitnesses (witnesses, key = 'rank', direction = 'asc') {
  const list = (Array.isArray(witnesses) ? witnesses : []).slice()
  const dir = direction === 'desc' ? -1 : 1
  return list.sort((a, b) => {
    const left = sortValue(a, key)
    const right = sortValue(b, key)
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right)) * dir
    }
    if (left === right) return (Number(a.rank) || 0) - (Number(b.rank) || 0)
    return (left - right) * dir
  })
}

export function filterWitnesses (witnesses, {
  search = '',
  myVotesOnly = false,
  warningsOnly = false,
  votedNames = new Set()
} = {}) {
  let list = searchWitnesses(witnesses, search)
  if (myVotesOnly) {
    const voted = votedNames instanceof Set ? votedNames : new Set(votedNames || [])
    list = list.filter(witness => voted.has(witness.owner))
  }
  if (warningsOnly) {
    list = list.filter(witness => witnessStatus(witness.health) !== 'ok')
  }
  return list
}

export function topTwentyCutoffHp (witnesses, globalProps) {
  const sorted = (Array.isArray(witnesses) ? witnesses : [])
    .slice()
    .sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0))
  const cutoff = sorted[CONSENSUS_WITNESSES - 2]
  return cutoff ? witnessVotesHp(cutoff.votes, globalProps) : 0
}

/**
 * Show what a single witness vote is worth and how it moves a witness towards
 * the top-20 consensus set. One account may vote for up to 30 witnesses, and
 * every one of those votes carries the account's full effective HP.
 */
export function voteImpact (witnesses, owner, hp, globalProps) {
  const list = Array.isArray(witnesses) ? witnesses : []
  const amount = Math.max(0, Number(hp) || 0)
  const target = list.find(witness => witness.owner === owner)
  const cutoffHp = topTwentyCutoffHp(list, globalProps)
  const currentHp = target ? witnessVotesHp(target.votes, globalProps) : 0
  const afterHp = currentHp + amount

  if (!target) {
    return {
      owner,
      currentHp,
      afterHp,
      cutoffHp,
      gapHp: Math.max(0, cutoffHp - afterHp),
      entersTopTwenty: false
    }
  }

  const ranked = list
    .map(witness => ({
      owner: witness.owner,
      votes: Number(witness.votes) || 0
    }))
    .sort((a, b) => b.votes - a.votes)

  const currentIndex = ranked.findIndex(witness => witness.owner === owner)
  const hpPerVest = vestsToHp(1, globalProps)
  const currentRank = currentIndex >= 0 ? currentIndex + 1 : null
  if (!hpPerVest) {
    return {
      owner,
      currentHp,
      afterHp,
      cutoffHp,
      gapHp: Math.max(0, cutoffHp - afterHp),
      currentRank,
      projectedRank: currentRank,
      entersTopTwenty: currentRank !== null && currentRank <= CONSENSUS_WITNESSES - 1
    }
  }

  const totalVotes = (Number(target.votes) || 0) + (amount * 1e6) / hpPerVest
  const projected = ranked.filter(witness => witness.owner !== owner)
  projected.push({ owner, votes: totalVotes })
  projected.sort((a, b) => b.votes - a.votes)
  const projectedRank = projected.findIndex(witness => witness.owner === owner) + 1

  return {
    owner,
    currentHp,
    afterHp,
    cutoffHp,
    gapHp: Math.max(0, cutoffHp - afterHp),
    currentRank,
    projectedRank,
    entersTopTwenty: projectedRank > 0 && projectedRank <= CONSENSUS_WITNESSES - 1
  }
}

export function validateProxy (value, username = '') {
  const proxy = String(value || '').trim().toLowerCase()
  if (!proxy) return { valid: true, value: '', error: '' }
  if (proxy === String(username || '').toLowerCase()) {
    return { valid: false, value: proxy, error: 'You cannot set yourself as your own proxy.' }
  }
  if (!ACCOUNT_NAME_RE.test(proxy)) {
    return { valid: false, value: proxy, error: 'Enter a valid Hive account name (3–16 lowercase characters).' }
  }
  return { valid: true, value: proxy, error: '' }
}

export function validateSigningKey (value) {
  return SIGNING_KEY_RE.test(String(value || '').trim())
}

export function validateWitnessForm (form = {}) {
  const errors = {}
  const url = String(form.url || '').trim()
  if (!url) {
    errors.url = 'A witness URL is required.'
  } else {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) errors.url = 'Use an http:// or https:// URL.'
    } catch {
      errors.url = 'Enter a valid URL, including https://.'
    }
  }

  if (!validateSigningKey(form.signingKey)) {
    errors.signingKey = 'Enter a valid Hive public signing key starting with STM.'
  }

  if (!/^\d+(\.\d{1,3})? HIVE$/.test(String(form.accountCreationFee || '').trim())) {
    errors.accountCreationFee = 'Use a HIVE amount with up to three decimals, e.g. 3.000 HIVE.'
  }

  const blockSize = Number(form.maximumBlockSize)
  if (!Number.isInteger(blockSize) || blockSize < 65536 || blockSize > 2097152) {
    errors.maximumBlockSize = 'Block size must be an integer between 65536 and 2097152 bytes.'
  }

  const interest = Number(form.hbdInterestPercent)
  if (!Number.isFinite(interest) || interest < 0 || interest > 100) {
    errors.hbdInterestPercent = 'HBD interest must be between 0% and 100%.'
  } else if (Math.round(interest * 100) !== interest * 100) {
    errors.hbdInterestPercent = 'Use at most two decimal places for the HBD interest rate.'
  }

  const budget = Number(form.subsidyBudget)
  if (!Number.isInteger(budget) || budget < 0 || budget > 4294967295) {
    errors.subsidyBudget = 'Subsidy budget must be a non-negative integer.'
  }

  const decay = Number(form.subsidyDecay)
  if (!Number.isInteger(decay) || decay < 0 || decay > 4294967295) {
    errors.subsidyDecay = 'Subsidy decay must be a non-negative integer.'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function buildWitnessProps (form = {}) {
  return {
    account_creation_fee: String(form.accountCreationFee || '').trim(),
    maximum_block_size: Number(form.maximumBlockSize),
    hbd_interest_rate: Math.round(Number(form.hbdInterestPercent) * 100),
    account_subsidy_budget: Number(form.subsidyBudget),
    account_subsidy_decay: Number(form.subsidyDecay)
  }
}

export function buildWitnessUpdate ({ owner, form, fee = '0.000 HIVE' } = {}) {
  return {
    owner,
    url: String(form?.url || '').trim(),
    block_signing_key: String(form?.signingKey || '').trim(),
    props: buildWitnessProps(form),
    fee
  }
}

export function witnessVoteQueueItem (username, owner, approve) {
  return [
    username,
    'active',
    ['account_witness_vote', {
      account: username,
      witness: owner,
      approve: Boolean(approve)
    }]
  ]
}

export function witnessProxyQueueItem (username, proxy) {
  return [
    username,
    'active',
    ['account_witness_proxy', {
      account: username,
      proxy: String(proxy || '').trim().toLowerCase()
    }]
  ]
}

export function witnessUpdateQueueItem (owner, payload) {
  return [owner, 'active', ['witness_update', payload]]
}

export function cliWalletCommand (payload) {
  if (!payload) return ''
  return 'update_witness "' + payload.owner + '" "' + payload.url + '" "' +
    payload.block_signing_key + '" ' + JSON.stringify(payload.props) + ' true'
}

export function hardforkTagUrl (version) {
  return HARDFORK_TAG_BASE + String(version || '').replace(/^v/, '')
}

export function formFromWitness (witness) {
  if (!witness) {
    return {
      url: '',
      signingKey: '',
      accountCreationFee: '3.000 HIVE',
      maximumBlockSize: 65536,
      hbdInterestPercent: 10,
      subsidyBudget: 797,
      subsidyDecay: 347321
    }
  }
  return {
    url: witness.url || '',
    signingKey: witness.signing_key || '',
    accountCreationFee: witness.props?.account_creation_fee || '3.000 HIVE',
    maximumBlockSize: Number(witness.props?.maximum_block_size) || 65536,
    hbdInterestPercent: (Number(witness.props?.hbd_interest_rate) || 0) / 100,
    subsidyBudget: Number(witness.props?.account_subsidy_budget) || 0,
    subsidyDecay: Number(witness.props?.account_subsidy_decay) || 0
  }
}
