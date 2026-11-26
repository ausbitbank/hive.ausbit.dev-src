// Import a locally generated Hive account into the Hive Keychain extension.
//
// Keychain's `requestAddAccount` accepts the account name plus active, posting
// and memo private keys. It does not require the account to exist on-chain yet,
// which is what makes it useful during onboarding: the new owner can add the
// account to Keychain before the sponsor broadcasts the creation.

import { keychain } from '@hiveio/keychain'

export function hasHiveKeychain () {
  return typeof window !== 'undefined' && Boolean(window.hive_keychain)
}

export function normalizeKeychainImportResult (result) {
  if (result?.success) {
    return {
      success: true,
      message: 'Imported active, posting and memo keys into Hive Keychain.'
    }
  }
  if (result?.cancel) {
    return { success: false, message: 'Cancelled in Hive Keychain.' }
  }
  if (result?.notInstalled) {
    return { success: false, message: 'Hive Keychain extension was not found. Install it or import the keys manually.' }
  }
  if (result?.message || result?.msg || result?.error) {
    return {
      success: false,
      message: result?.message || result?.msg || result?.error
    }
  }
  if (!hasHiveKeychain()) {
    return { success: false, message: 'Hive Keychain extension was not found. Install it or import the keys manually.' }
  }
  return { success: false, message: 'Hive Keychain did not import the account.' }
}

/**
 * Add a generated account to Hive Keychain. Owner keys are intentionally not
 * passed; Keychain stores active/posting/memo and the owner key stays offline.
 *
 * @param {{ username: string, active: string, posting: string, memo: string }} keys
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function importKeysToKeychain (keys = {}) {
  const username = String(keys.username || '').trim().toLowerCase()
  if (!username) return { success: false, message: 'The account name is missing.' }
  if (!keys.active || !keys.posting || !keys.memo) {
    return { success: false, message: 'Active, posting and memo keys are required for Hive Keychain.' }
  }
  if (!hasHiveKeychain()) {
    return normalizeKeychainImportResult({ notInstalled: true })
  }

  try {
    const result = await keychain(window, 'requestAddAccount', username, {
      active: keys.active,
      posting: keys.posting,
      memo: keys.memo
    })
    return normalizeKeychainImportResult(result)
  } catch (error) {
    return {
      success: false,
      message: error?.message || 'Could not import the account into Hive Keychain.'
    }
  }
}
