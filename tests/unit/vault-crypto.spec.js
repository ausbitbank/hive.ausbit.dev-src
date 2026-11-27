import { describe, expect, it } from 'vitest'
import {
  CONTENT_AAD_PREFIX,
  VAULT_ALG,
  VAULT_WRAP_ALG,
  VaultCryptoError,
  base64UrlDecode,
  base64UrlEncode,
  canonicalJson,
  decryptPayload,
  deriveWrapKey,
  ecdhSharedSecret,
  encryptPayload,
  exportReaderPrivateJwk,
  exportReaderPublicKey,
  generateReaderKeyPair,
  importContentKey,
  importReaderPrivateKey,
  importReaderPublicKey,
  openKeyring,
  randomBytes,
  randomKey,
  readerKeyThumbprint,
  readerPublicKeyBytes,
  sealKeyring,
  sha256Base64Url,
  sha256Bytes,
  sha256Hex,
  unwrapRingKey,
  wrapRingKey,
  exportContentKey
} from '../../src/services/vaultCrypto'

const HEADER = {
  blog: 'alice',
  permlink: 'members-only',
  kid: '2026-11',
  mode: 'section'
}

function flipLastByte (value) {
  const bytes = base64UrlDecode(value)
  bytes[bytes.length - 1] ^= 0x01
  return base64UrlEncode(bytes)
}

describe('vault canonical JSON', () => {
  it('sorts keys recursively and removes whitespace', () => {
    const value = { b: 1, a: { d: 'x', c: [true, null, 'é'] }, n: -2 }
    expect(canonicalJson(value)).toBe('{"a":{"c":[true,null,"é"],"d":"x"},"b":1,"n":-2}')
  })

  it('is stable regardless of insertion order', () => {
    expect(canonicalJson({ z: 1, a: 2 })).toBe(canonicalJson({ a: 2, z: 1 }))
    expect(canonicalJson({ a: { y: 1, x: 2 } })).toBe(canonicalJson({ a: { x: 2, y: 1 } }))
  })

  it('uses JSON-compatible escaping', () => {
    const value = { quote: 'a"b\\c', newline: 'line\nbreak', control: '\u0001' }
    expect(canonicalJson(value)).toBe(JSON.stringify({
      control: '\u0001',
      newline: 'line\nbreak',
      quote: 'a"b\\c'
    }))
  })

  it('supports arrays, empty objects and null', () => {
    expect(canonicalJson([])).toBe('[]')
    expect(canonicalJson({})).toBe('{}')
    expect(canonicalJson([null, {}, []])).toBe('[null,{},[]]')
  })

  it('rejects floats and non-finite numbers', () => {
    for (const value of [1.5, NaN, Infinity, -Infinity]) {
      expect(() => canonicalJson({ value })).toThrow(VaultCryptoError)
    }
  })

  it('rejects undefined, functions, BigInt and cycles', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(/undefined/)
    expect(() => canonicalJson([undefined])).toThrow(VaultCryptoError)
    expect(() => canonicalJson({ a: () => 1 })).toThrow(VaultCryptoError)
    expect(() => canonicalJson({ a: 1n })).toThrow(VaultCryptoError)

    const cyclic = { a: 1 }
    cyclic.self = cyclic
    expect(() => canonicalJson(cyclic)).toThrow(/cyclic/)
  })

  it('rejects non-plain objects', () => {
    expect(() => canonicalJson({ date: new Date() })).toThrow(VaultCryptoError)
    expect(() => canonicalJson(new Map())).toThrow(VaultCryptoError)
  })
})

describe('vault base64url', () => {
  it('round-trips bytes without padding', () => {
    const bytes = Uint8Array.from([0x00, 0x01, 0x02, 0xfd, 0xfe, 0xff])
    const encoded = base64UrlEncode(bytes)
    expect(encoded).toBe('AAEC_f7_')
    expect(encoded).not.toContain('=')
    expect(Array.from(base64UrlDecode(encoded))).toEqual(Array.from(bytes))
  })

  it('accepts ArrayBuffer and views', () => {
    const bytes = Uint8Array.from([1, 2, 3, 4])
    expect(base64UrlEncode(bytes.buffer)).toBe(base64UrlEncode(bytes))
    expect(base64UrlEncode(bytes.subarray(1, 3))).toBe('AgM')
  })

  it('tolerates padded input but rejects malformed strings', () => {
    expect(Array.from(base64UrlDecode('AAEC_f7_=='))).toEqual([0, 1, 2, 0xfd, 0xfe, 0xff])
    expect(() => base64UrlDecode('a')).toThrow(VaultCryptoError)
    expect(() => base64UrlDecode('not base64!')).toThrow(VaultCryptoError)
    expect(() => base64UrlDecode(42)).toThrow(VaultCryptoError)
  })
})

