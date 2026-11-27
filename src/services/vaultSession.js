// In-memory creator Vault session.
//
// The creator vault is encrypted at rest by `vaultKeys.js`. Once the creator
// unlocks it for a signing session, the plaintext vault lives in memory only:
// never in localStorage, sessionStorage, the service worker, logs or analytics.
// A reload or `lockCreatorVault()` clears it.
//
// Keeping this tiny module separate lets the composer and the creator dashboard
// share one unlocked vault without either owning the other's component state.

import { loadCreatorVault, hasCreatorVault } from './vaultKeys'

let session = null // { account, vault }

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

/** Current content-key id in `YYYY-MM` form. */
export function currentVaultKid (now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return year + '-' + month
}

/**
 * Unlock the creator vault into memory.
 *
 * Returns the plaintext vault object, or throws a readable error. The caller is
 * responsible for collecting the passphrase; it is never retained here.
 */
export async function unlockCreatorVault (account, passphrase, { storage = null } = {}) {
  const name = normalizeAccount(account)
  if (!name) throw new Error('A Hive account is required to unlock the vault.')
  if (!passphrase) throw new Error('The vault passphrase is required.')
  const options = storage ? { storage } : {}
  const vault = await loadCreatorVault(name, passphrase, options.storage)
  if (!vault) throw new Error('No Vault is stored on this device for @' + name + '.')
  session = { account: name, vault }
  return vault
}

/** Adopt an already-decrypted vault (used right after generation/import). */
export function setCreatorVaultSession (account, vault) {
  const name = normalizeAccount(account)
  if (!name || !vault) return null
  session = { account: name, vault }
  return vault
}

/** The unlocked vault for this account, or null. */
export function getCreatorVault (account) {
  const name = normalizeAccount(account)
  if (!session || session.account !== name) return null
  return session.vault
}

/** True when this account's vault is unlocked in memory. */
export function isCreatorVaultUnlocked (account) {
  return Boolean(getCreatorVault(account))
}

/** True when an encrypted vault exists on this device. */
export function creatorVaultExists (account, storage = null) {
  return hasCreatorVault(normalizeAccount(account), storage || undefined)
}

/** Raw base64url content key for a kid, or '' when the vault lacks it. */
export function creatorContentKey (vault, kid) {
  if (!vault || !vault.keyring || typeof vault.keyring !== 'object') return ''
  const key = vault.keyring[kid]
  return typeof key === 'string' ? key : ''
}

/** The current period's content key, or '' when the vault is not usable. */
export function currentCreatorContentKey (vault, now = new Date()) {
  return creatorContentKey(vault, currentVaultKid(now))
}

/** Drop the in-memory vault. */
export function lockCreatorVault () {
  session = null
}
