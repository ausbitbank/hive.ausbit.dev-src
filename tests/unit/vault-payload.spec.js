import { describe, expect, it } from 'vitest'
import {
  INLINE_CIPHERTEXT_MAX,
  MAX_BODY_BYTES,
  MAX_PLAINTEXT_INLINE,
  VAULT_MARKER,
  buildVaultMetadata,
  chooseVaultTransport,
  chunkVaultPayload,
  decryptVaultParts,
  estimateCiphertextLength,
  insertVaultMarker,
  joinVaultBody,
  mergeVaultMetadata,
  parseVaultMetadata,
  removeVaultMarker,
  splitVaultBody,
  splitVaultPost,
  stripVaultMetadata,
  validateVaultMetadata,
  vaultMetadataSize
} from '../../src/services/vaultPayload'
import { encryptPayload, base64UrlDecode, base64UrlEncode, randomKey, decryptPayload } from '../../src/services/vaultCrypto'

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

async function payloadFixture (plaintext = 'Premium text', header = HEADER) {
  const key = randomKey()
  const encrypted = await encryptPayload(plaintext, key, header)
  return { key, encrypted, plaintext }
}

describe('vault marker and body split', () => {
  it('splits a section at the first marker', () => {
    const body = `Public intro\n\n${VAULT_MARKER}Premium body`
    const split = splitVaultBody(body)
    expect(split.hasMarker).toBe(true)
    expect(split.publicBody).toBe('Public intro\n\n')
    expect(split.premiumBody).toBe('Premium body')
    expect(joinVaultBody(split.publicBody)).toBe(`Public intro\n\n${VAULT_MARKER}`)
  })

  it('reports a missing marker without guessing', () => {
    const split = splitVaultBody('All public')
    expect(split).toEqual({ publicBody: 'All public', premiumBody: '', hasMarker: false })
  })

  it('keeps whole-post mode as teaser plus explicit premium text', () => {
    const split = splitVaultBody(`${VAULT_MARKER}ignored?`, 'post')
    expect(split).toEqual({ publicBody: `${VAULT_MARKER}ignored?`, premiumBody: '', hasMarker: false })

    expect(splitVaultPost({ body: 'Teaser', premiumBody: 'Locked', mode: 'post' }))
      .toEqual({ publicBody: 'Teaser', premiumBody: 'Locked', hasMarker: false })
  })

  it('uses explicit premium text when a section has no marker', () => {
    expect(splitVaultPost({ body: 'Teaser', premiumBody: 'Locked', mode: 'section' }))
      .toEqual({ publicBody: 'Teaser', premiumBody: 'Locked', hasMarker: false })
  })

  it('prefers an existing marker over supplied premium text', () => {
    expect(splitVaultPost({ body: `Teaser${VAULT_MARKER}Locked`, premiumBody: 'Ignored', mode: 'section' }))
      .toEqual({ publicBody: 'Teaser', premiumBody: 'Locked', hasMarker: true })
  })

  it('joins without duplicating the marker', () => {
    expect(joinVaultBody('Teaser')).toBe(`Teaser${VAULT_MARKER}`)
    expect(joinVaultBody(`Teaser${VAULT_MARKER}`)).toBe(`Teaser${VAULT_MARKER}`)
    expect(joinVaultBody('Teaser', 'post')).toBe('Teaser')
  })

  it('inserts at a clamped index and removes every marker', () => {
    expect(insertVaultMarker('abcdef', 0)).toBe(`${VAULT_MARKER}abcdef`)
    expect(insertVaultMarker('abcdef', 3)).toBe(`abc${VAULT_MARKER}def`)
    expect(insertVaultMarker('abcdef', -10)).toBe(`${VAULT_MARKER}abcdef`)
    expect(insertVaultMarker('abcdef', 999)).toBe(`abcdef${VAULT_MARKER}`)
    expect(insertVaultMarker('abcdef', 'not a number')).toBe(`abcdef${VAULT_MARKER}`)

    expect(removeVaultMarker(`a${VAULT_MARKER}b${VAULT_MARKER}c`)).toBe('abc')
  })
})