describe('vault random helpers', () => {
  it('returns a 32-byte raw AES key', () => {
    const key = randomKey()
    expect(base64UrlDecode(key)).toHaveLength(32)
    expect(randomKey()).not.toBe(key)
  })

  it('validates randomBytes input', () => {
    expect(randomBytes(0)).toHaveLength(0)
    expect(randomBytes(12)).toHaveLength(12)
    expect(() => randomBytes(-1)).toThrow(VaultCryptoError)
    expect(() => randomBytes(1.5)).toThrow(VaultCryptoError)
  })

  it('imports and exports content keys', async () => {
    const raw = randomKey()
    const key = await importContentKey(raw)
    expect(await exportContentKey(key)).toBe(raw)
  })
})

describe('vault hashing', () => {
  it('matches the SHA-256 abc test vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256Base64Url('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0')
    expect(await sha256Bytes('abc')).toHaveLength(32)
  })

  it('accepts bytes as well as UTF-8 strings', async () => {
    const bytes = new TextEncoder().encode('abc')
    expect(await sha256Hex(bytes)).toBe(await sha256Hex('abc'))
  })
})

describe('vault reader keys', () => {
  it('generates a P-256 keypair with a canonical public key', async () => {
    const pair = await generateReaderKeyPair()
    expect(pair.publicKeyB64.startsWith('p256:')).toBe(true)
    const bytes = await readerPublicKeyBytes(pair.publicKeyB64)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04)
    expect(await exportReaderPublicKey(pair)).toBe(pair.publicKeyB64)
    expect(pair.privateKey.extractable).toBe(false)
  })

  it('imports every supported public key shape', async () => {
    const pair = await generateReaderKeyPair()
    const byString = await importReaderPublicKey(pair.publicKeyB64)
    const byBare = await importReaderPublicKey(pair.publicKeyB64.slice('p256:'.length))
    const byBytes = await importReaderPublicKey(await readerPublicKeyBytes(pair.publicKeyB64))
    const byJwk = await importReaderPublicKey(await crypto.subtle.exportKey('jwk', pair.publicKey))
    const byKey = await importReaderPublicKey(pair.publicKey)

    for (const key of [byString, byBare, byBytes, byJwk, byKey]) {
      expect(await exportReaderPublicKey(key)).toBe(pair.publicKeyB64)
    }
  })

  it('rejects off-curve and malformed public keys', async () => {
    const bytes = new Uint8Array(65)
    bytes[0] = 0x04
    for (let index = 1; index < 65; index += 1) bytes[index] = 0xff
    await expect(importReaderPublicKey(bytes)).rejects.toThrow(VaultCryptoError)
    await expect(importReaderPublicKey('p256:AAAA')).rejects.toThrow(VaultCryptoError)
    await expect(importReaderPublicKey(null)).rejects.toThrow(VaultCryptoError)
  })

  it('computes a deterministic 16-hex thumbprint', async () => {
    const pair = await generateReaderKeyPair()
    const first = await readerKeyThumbprint(pair.publicKey)
    const second = await readerKeyThumbprint(pair.publicKeyB64)
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{16}$/)

    const other = await generateReaderKeyPair()
    expect(await readerKeyThumbprint(other.publicKey)).not.toBe(first)
  })

  it('produces symmetric ECDH secrets', async () => {
    const alice = await generateReaderKeyPair()
    const bob = await generateReaderKeyPair()
    const fromAlice = await ecdhSharedSecret(alice.privateKey, bob.publicKeyB64)
    const fromBob = await ecdhSharedSecret(bob.privateKey, alice.publicKeyB64)
    expect(Array.from(fromAlice)).toEqual(Array.from(fromBob))
    expect(fromAlice).toHaveLength(32)
  })

  it('exports private JWKs only when extractable', async () => {
    const fixed = await generateReaderKeyPair({ extractable: true })
    const jwk = await exportReaderPrivateJwk(fixed.privateKey)
    expect(jwk.kty).toBe('EC')
    expect(jwk.crv).toBe('P-256')
    expect(typeof jwk.d).toBe('string')

    const imported = await importReaderPrivateKey(jwk, { extractable: true })
    expect(await readerKeyThumbprint(imported)).toBe(await readerKeyThumbprint(fixed.publicKeyB64))

    const locked = await generateReaderKeyPair()
    await expect(exportReaderPrivateJwk(locked.privateKey)).rejects.toMatchObject({ code: 'VAULT_BAD_KEY' })
  })
})

