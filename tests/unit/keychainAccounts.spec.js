import { describe, expect, it } from 'vitest'
import {
  importKeysToKeychain,
  normalizeKeychainImportResult
} from '../../src/services/keychainAccounts'

const KEYS = {
  username: 'alice',
  active: '5Kactive',
  posting: '5Kposting',
  memo: '5Kmemo'
}

describe('Hive Keychain account import', () => {
  it('normalises success, cancel and missing-extension results', () => {
    expect(normalizeKeychainImportResult({ success: true })).toMatchObject({ success: true })
    expect(normalizeKeychainImportResult({ cancel: true })).toMatchObject({
      success: false,
      message: /Cancelled/
    })
    expect(normalizeKeychainImportResult({ notInstalled: true })).toMatchObject({
      success: false,
      message: /was not found/
    })
    expect(normalizeKeychainImportResult({ message: 'Nope' })).toMatchObject({
      success: false,
      message: 'Nope'
    })
  })

  it('rejects incomplete keys before touching Keychain', async () => {
    await expect(importKeysToKeychain({ username: 'alice' })).resolves.toMatchObject({
      success: false,
      message: /required/
    })
    await expect(importKeysToKeychain({})).resolves.toMatchObject({
      success: false,
      message: /missing/
    })
  })

  it('returns a useful message when the extension is absent', async () => {
    await expect(importKeysToKeychain(KEYS)).resolves.toMatchObject({
      success: false,
      message: /was not found/
    })
  })
})
