import { describe, expect, it } from 'vitest'
import {
  base64UrlDecode,
  base64UrlEncode,
  exportReaderPrivateJwk,
  generateReaderKeyPair,
  importReaderPrivateKey,
  readerKeyThumbprint
} from '../../src/services/vaultCrypto'
import {
  READER_RECOVERY_TYPE,
  VAULT_STORAGE_PREFIX,
  createCreatorVault,
  decryptVault,
  deleteCreatorVault,
  encryptVault,
  exportCreatorVault,
  exportReaderRecovery,
  hasCreatorVault,
  importCreatorVault,
  importReaderRecovery,
  loadCreatorVault,
  rotatePeriod,
  saveCreatorVault
} from '../../src/services/vaultKeys'

const PASS = 'correct horse battery staple'
const FIXED_NOW = new Date('2026-11-15T10:00:00Z')

function memoryStorage () {
  const data = new Map()
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: key => { data.delete(key) },
    entries: () => Array.from(data.entries())
  }
}

async function vaultFixture (overrides = {}) {
  return createCreatorVault({
    account: 'alice',
    passphrase: PASS,
    now: FIXED_NOW,
    ...overrides
  })
}

describe('creator vault creation', () => {
  it('creates one content key and a separate ring key for the period', async () => {
    const vault = await vaultFixture()
    expect(vault.v).toBe(1)
    expect(vault.account).toBe('alice')
    expect(vault.kid).toBe('2026-11')
    expect(vault.ringKid).toBe('2026-11')
    expect(vault.createdAt).toBe('2026-11-15T10:00:00.000Z')
    expect(Object.keys(vault.keyring)).toEqual(['2026-11'])
    expect(base64UrlDecode(vault.keyring['2026-11'])).toHaveLength(32)
    expect(base64UrlDecode(vault.ringKey)).toHaveLength(32)
    expect(vault.keyring['2026-11']).not.toBe(vault.ringKey)
  })

  it('derives the kid from the supplied date', async () => {
    const vault = await vaultFixture({ now: new Date('2027-01-02T03:04:05Z') })
    expect(vault.kid).toBe('2027-01')
    expect(vault.ringKid).toBe('2027-01')
  })

  it('rejects invalid accounts and passphrases', async () => {
    await expect(createCreatorVault({ account: 'A!', passphrase: PASS, now: FIXED_NOW }))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(createCreatorVault({ account: 'alice', passphrase: '', now: FIXED_NOW }))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })
})