describe('vault payload encryption', () => {
  it('round-trips text and reports bytes and hash', async () => {
    const key = randomKey()
    const plaintext = 'Members only — café ☕ 日本語 🚀\nSecond line.'

    const payload = await encryptPayload(plaintext, key, HEADER)
    expect(payload.alg).toBe(VAULT_ALG)
    expect(payload.bytes).toBe(new TextEncoder().encode(plaintext).length)
    expect(payload.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(base64UrlDecode(payload.iv)).toHaveLength(12)
    expect(await decryptPayload(payload, key, HEADER)).toBe(plaintext)
  })

  it('uses a fresh IV for every encryption', async () => {
    const key = randomKey()
    const first = await encryptPayload('same', key, HEADER)
    const second = await encryptPayload('same', key, HEADER)
    expect(first.iv).not.toBe(second.iv)
    expect(first.ct).not.toBe(second.ct)
  })

  it('matches the fixed AES-256-GCM content test vector', async () => {
    // Interop vector: all-zero 256-bit key, all-zero 12-byte IV, the content
    // AAD for blog=alice permlink=vector kid=2026-11 mode=section.
    const keyBytes = new Uint8Array(32)
    const iv = new Uint8Array(12)
    const aad = new TextEncoder().encode(`${CONTENT_AAD_PREFIX}|alice|vector|2026-11|section`)
    const plaintext = new TextEncoder().encode('Banksia Vault test vector')
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
    const ct = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      key,
      plaintext
    ))

    expect(base64UrlEncode(ct)).toBe('jMYuVj4JCk5RL7C_ztPpfQEUI7xSxV4bo1h1jzJDzDDTbCYbnjfm69w')
    expect(`sha256:${await sha256Hex(plaintext)}`)
      .toBe('sha256:41304b4ecfa77908c0413fd596cb98b24eed61a161f89b2a02e22e7b5ca62b06')
  })

  it('fails closed on a tampered ciphertext', async () => {
    const key = randomKey()
    const payload = await encryptPayload('secret', key, HEADER)
    payload.ct = flipLastByte(payload.ct)
    await expect(decryptPayload(payload, key, HEADER)).rejects.toMatchObject({ code: 'VAULT_TAG' })
  })

  it('fails closed on the wrong key', async () => {
    const payload = await encryptPayload('secret', randomKey(), HEADER)
    await expect(decryptPayload(payload, randomKey(), HEADER)).rejects.toMatchObject({ code: 'VAULT_TAG' })
  })

  it('binds the AAD to blog, permlink, kid and mode', async () => {
    const key = randomKey()
    const payload = await encryptPayload('secret', key, HEADER)

    for (const variant of [
      { ...HEADER, blog: 'bob' },
      { ...HEADER, permlink: 'other' },
      { ...HEADER, kid: '2026-12' },
      { ...HEADER, mode: 'post' }
    ]) {
      await expect(decryptPayload(payload, key, variant)).rejects.toMatchObject({ code: 'VAULT_TAG' })
    }
  })

  it('rejects a hash mismatch with a typed error', async () => {
    const key = randomKey()
    const payload = await encryptPayload('secret', key, HEADER)
    payload.hash = 'sha256:' + '0'.repeat(64)
    await expect(decryptPayload(payload, key, HEADER)).rejects.toMatchObject({ code: 'VAULT_HASH' })
  })

  it('accepts a base64url plaintext hash', async () => {
    const key = randomKey()
    const plaintext = 'hash me'
    const payload = await encryptPayload(plaintext, key, HEADER)
    payload.hash = await sha256Base64Url(plaintext)
    expect(await decryptPayload(payload, key, HEADER)).toBe(plaintext)
  })

  it('rejects missing or malformed hashes', async () => {
    const key = randomKey()
    const payload = await encryptPayload('secret', key, HEADER)
    for (const hash of [undefined, '', 'sha256:xyz', 'not-a-hash']) {
      payload.hash = hash
      await expect(decryptPayload(payload, key, HEADER)).rejects.toMatchObject({ code: 'VAULT_HASH' })
    }
  })

  it('requires the four AAD header fields', async () => {
    const key = randomKey()
    const payload = await encryptPayload('secret', key, HEADER)
    const { kid: _kid, ...missingKid } = HEADER
    await expect(decryptPayload(payload, key, missingKid)).rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })
})

