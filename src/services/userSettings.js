// Account-scoped settings storage.
//
// Settings include posting beneficiaries and vote weight, so they must not be
// shared by every Hive account in the same browser. The legacy unscoped key is
// adopted once by the first account that reads it and then removed.

import { LocalStorage, SessionStorage } from 'quasar'

export const SETTINGS_PREFIX = 'settings:'

export function settingsStorageKey (username) {
  const name = String(username || '').trim().toLowerCase()
  return SETTINGS_PREFIX + (name || 'guest')
}

export function currentUsername () {
  try {
    return String(SessionStorage.getItem('loggedInUser') || '').trim().toLowerCase()
  } catch {
    return ''
  }
}

/** Stored settings for an account, or null when none exist yet. */
export function readStoredSettings (username = currentUsername()) {
  try {
    const name = String(username || '').trim().toLowerCase()
    const scoped = LocalStorage.getItem(settingsStorageKey(name))
    if (scoped) return scoped
    // Only an account-scoped read may adopt the legacy key. A guest/boot read
    // must not claim another identity's beneficiaries, vote weight or nodes and
    // delete the source before the real owner can migrate it.
    const legacy = name ? LocalStorage.getItem('settings') : null
    if (legacy) {
      LocalStorage.set(settingsStorageKey(name), legacy)
      LocalStorage.remove('settings')
      return legacy
    }
  } catch {}
  return null
}
