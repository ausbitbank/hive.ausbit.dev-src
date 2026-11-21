import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Memo, PublicKey } from 'hive-tx'
import {
  encodeMemo,
  generateKeys,
  isValidWif,
  signBufferData,
  toPublicKey
} from '../../src/services/hiveTx'

const PASSWORD = 'P5KPSyo2CD1DJEJwBg4kSLTTeu9N2u4KLxFR3TPNmuYJ5LeSoT5j'
const POSTING = '5JgJdv9xJjJvCo3iJ6HuAwFvNfyDA8zZkQP7eeWK94EmivbD16n'
const POSTING_PUBLIC = 'STM6EfF7WhkPBLxiu9XKWkSCxqVqRc3tSfKh7dPyFGqmwpbbyNKqo'
const MEMO = '5KeSzDvkY2XYNBhbtUwaT2KApUoXHcfp5ZRCua35bnKZEtKJhqC'
const MEMO_PUBLIC = 'STM5VGpnYt828QAEUSyLE8xpPLn7ERxgrJySt9K6gYPptVsTcpWxp'

describe('hive-tx service helpers', () => {
  it('derives the same account keys as the Hive wallet scheme', async () => {
    const generated = await generateKeys('alice', PASSWORD)
    expect(generated.privateKeys.posting).toBe(POSTING)
    expect(generated.publicKeys.posting).toBe(POSTING_PUBLIC)
    expect(generated.posting.key_auths).toEqual([[POSTING_PUBLIC, 1]])
    expect(generated.memo_key).toBe(MEMO_PUBLIC)
  })

  it('validates WIFs and exposes the matching public key', async () => {
    expect(await isValidWif(POSTING)).toBe(true)
    expect(await isValidWif('not-a-wif')).toBe(false)
    expect(await toPublicKey(POSTING)).toBe(POSTING_PUBLIC)
  })

  it('signs strings and buffers with a recoverable signature', async () => {
    for (const data of ['hello', new TextEncoder().encode('hello')]) {
      const signature = await signBufferData(data, POSTING)
      const hash = new Uint8Array(createHash('sha256').update(data).digest())
      expect(signature).toHaveLength(130)
      expect(PublicKey.from(POSTING_PUBLIC).verify(hash, signature)).toBe(true)
    }
  })

  it('round-trips an encrypted memo', async () => {
    const encoded = await encodeMemo(MEMO, MEMO_PUBLIC, '#hello')
    expect(encoded.startsWith('#')).toBe(true)
    expect(Memo.decode(MEMO, encoded)).toBe('#hello')
  })
})
