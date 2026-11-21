import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createAuthKey,
  decryptPayload,
  encryptPayload
} from '../../src/services/hiveauth/crypto'

// Generated with crypto-js@4.2.0:
//   CryptoJS.AES.encrypt(JSON.stringify(payload), key).toString()
const FIXTURE_KEY = '03f63469-5a35-47cb-a6b4-e8c4d3144cf9'
const FIXTURE_PAYLOAD = 'U2FsdGVkX192GXbPyFgAJPzK+9Zep3OiaDupfuMjF+AI+llSGh901g0y20V04a1jRPH0jlfHpS8RHsDVkAzU517uOtntfaBV3dEVNconx0cjZE/P401K/5JJwIexQXhazptzijQDmU5Hr0LLsZoEQ/JNVplbwdfq9m3kWyl91wk='
const FIXTURE_PLAINTEXT = JSON.stringify({
  app: { name: 'hive.ausbit.dev', description: 'A Hive block explorer and toolkit' },
  challenge: null
})

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto)
})

describe('HiveAuth CryptoJS/OpenSSL envelope', () => {
  it('decrypts a payload produced by crypto-js', async () => {
    await expect(decryptPayload(FIXTURE_PAYLOAD, FIXTURE_KEY)).resolves.toBe(FIXTURE_PLAINTEXT)
  })

  it('round-trips unicode payloads through Web Crypto', async () => {
    const key = createAuthKey()
    const text = JSON.stringify({
      ops: [['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]],
      note: '✓'
    })
    const encrypted = await encryptPayload(text, key)
    expect(encrypted.startsWith('U2FsdGVkX1')).toBe(true)
    await expect(decryptPayload(encrypted, key)).resolves.toBe(text)
  })

  it('rejects a wrong passphrase', async () => {
    await expect(decryptPayload(FIXTURE_PAYLOAD, 'wrong-key')).rejects.toMatchObject({
      code: 'protocol'
    })
  })

  it('rejects a malformed envelope', async () => {
    await expect(decryptPayload('not-an-envelope', FIXTURE_KEY)).rejects.toMatchObject({
      code: 'protocol'
    })
  })

  it('creates UUID v4 auth keys', () => {
    expect(createAuthKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
