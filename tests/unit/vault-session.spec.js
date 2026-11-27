import { afterEach, describe, expect, it } from 'vitest'
import {
  createCreatorVault,
  saveCreatorVault
} from '../../src/services/vaultKeys'
import {
  creatorContentKey,
  creatorVaultExists,
  currentCreatorContentKey,
  currentVaultKid,
  getCreatorVault,
  isCreatorVaultUnlocked,
  lockCreatorVault,
  setCreatorVaultSession,
  unlockCreatorVault
} from '../../src/services/vaultSession'

function memoryStorage () {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  }
}

const PASSPHRASE = 'correct horse battery staple'

afterEach(() => lockCreatorVault())

describe('creator vault session', () => {
  it('derives the current period key id in UTC', () => {
    expect(currentVaultKid(new Date('2026-11-27T23:00:00Z'))).toBe('2026-11')
    expect(currentVaultKid(new Date('2027-01-01T00:00:00Z'))).toBe('2027-01')
  })

  it('unlocks a stored vault into memory and locks it again', async () => {
    const storage = memoryStorage()
    const vault = await createCreatorVault({ account: 'alice', passphrase: PASSPHRASE })
    await saveCreatorVault('alice', vault, PASSPHRASE, storage)
    expect(creatorVaultExists('alice', storage)).toBe(true)

    const unlocked = await unlockCreatorVault('alice', PASSPHRASE, { storage })
    expect(unlocked.account).toBe('alice')
    expect(isCreatorVaultUnlocked('alice')).toBe(true)
    expect(getCreatorVault('ALICE')).toBe(unlocked)
    expect(currentCreatorContentKey(unlocked)).toBe(vault.keyring[vault.kid])
    expect(creatorContentKey(unlocked, '1999-01')).toBe('')

    lockCreatorVault()
    expect(isCreatorVaultUnlocked('alice')).toBe(false)
    expect(getCreatorVault('alice')).toBeNull()
  })

  it('rejects the wrong passphrase and a missing vault', async () => {
    const storage = memoryStorage()
    const vault = await createCreatorVault({ account: 'alice', passphrase: PASSPHRASE })
    await saveCreatorVault('alice', vault, PASSPHRASE, storage)

    await expect(unlockCreatorVault('alice', 'wrong passphrase', { storage })).rejects.toThrow()
    await expect(unlockCreatorVault('bob', PASSPHRASE, { storage })).rejects.toThrow(/No Vault/)
  })

  it('adopts a freshly generated vault without touching storage', () => {
    const vault = { account: 'alice', kid: '2026-11', keyring: { '2026-11': 'key' }, ringKey: 'ring' }
    setCreatorVaultSession('Alice', vault)
    expect(getCreatorVault('alice')).toBe(vault)
    expect(creatorContentKey(vault, '2026-11')).toBe('key')
  })
})