describe('vault ring key wrapping', () => {
  const header = {
    blog: 'alice',
    rkt: 'a1b2c3d4e5f6a7b8',
    period: '2026-11',
    tier: 'member',
    expires: '2026-12-27T12:00:00Z'
  }

  it('wraps and unwraps a ring key for the reader', async () => {
    const reader = await generateReaderKeyPair()
    const ringKey = randomKey()

    const entry = await wrapRingKey(ringKey, reader.publicKeyB64, header)
    expect(entry.alg).toBe(VAULT_WRAP_ALG)
    expect(base64UrlDecode(entry.epk)).toHaveLength(65)
    expect(base64UrlDecode(entry.iv)).toHaveLength(12)

    expect(await unwrapRingKey(entry, reader.privateKey, header, reader.publicKeyB64)).toBe(ringKey)
    expect(await unwrapRingKey(entry, reader, header)).toBe(ringKey)

    const extractable = await generateReaderKeyPair({ extractable: true })
    const entry2 = await wrapRingKey(ringKey, extractable.publicKey, header)
    expect(await unwrapRingKey(entry2, extractable.privateKey, header)).toBe(ringKey)
  })

  it('fails with the wrong reader key', async () => {
    const reader = await generateReaderKeyPair()
    const intruder = await generateReaderKeyPair()
    const entry = await wrapRingKey(randomKey(), reader.publicKeyB64, header)
    await expect(unwrapRingKey(entry, intruder.privateKey, header, intruder.publicKeyB64))
      .rejects.toMatchObject({ code: 'VAULT_TAG' })
  })

  it('fails with the wrong header or tampered entry', async () => {
    const reader = await generateReaderKeyPair()
    const entry = await wrapRingKey(randomKey(), reader.publicKeyB64, header)

    await expect(unwrapRingKey(entry, reader.privateKey, { ...header, tier: 'patron' }, reader.publicKeyB64))
      .rejects.toMatchObject({ code: 'VAULT_TAG' })

    const tampered = { ...entry, ct: flipLastByte(entry.ct) }
    await expect(unwrapRingKey(tampered, reader.privateKey, header, reader.publicKeyB64))
      .rejects.toMatchObject({ code: 'VAULT_TAG' })

    const badEpk = { ...entry, epk: flipLastByte(entry.epk) }
    await expect(unwrapRingKey(badEpk, reader.privateKey, header, reader.publicKeyB64))
      .rejects.toThrow(VaultCryptoError)
  })

  it('rejects an unsupported wrap algorithm', async () => {
    const reader = await generateReaderKeyPair()
    const entry = await wrapRingKey(randomKey(), reader.publicKeyB64, header)
    await expect(unwrapRingKey({ ...entry, alg: 'A128GCM' }, reader.privateKey, header, reader.publicKeyB64))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })

  it('derives the same wrapping key in the wrap direction', async () => {
    const reader = await generateReaderKeyPair()
    const ephemeral = await generateReaderKeyPair({ extractable: true })
    const epk = await readerPublicKeyBytes(ephemeral.publicKeyB64)
    const wrapKey = await deriveWrapKey(ephemeral.privateKey, reader.publicKeyB64, epk, header)
    expect(wrapKey.algorithm.name).toBe('AES-GCM')
    expect(wrapKey.algorithm.length).toBe(256)
  })
})

describe('vault keyring sealing', () => {
  const context = { blog: 'alice', period: '2026-11' }

  function keyringFixture () {
    return {
      '2026-10': randomKey(),
      '2026-11': randomKey()
    }
  }

  it('seals and opens the keyring', async () => {
    const keyring = keyringFixture()
    const ringKey = randomKey()
    const sealed = await sealKeyring(keyring, ringKey, context)

    expect(sealed.alg).toBe(VAULT_ALG)
    expect(base64UrlDecode(sealed.iv)).toHaveLength(12)
    expect(await openKeyring(sealed, ringKey, context)).toEqual(keyring)
    expect(await openKeyring(sealed, ringKey, context).then(k => k['2026-11'])).toBe(keyring['2026-11'])
  })

  it('accepts the keyring as JSON text', async () => {
    const keyring = keyringFixture()
    const ringKey = randomKey()
    const sealed = await sealKeyring(JSON.stringify(keyring), ringKey, context)
    expect(await openKeyring(sealed, ringKey, context)).toEqual(keyring)
  })

  it('fails on a tampered blob, wrong ring key or wrong context', async () => {
    const ringKey = randomKey()
    const sealed = await sealKeyring(keyringFixture(), ringKey, context)

    await expect(openKeyring({ ...sealed, ct: flipLastByte(sealed.ct) }, ringKey, context))
      .rejects.toMatchObject({ code: 'VAULT_TAG' })
    await expect(openKeyring(sealed, randomKey(), context))
      .rejects.toMatchObject({ code: 'VAULT_TAG' })
    await expect(openKeyring(sealed, ringKey, { ...context, period: '2026-12' }))
      .rejects.toMatchObject({ code: 'VAULT_TAG' })
  })
})
