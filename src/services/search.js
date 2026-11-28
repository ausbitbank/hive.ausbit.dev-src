import { BRAND } from '../config/brand'
import { validateAccountName } from './hiveNames'
import { isValidTag as isValidHiveTag } from '../utils/hiveTag'

const URL_HOSTS = [BRAND.domain, 'www.' + BRAND.domain, BRAND.legacyHost, 'hive.blog', 'peakd.com', 'ecency.com']
const ACCOUNT_SUBPAGES = [
  'wallet', 'posts', 'blog', 'feed', 'replies', 'comments', 'communities',
  'followers', 'following', 'tip', 'transfers', 'lightning', 'pos'
]
const SORT_ROUTES = ['trending', 'created', 'hot', 'payout', 'payout_comments', 'muted']

function isValidAccount (name) {
  if (!name) return false
  try {
    return validateAccountName(String(name).toLowerCase()) === null
  } catch {
    return false
  }
}

function isValidPermlink (permlink) {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(permlink || '')
}

function isValidTag (tag) {
  return isValidHiveTag(String(tag || '').toLowerCase())
}

function tidyNumber (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('en-US') : String(value)
}

function safeDecode (value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const LIGHTNING_INVOICE_RE = /^lnbc[0-9a-z]{20,}$/i
const LIGHTNING_ADDRESS_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

function lightningResult (value, kind) {
  const clean = String(value || '').trim()
  if (!clean) return null
  return {
    path: '/lightning?pay=' + encodeURIComponent(clean),
    label: kind === 'invoice' ? 'Lightning invoice' : 'Lightning address',
    description: kind === 'invoice'
      ? 'Open the invoice in the Hive ↔ Lightning pay dialog'
      : 'Send sats or pay with Hive/HBD',
    icon: 'bolt',
    kind: 'lightning',
    lightning: kind,
    value: clean
  }
}

function tagResult (tag) {
  const clean = String(tag || '').replace(/^#/, '').toLowerCase()
  if (!isValidTag(clean)) return null
  return {
    path: '/trending/' + clean,
    label: '#' + clean,
    description: 'Trending posts tagged #' + clean,
    icon: 'tag',
    kind: 'tag'
  }
}

function accountResult (user) {
  if (!isValidAccount(user)) return null
  return {
    path: '/@' + user.toLowerCase(),
    label: '@' + user.toLowerCase(),
    description: 'Hive account profile',
    icon: 'person',
    kind: 'account'
  }
}

function accountSubpageResult (user, page) {
  return {
    path: '/@' + user.toLowerCase() + '/' + page,
    label: '@' + user.toLowerCase() + ' / ' + page,
    description: 'Account ' + page,
    icon: page === 'wallet' ? 'account_balance_wallet' : 'person',
    kind: page === 'wallet' ? 'wallet' : 'account'
  }
}

function postResult (user, permlink) {
  if (!isValidAccount(user) || !isValidPermlink(permlink)) return null
  return {
    path: '/@' + user.toLowerCase() + '/' + permlink.toLowerCase(),
    label: user.toLowerCase() + '/' + permlink.toLowerCase(),
    description: 'Hive post',
    icon: 'article',
    kind: 'post'
  }
}

function parseUrl (raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (!URL_HOSTS.includes(host)) return null

  const segments = url.pathname
    .split('/')
    .map(segment => safeDecode(segment))
    .filter(segment => segment !== '')
  if (segments.length === 0) {
    return { path: '/', label: BRAND.name, description: 'Home', icon: 'home', kind: 'home' }
  }

  const atIndex = segments.findIndex(segment => segment.startsWith('@'))
  if (atIndex !== -1) {
    const user = segments[atIndex].slice(1)
    const next = (segments[atIndex + 1] || '').toLowerCase()
    if (!next) return accountResult(user)
    if (ACCOUNT_SUBPAGES.includes(next)) return accountSubpageResult(user, next)
    return postResult(user, next)
  }

  const first = (segments[0] || '').toLowerCase()
  if (/^\d+$/.test(first)) return blockResult(first)
  if (['block', 'b'].includes(first) && /^\d+$/.test(segments[1] || '')) return blockResult(segments[1])
  if (first === 'tx' && /^[0-9a-f]{40}$/i.test(segments[1] || '')) return txResult(segments[1])
  if (first === 'proposals' && /^\d+$/.test(segments[1] || '')) return proposalResult(segments[1])
  if (SORT_ROUTES.includes(first) && segments[1] && isValidTag(segments[1])) {
    return {
      path: '/' + first + '/' + segments[1].toLowerCase(),
      label: '#' + segments[1].toLowerCase(),
      description: first + ' posts tagged #' + segments[1].toLowerCase(),
      icon: 'tag',
      kind: 'tag'
    }
  }
  if (segments.length === 1 && isValidTag(first) && !isValidAccount(first)) return tagResult(first)

  return null
}

function blockResult (value) {
  return {
    path: '/b/' + value,
    label: 'Block ' + tidyNumber(value),
    description: 'Open block details',
    icon: 'view_agenda',
    kind: 'block'
  }
}

function txResult (value) {
  const id = String(value).toLowerCase()
  return {
    path: '/tx/' + id,
    label: 'Transaction ' + id.slice(0, 10) + '…',
    description: 'Open transaction details',
    icon: 'receipt_long',
    kind: 'tx'
  }
}

function proposalResult (value) {
  return {
    path: '/proposals/' + value,
    label: 'Proposal #' + value,
    description: 'DHF proposal details',
    icon: 'account_balance',
    kind: 'proposal'
  }
}

/**
 * Parse free text or a supported Hive front-end URL into a route result.
 * Returns null when the input cannot be understood.
 */
export function parseSearchRoute (raw) {
  const input = String(raw || '').trim()
  if (!input) return null

  const lightning = input.replace(/^lightning:/i, '').trim()
  if (LIGHTNING_INVOICE_RE.test(lightning)) return lightningResult(lightning, 'invoice')
  if (LIGHTNING_ADDRESS_RE.test(lightning)) return lightningResult(lightning, 'address')

  if (/^https?:\/\//i.test(input)) return parseUrl(input)
  if (input.startsWith('//')) return null

  const blockMatch = input.match(/^block\s+#?(\d+)$/i)
  if (blockMatch) return blockResult(blockMatch[1])

  const txMatch = input.match(/^tx\s+([0-9a-f]{40})$/i)
  if (txMatch) return txResult(txMatch[1])

  const proposalMatch = input.match(/^proposal\s+#?(\d+)$/i)
  if (proposalMatch) return proposalResult(proposalMatch[1])

  if (/^\d+$/.test(input)) return blockResult(input)
  if (/^[0-9a-f]{40}$/i.test(input)) return txResult(input)

  if (input.startsWith('@')) {
    const parts = input.slice(1).split('/')
    const user = (parts[0] || '').toLowerCase()
    if (!isValidAccount(user)) return null
    if (parts.length > 1 && parts[1] !== '') {
      const next = parts[1].toLowerCase()
      if (ACCOUNT_SUBPAGES.includes(next)) return accountSubpageResult(user, next)
      return postResult(user, next)
    }
    return accountResult(user)
  }

  if (input.startsWith('#')) return tagResult(input.slice(1))
  if (/^hive-\d+$/i.test(input)) return tagResult(input)
  if (isValidAccount(input)) return accountResult(input)
  if (isValidTag(input)) return tagResult(input)

  return null
}
