// Read-only pending-grant detector for the account menu.
//
// This does not issue anything. It gives the creator a visible badge on any
// Banksia page ("N subscribers need a grant") and links to the dashboard, where
// the existing manual/auto-issue flow does the signing. Results are cached
// briefly so opening the menu repeatedly does not hammer Hive.

import { fetchAccount, fetchAccountHistoryFiltered, fetchPostContent } from './chainData'
import { collectAccountHistory, VAULT_HISTORY_FILTER, vaultHistorySince } from './accountHistory'
import { readVaultSettings, vaultIsConfigured } from './vaultSettings'
import { deriveVaultPlan, parseVaultProduct } from './vaultProduct'
import { parseProductRef } from './shopOrders'
import { subscriberRows } from './vaultBulletin'
import { loadBulletinEntries, resolveBulletin, verifyBulletin } from './vaultUnlock'
import { readerKeyThumbprint } from './vaultCrypto'

const CACHE_MS = 60 * 1000
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000
const cache = new Map()

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function remember (name, count, now) {
  cache.set(name, { at: now, count })
  return count
}

/**
 * Count active subscribers whose current grant is missing or expires within a
 * day. Returns 0 for blogs without Vault or on any read failure; a notification
 * badge must never break the account menu.
 */
export async function getPendingGrantCount (account, { force = false, now = Date.now() } = {}) {
  const name = normalizeAccount(account)
  if (!name) return 0
  const cached = cache.get(name)
  if (!force && cached && now - cached.at < CACHE_MS) return cached.count
  try {
    const full = await fetchAccount(name, { force: true })
    if (!full) return remember(name, 0, now)
    const vault = readVaultSettings(full)
    if (!vaultIsConfigured(vault.settings)) return remember(name, 0, now)
    const ref = parseProductRef(vault.settings.product)
    if (!ref) return remember(name, 0, now)
    const productPost = await fetchPostContent(ref.author, ref.permlink, { force: true })
    const product = parseVaultProduct(productPost)
    if (!product || product.status !== 1 || product.author !== name) return remember(name, 0, now)
    const plan = deriveVaultPlan(productPost, {
      fallback: {
        executions: vault.settings.executions,
        container: vault.settings.container,
        archive: vault.settings.archive
      }
    })
    if (!plan) return remember(name, 0, now)

    const history = await collectAccountHistory({
      account: name,
      fetchPage: (accountName, options) => fetchAccountHistoryFiltered(accountName, {
        ...options,
        ...VAULT_HISTORY_FILTER
      }),
      pages: 3,
      since: vaultHistorySince(now, 90)
    })
    const rows = subscriberRows(history.rows, plan, { now })
    if (!rows.length) {
      cache.set(name, { at: now, count: 0 })
      return 0
    }
    const rkts = []
    for (const row of rows) {
      try {
        rkts.push(await readerKeyThumbprint(row.readerKey))
      } catch {
        // A malformed key is counted as pending by the loop below.
      }
    }

    const resolved = await resolveBulletin({ blog: name, settings: vault.settings, force: true })
    if (!resolved) return 0
    const verified = await verifyBulletin({ bulletin: resolved.bulletin })
    if (!verified.ok) return 0
    const merged = await loadBulletinEntries({ bulletin: resolved.bulletin, readerRkts: rkts })
    if (!merged) return 0
    const entries = Array.isArray(merged.entries) ? merged.entries : []

    let count = 0
    for (const row of rows) {
      if (row.active === false) continue
      let rkt = ''
      try {
        rkt = await readerKeyThumbprint(row.readerKey)
      } catch {
        continue
      }
      const entry = entries.find(item => item.rkt === rkt)
      const expiry = entry ? Date.parse(entry.expires) : 0
      if (!entry || !Number.isFinite(expiry) || expiry <= now + PENDING_WINDOW_MS) count++
    }
    cache.set(name, { at: now, count })
    return count
  } catch {
    return 0
  }
}

export function clearPendingGrantCache (account = null) {
  const name = normalizeAccount(account)
  if (name) cache.delete(name)
  else cache.clear()
}