describe('vault metadata', () => {
  it('round-trips section metadata through build, merge and parse', async () => {
    const { encrypted } = await payloadFixture()
    const meta = buildVaultMetadata({
      mode: 'section',
      kid: HEADER.kid,
      iv: encrypted.iv,
      ct: encrypted.ct,
      hash: encrypted.hash,
      bytes: encrypted.bytes,
      tier: 'member',
      price: '5.000 HBD',
      product: 'alice/membership',
      container: 'banksia-vault',
      paywall: {
        title: 'Members only',
        body: 'This section is for members.',
        benefits: ['Weekly essays', 'Full archive']
      }
    })

    expect(meta.v).toBe(1)
    expect(meta.alg).toBe('A256GCM')
    expect(meta.ct).toBe(encrypted.ct)
    expect(meta.iv).toBe(encrypted.iv)

    const merged = mergeVaultMetadata({ app: 'banksia' }, meta)
    const parsed = parseVaultMetadata(merged)
    expect(parsed).toEqual(meta)
    expect(parseVaultMetadata(JSON.stringify(merged))).toEqual(meta)
    expect(centerMetadata(merged)).toEqual(meta)
  })

  it('supports the parts transport', async () => {
    const { encrypted } = await payloadFixture()
    const meta = buildVaultMetadata({
      mode: 'post',
      kid: HEADER.kid,
      parts: ['vault-payload-1', 'vault-payload-2'],
      hash: encrypted.hash,
      bytes: encrypted.bytes
    })
    expect(meta.parts).toHaveLength(2)
    expect(meta.ct).toBeUndefined()
    expect(meta.iv).toBeUndefined()
    expect(parseVaultMetadata(meta)).toEqual(meta)
  })

  it('requires exactly one of ct or parts', async () => {
    const { encrypted } = await payloadFixture()
    const base = {
      mode: 'section',
      kid: HEADER.kid,
      iv: encrypted.iv,
      hash: encrypted.hash,
      bytes: encrypted.bytes
    }

    expect(() => buildVaultMetadata({ ...base, ct: encrypted.ct, parts: ['p1'] }))
      .toThrow(/exactly one/)
    expect(() => buildVaultMetadata(base)).toThrow(/exactly one/)

    const both = { ...base, ct: encrypted.ct, parts: ['p1'] }
    expect(parseVaultMetadata(both)).toBeNull()
    expect(validateVaultMetadata(both).ok).toBe(false)

    const withParts = { ...base, v: 1, alg: 'A256GCM', iv: undefined, parts: ['p1'] }
    expect(parseVaultMetadata(withParts)).not.toBeNull()
  })

  it('rejects invalid modes and missing fields', async () => {
    const { encrypted } = await payloadFixture()
    const base = {
      kid: HEADER.kid,
      iv: encrypted.iv,
      ct: encrypted.ct,
      hash: encrypted.hash,
      bytes: encrypted.bytes
    }
    expect(() => buildVaultMetadata({ ...base, mode: 'whole' })).toThrow(/mode/)

    for (const broken of [
      { ...base, mode: 'section', v: 2 },
      { ...base, mode: 'section', alg: 'A128GCM' },
      { ...base, mode: 'section', kid: '' },
      { ...base, mode: 'section', bytes: 1.5 },
      { ...base, mode: 'section', hash: 'nope' },
      { ...base, mode: 'section', ct: undefined }
    ]) {
      expect(parseVaultMetadata(broken)).toBeNull()
    }
    expect(parseVaultMetadata(null)).toBeNull()
    expect(parseVaultMetadata('{bad json')).toBeNull()
  })

  it('validates metadata and reports readable errors', async () => {
    const { encrypted } = await payloadFixture()
    const meta = buildVaultMetadata({
      mode: 'section',
      kid: HEADER.kid,
      iv: encrypted.iv,
      ct: encrypted.ct,
      hash: encrypted.hash,
      bytes: encrypted.bytes
    })
    expect(validateVaultMetadata(meta)).toEqual({ ok: true, errors: [] })
    expect(validateVaultMetadata(JSON.stringify({ banksia_vault: meta }))).toEqual({ ok: true, errors: [] })

    const bad = { ...meta, v: 2, alg: 'A128GCM', hash: 'nope', bytes: -1, tier: '' }
    const result = validateVaultMetadata(bad)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(4)

    expect(validateVaultMetadata({ ...meta, iv: 'AAAA' }).errors).toContain('iv must be 12 bytes')
  })

  it('bounds the paywall copy', async () => {
    const { encrypted } = await payloadFixture()
    const base = {
      mode: 'section',
      kid: HEADER.kid,
      iv: encrypted.iv,
      ct: encrypted.ct,
      hash: encrypted.hash,
      bytes: encrypted.bytes
    }
    expect(() => buildVaultMetadata({ ...base, paywall: { title: 'x'.repeat(81) } })).toThrow(/title/)
    expect(() => buildVaultMetadata({ ...base, paywall: { body: 'x'.repeat(241) } })).toThrow(/body/)
    expect(() => buildVaultMetadata({ ...base, paywall: { benefits: Array(7).fill('b') } })).toThrow(/benefits/)
    expect(() => buildVaultMetadata({ ...base, paywall: { benefits: ['x'.repeat(81)] } })).toThrow(/benefit/)

    const invalidMeta = {
      ...base,
      v: 1,
      alg: 'A256GCM',
      tier: 'member',
      paywall: { title: 'x'.repeat(81), body: '', benefits: Array(7).fill('b') }
    }
    const errors = validateVaultMetadata(invalidMeta).errors
    expect(errors.some(message => message.includes('paywall.title'))).toBe(true)
    expect(errors.some(message => message.includes('paywall.benefits'))).toBe(true)

    const valid = buildVaultMetadata({
      ...base,
      paywall: { title: 'Members', body: 'Join', benefits: ['Archive'] }
    })
    expect(parseVaultMetadata(valid).paywall).toEqual({ title: 'Members', body: 'Join', benefits: ['Archive'] })
  })

  it('merges and strips metadata without mutating the input', () => {
    const original = { app: 'banksia', banksia_vault: { v: 1 } }
    expect(mergeVaultMetadata(original, { v: 1, kid: '2026-11' }))
      .toEqual({ app: 'banksia', banksia_vault: { v: 1, kid: '2026-11' } })
    expect(original).toEqual({ app: 'banksia', banksia_vault: { v: 1 } })

    expect(mergeVaultMetadata(original, null)).toEqual({ app: 'banksia' })
    expect(stripVaultMetadata(original)).toEqual({ app: 'banksia' })
    expect(mergeVaultMetadata(null, { v: 1 })).toEqual({ banksia_vault: { v: 1 } })
    expect(stripVaultMetadata(null)).toEqual({})
  })

  it('measures JSON byte size', () => {
    const meta = { v: 1, mode: 'section', kid: '2026-11' }
    expect(vaultMetadataSize(meta)).toBe(new TextEncoder().encode(JSON.stringify(meta)).length)
    expect(vaultMetadataSize(meta)).toBeGreaterThan(0)
  })
})