describe('vault at-rest encryption', { tags: ['slow'] }, () => {
  it('encrypts and decrypts with PBKDF2-SHA256 and AES-256-GCM', async () => {
    const vault = await vaultFixture()
    const envelope = await encryptVault(vault, PASS)

    expect(envelope.v).toBe(1)
    expect(envelope.account).toBe('alice')
    expect(envelope.alg).toBe('PBKDF2-SHA256-A256GCM')
    expect(envelope.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: 310000 })
    expect(base64UrlDecode(envelope.kdf.salt)).toHaveLength(16)
    expect(base64UrlDecode(envelope.iv)).toHaveLength(12)

    const serialized = JSON.stringify(envelope)
    expect(serialized).not.toContain(vault.ringKey)
    expect(serialized).not.toContain(vault.keyring[vault.kid])

    expect(await decryptVault(envelope, PASS)).toEqual(vault)
    expect(await decryptVault(JSON.stringify(envelope), PASS)).toEqual(vault)
  })

  it('fails closed on the wrong passphrase or a tampered envelope', async () => {
    const vault = await vaultFixture()
    const envelope = await encryptVault(vault, PASS)

    await expect(decryptVault(envelope, 'wrong passphrase'))
      .rejects.toMatchObject({ code: 'VAULT_BAD_PASSPHRASE' })

    const ct = base64UrlDecode(envelope.ct)
    ct[ct.length - 1] ^= 0x01
    const tampered = { ...envelope, ct: base64UrlEncode(ct) }
    await expect(decryptVault(tampered, PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_PASSPHRASE' })
  })

  it('binds the envelope to the account', async () => {
    const vault = await vaultFixture()
    const envelope = await encryptVault(vault, PASS)
    await expect(decryptVault({ ...envelope, account: 'bob' }, PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_PASSPHRASE' })
  })

  it('rejects malformed envelopes', async () => {
    const vault = await vaultFixture()
    const envelope = await encryptVault(vault, PASS)
    await expect(decryptVault({ ...envelope, v: 2 }, PASS)).rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(decryptVault({ ...envelope, alg: 'A128GCM' }, PASS)).rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(decryptVault({ ...envelope, kdf: { ...envelope.kdf, iterations: 1 } }, PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })
})

describe('creator vault storage', { tags: ['slow'] }, () => {
  it('stores only the encrypted envelope', async () => {
    const vault = await vaultFixture()
    const storage = memoryStorage()
    const envelope = await saveCreatorVault('alice', vault, PASS, storage)

    const raw = storage.getItem(VAULT_STORAGE_PREFIX + 'alice')
    expect(raw).toBe(JSON.stringify(envelope))
    expect(raw).not.toContain(vault.ringKey)
    expect(raw).not.toContain(vault.keyring[vault.kid])
    expect(raw).not.toContain('keyring')

    expect(hasCreatorVault('alice', storage)).toBe(true)
    expect(await loadCreatorVault('alice', PASS, storage)).toEqual(vault)
  })

  it('returns null when no vault is stored and after deletion', async () => {
    const storage = memoryStorage()
    expect(hasCreatorVault('alice', storage)).toBe(false)
    expect(await loadCreatorVault('alice', PASS, storage)).toBeNull()

    const vault = await vaultFixture()
    await saveCreatorVault('alice', vault, PASS, storage)
    deleteCreatorVault('alice', storage)

    expect(hasCreatorVault('alice', storage)).toBe(false)
    expect(await loadCreatorVault('alice', PASS, storage)).toBeNull()
  })

  it('rejects a vault saved under another account', async () => {
    const vault = await vaultFixture()
    const storage = memoryStorage()
    await expect(saveCreatorVault('bob', vault, PASS, storage))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    expect(storage.entries()).toHaveLength(0)
  })
})

describe('creator vault export and import', { tags: ['slow'] }, () => {
  it('round-trips a downloadable backup', async () => {
    const vault = await vaultFixture()
    const backup = await exportCreatorVault(vault, PASS)

    expect(backup.type).toBe('banksia.vault.creator@1')
    expect(backup.vault.v).toBe(1)
    expect(JSON.stringify(backup)).not.toContain(vault.ringKey)

    expect(await importCreatorVault(backup, PASS)).toEqual(vault)
    expect(await importCreatorVault(JSON.stringify(backup), PASS)).toEqual(vault)
  })

  it('rejects a wrong passphrase and unsupported backups', async () => {
    const vault = await vaultFixture()
    const backup = await exportCreatorVault(vault, PASS)

    await expect(importCreatorVault(backup, 'wrong')).rejects.toMatchObject({ code: 'VAULT_BAD_PASSPHRASE' })
    await expect(importCreatorVault({ ...backup, type: 'banksia.vault.other@1' }, PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(importCreatorVault('{bad json', PASS)).rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })
})

describe('period rotation', () => {
  it('issues a new content key and ring key while keeping the archive', async () => {
    const vault = await vaultFixture()
    const rotated = rotatePeriod(vault, { kid: '2026-12' })

    expect(rotated.kid).toBe('2026-12')
    expect(rotated.ringKid).toBe('2026-12')
    expect(rotated.keyring['2026-11']).toBe(vault.keyring['2026-11'])
    expect(rotated.keyring['2026-12']).toBeDefined()
    expect(rotated.keyring['2026-12']).not.toBe(vault.keyring['2026-11'])
    expect(rotated.ringKey).not.toBe(vault.ringKey)

    expect(vault.kid).toBe('2026-11')
    expect(Object.keys(vault.keyring)).toEqual(['2026-11'])
    expect(rotated.account).toBe(vault.account)
    expect(rotated.createdAt).toBe(vault.createdAt)
  })

  it('derives the new kid from now when omitted', () => {
    return vaultFixture().then(vault => {
      const rotated = rotatePeriod(vault, { now: new Date('2026-12-03T00:00:00Z') })
      expect(rotated.kid).toBe('2026-12')
      expect(rotated.ringKid).toBe('2026-12')
    })
  })

  it('rejects an invalid kid', async () => {
    const vault = await vaultFixture()
    expect(() => rotatePeriod(vault, { kid: 'December' })).toThrow(/kid/)
  })
})

describe('reader recovery', { tags: ['slow'] }, () => {
  async function recoveryFixture () {
    const pair = await generateReaderKeyPair({ extractable: true })
    const privateJwk = await exportReaderPrivateJwk(pair.privateKey)
    const envelope = await exportReaderRecovery({
      account: 'bob',
      blog: 'alice',
      privateJwk,
      publicKeyB64: pair.publicKeyB64,
      passphrase: PASS
    })
    return { pair, privateJwk, envelope }
  }

  it('round-trips the reader private key without exposing it at rest', async () => {
    const { pair, privateJwk, envelope } = await recoveryFixture()

    expect(envelope.v).toBe(1)
    expect(envelope.type).toBe(READER_RECOVERY_TYPE)
    expect(envelope.alg).toBe('PBKDF2-SHA256-A256GCM')
    expect(envelope.kdf.iterations).toBe(310000)

    const serialized = JSON.stringify(envelope)
    expect(serialized).not.toContain(privateJwk.d)
    expect(serialized).not.toContain('privateJwk')

    const recovered = await importReaderRecovery(JSON.stringify(envelope), PASS)
    expect(recovered.account).toBe('bob')
    expect(recovered.blog).toBe('alice')
    expect(recovered.publicKeyB64).toBe(pair.publicKeyB64)
    expect(recovered.privateJwk.d).toBe(privateJwk.d)

    const imported = await importReaderPrivateKey(recovered.privateJwk, { extractable: true })
    expect(await readerKeyThumbprint(imported)).toBe(await readerKeyThumbprint(pair.publicKeyB64))
  })

  it('fails closed on the wrong passphrase', async () => {
    const { envelope } = await recoveryFixture()
    await expect(importReaderRecovery(envelope, 'wrong'))
      .rejects.toMatchObject({ code: 'VAULT_BAD_PASSPHRASE' })
  })

  it('rejects the wrong recovery type and malformed payloads', async () => {
    const { envelope } = await recoveryFixture()
    await expect(importReaderRecovery({ ...envelope, type: 'banksia.vault.other@1' }, PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(importReaderRecovery({ ...envelope, v: 2 }, PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(importReaderRecovery('{bad json', PASS))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })

  it('requires a p256 public key and a private JWK', async () => {
    const pair = await generateReaderKeyPair({ extractable: true })
    const privateJwk = await exportReaderPrivateJwk(pair.privateKey)
    await expect(exportReaderRecovery({
      account: 'bob',
      blog: 'alice',
      privateJwk,
      publicKeyB64: 'not-a-key',
      passphrase: PASS
    })).rejects.toMatchObject({ code: 'VAULT_BAD_KEY' })
    await expect(exportReaderRecovery({
      account: 'bob',
      blog: 'alice',
      privateJwk: null,
      publicKeyB64: pair.publicKeyB64,
      passphrase: PASS
    })).rejects.toMatchObject({ code: 'VAULT_BAD_KEY' })
  })
})
