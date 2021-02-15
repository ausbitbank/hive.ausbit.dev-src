// Code kindly provided by Asgarth of peakd.com and probably butchered by ausbit

import hive from '@hiveio/hive-js'
import { getPosting, unlock, lock, save, remove, allUsers } from './store'
import api from './api'

export const MIN_PASSWORD_LENGTH = 5

const allAccounts = () => {
  return allUsers()
}

const isAccountUnlocked = username => {
  return getPosting(username) && getPosting(username).length > 0
}

const unlockAccount = async (username, password, keepUnlocked = false) => {
  // validate params
  if (!username || typeof username !== 'string' || hive.utils.validateAccountName(username)) {
    throw new Error('Invalid username')
  }
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('Invalid password')
  }

  return unlock(username, password, keepUnlocked)
}

const lockAccount = async username => {
  return lock(username)
}

const importAccount = async (username, password, posting, active, memo) => {
  // validate params
  if (!username || typeof username !== 'string' || hive.utils.validateAccountName(username)) {
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
  if (!hive.auth.isWif(posting) || !validateKey(account, 'posting', posting)) {
    throw new Error('Posting key not valid or not matching the current key for this account')
  }
  if (active && (!hive.auth.isWif(active) || !validateKey(account, 'active', active))) {
    throw new Error('Active key not valid or not matching the current key for this account')
  }
  if (memo && (!hive.auth.isWif(memo) || !validateKey(account, 'memo', memo))) {
    throw new Error('Memo key not valid or not matching the current key for this account')
  }
  return save(username, password, { posting: posting, active: active, memo: memo })
}

const removeAccount = async username => {
  return remove(username)
}

const validateKey = (account, role, privateKey) => {
  try {
    // if memo look in account.memo_key otherwise carry on
    if (role === 'memo') {
      if (hive.auth.wifIsValid(privateKey, account.memo_key)) {
        return true
      }
    }
    for (const pubKey of account[role].key_auths) {
      if (hive.auth.wifIsValid(privateKey, pubKey[0])) {
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
  api
}