describe('vault size and transport policy', () => {
  it('estimates base64url ciphertext length', () => {
    expect(estimateCiphertextLength(0)).toBe(0)
    expect(estimateCiphertextLength(1)).toBe(4)
    expect(estimateCiphertextLength(3)).toBe(4)
    expect(estimateCiphertextLength(4)).toBe(8)
    expect(estimateCiphertextLength(MAX_PLAINTEXT_INLINE)).toBe(INLINE_CIPHERTEXT_MAX)
    expect(estimateCiphertextLength(-1)).toBe(0)
  })

  it('chooses inline, comment or too-large', () => {
    expect(chooseVaultTransport(0)).toBe('inline')
    expect(chooseVaultTransport(MAX_PLAINTEXT_INLINE)).toBe('inline')
    expect(chooseVaultTransport(MAX_PLAINTEXT_INLINE + 1)).toBe('comment')
    expect(chooseVaultTransport(90000)).toBe('comment')
    expect(chooseVaultTransport(90001)).toBe('too-large')
    expect(chooseVaultTransport(MAX_BODY_BYTES * 10)).toBe('too-large')
    expect(chooseVaultTransport(-1)).toBe('too-large')
  })
})

describe('multi-part payloads', () => {
  it('chunks on UTF-8 boundaries and decrypts in order', async () => {
    const key = randomKey()
    const plaintext = 'abc😀é'.repeat(20)
    expect(new TextEncoder().encode(plaintext).length).toBe(180)

    const parts = await chunkVaultPayload(plaintext, key, HEADER, { chunkSize: 10 })
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.map(part => part.part)).toEqual(parts.map((_, index) => index + 1))
    expect(parts.every(part => part.parts === parts.length)).toBe(true)
    expect(parts.every(part => part.iv && part.ct && part.hash)).toBe(true)

    let seen = ''
    for (const part of parts) {
      const text = await importPart(part, key)
      expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
      expect(text).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
      seen += text
    }
    expect(seen).toBe(plaintext)

    expect(await decryptVaultParts(parts, key, HEADER)).toBe(plaintext)
    expect(await decryptVaultParts([...parts].reverse(), key, HEADER)).toBe(plaintext)
  })

  it('encrypts an empty payload as one part', async () => {
    const key = randomKey()
    const parts = await chunkVaultPayload('', key, HEADER)
    expect(parts).toHaveLength(1)
    expect(await decryptVaultParts(parts, key, HEADER)).toBe('')
  })

  it('fails on tampered, missing or invalid parts', async () => {
    const key = randomKey()
    const parts = await chunkVaultPayload('one two three four five', key, HEADER, { chunkSize: 8 })
    const tampered = parts.map(part => ({ ...part }))
    tampered[1].ct = flipLastByte(tampered[1].ct)
    await expect(decryptVaultParts(tampered, key, HEADER)).rejects.toMatchObject({ code: 'VAULT_TAG' })

    await expect(decryptVaultParts([], key, HEADER)).rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(chunkVaultPayload('x', key, HEADER, { chunkSize: 0 }))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
    await expect(chunkVaultPayload(42, key, HEADER))
      .rejects.toMatchObject({ code: 'VAULT_BAD_INPUT' })
  })

  it('keeps the same AAD header for every part', async () => {
    const key = randomKey()
    const parts = await chunkVaultPayload('abcdefghij', key, HEADER, { chunkSize: 4 })
    const wrongHeader = { ...HEADER, mode: 'post' }
    await expect(decryptVaultParts(parts, key, wrongHeader)).rejects.toMatchObject({ code: 'VAULT_TAG' })
  })
})

// Keep the deep-equality assertion independent from key insertion order.
function centerMetadata (metadata) {
  return parseVaultMetadata(metadata.banksia_vault)
}

async function importPart (part, key) {
  return decryptPayload(part, key, HEADER)
}
