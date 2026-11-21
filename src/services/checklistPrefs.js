// Per-account dismissals for advisory publish-checklist warnings.
//
// These are UI preferences, not draft data. Errors are never dismissible, and
// restoring the list is always available from the checklist panel.

export const DISMISSED_WARNINGS_PREFIX = 'composeDismissedWarnings:'
export const MAX_DISMISSED_WARNINGS = 40

function ownerKey (owner) {
  const account = String(owner || '').trim().toLowerCase()
  return /^[a-z][a-z0-9.-]{2,15}$/.test(account) ? account : 'guest'
}

export function dismissedWarningsKey (owner = null) {
  return DISMISSED_WARNINGS_PREFIX + ownerKey(owner)
}

function storageGet (storage, key) {
  if (!storage) return null
  if (typeof storage.getItem === 'function') return storage.getItem(key)
  if (typeof storage.get === 'function') return storage.get(key)
  return null
}

function storageSet (storage, key, value) {
  if (!storage) return false
  try {
    if (typeof storage.set === 'function') {
      storage.set(key, value)
      return true
    }
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, JSON.stringify(value))
      return true
    }
  } catch {
    return false
  }
  return false
}

function storageRemove (storage, key) {
  if (!storage) return
  try {
    if (typeof storage.remove === 'function') storage.remove(key)
    else if (typeof storage.removeItem === 'function') storage.removeItem(key)
  } catch {
    // A failed preference write must not block the composer.
  }
}

function normalizeKeys (values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .filter(value => typeof value === 'string')
      .map(value => value.trim())
      .filter(value => /^[a-z0-9-]{1,80}$/i.test(value))
  )].slice(0, MAX_DISMISSED_WARNINGS)
}

function parseDismissed (raw) {
  if (!raw) return []
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
    } catch {
      return []
    }
  }
  return normalizeKeys(parsed?.warnings)
}

export function readDismissedWarnings (storage, owner = null) {
  return parseDismissed(storageGet(storage, dismissedWarningsKey(owner)))
}

export function dismissWarning (storage, owner, key) {
  const warnings = normalizeKeys([...readDismissedWarnings(storage, owner), key])
  storageSet(storage, dismissedWarningsKey(owner), { version: 1, warnings })
  return warnings
}

export function restoreDismissedWarnings (storage, owner = null) {
  storageRemove(storage, dismissedWarningsKey(owner))
  return []
}
