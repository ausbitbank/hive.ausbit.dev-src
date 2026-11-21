// Code kindly provided by Asgarth of peakd.com and probably butchered by ausbit

import { hive } from 'src/services/hive'
import { validateAccountName } from 'src/services/hiveNames'
import { isValidWif, toPublicKey } from 'src/services/hiveTx'
import {
  getPosting,
  unlock,
  lock,
  save,
  remove,
  allUsers,
  purgeLegacyUnlockedKeyCache,
  isUnlocked,
  touchActivity,
  lockExpired,
  DEFAULT_SESSION_TIMEOUT_MS
} from './store'
import api from './api'

// Remove plaintext unlocked keys left behind by older SmartLock versions.
purgeLegacyUnlockedKeyCache()

// Minimum length for NEW imports only. Existing accounts with shorter
// passwords can still be unlocked (see unlockAccount below).
export const MIN_PASSWORD_LENGTH = 8

const allAccounts = () => {
  return allUsers()
}

const isAccountUnlocked = (username, timeoutMs = DEFAULT_SESSION_TIMEOUT_MS) => {
  return isUnlocked(username, timeoutMs) && Boolean(getPosting(username))
}

const unlockAccount = async (username, password, keepUnlocked = false) => {
  // validate params
  if (!username || typeof username !== 'string' || validateAccountName(username)) {
    throw new Error('Invalid username')
  }
  // Existing accounts may have shorter passwords; accept any non-empty value.
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new Error('Invalid password')
  }

  return unlock(username, password, keepUnlocked)
}

const lockAccount = async username => {
  return lock(username)
}

const importAccount = async (username, password, posting, active, memo) => {
  // validate params
  if (!username || typeof username !== 'string' || validateAccountName(username)) {
    throw new Error('Invalid account name')
  }
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('Invalid password')
  }
  if (!posting) {
    throw new Error('Posting key is required')
  }

  // validate account
  const accounts = await hive.api.getAccountsAsync([username])
  if (!accounts || !Array.isArray(accounts) || accounts.length !== 1) {
    throw new Error('Account not found')
  }

  // validate keys
  const account = accounts[0]
  if (!(await isValidWif(posting)) || !(await validateKey(account, 'posting', posting))) {
    throw new Error('Posting key not valid or not matching the current key for this account')
  }
  if (active && (!(await isValidWif(active)) || !(await validateKey(account, 'active', active)))) {
    throw new Error('Active key not valid or not matching the current key for this account')
  }
  if (memo && (!(await isValidWif(memo)) || !(await validateKey(account, 'memo', memo)))) {
    throw new Error('Memo key not valid or not matching the current key for this account')
  }
  return save(username, password, { posting: posting, active: active, memo: memo })
}

const removeAccount = async username => {
  return remove(username)
}

const validateKey = async (account, role, privateKey) => {
  try {
    const publicKey = await toPublicKey(privateKey)
    // if memo look in account.memo_key otherwise carry on
    if (role === 'memo') {
      return publicKey === account.memo_key
    }
    for (const pubKey of account[role].key_auths) {
      if (publicKey === pubKey[0]) {
        return true
      }
    }
  } catch (error) {
    console.error('Error validating private key: ', error)
  }

  return false
}

export default {
  allAccounts,
  isAccountUnlocked,
  unlockAccount,
  lockAccount,
  importAccount,
  removeAccount,
  touchActivity,
  lockExpired,
  api
}
