import base58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { KDF_ITERATIONS, decryptKey, encryptKey } from '../../src/components/smartlock/utils'

const KEY = '5Kdummykeydummykeydummykeydummykeydummy'
const PASSWORD = 'correct horse battery staple'

describe('SmartLock KDF', () => {
  it('uses the current iteration count for new ciphertexts', () => {
    const secured = encryptKey(KEY, PASSWORD)
    const envelope = JSON.parse(new TextDecoder().decode(base58.decode(secured)))

    expect(envelope.iter).toBe(KDF_ITERATIONS)
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(310000)
  })

  it('round-trips a key', () => {
    expect(decryptKey(encryptKey(KEY, PASSWORD), PASSWORD)).toBe(KEY)
  })
})
