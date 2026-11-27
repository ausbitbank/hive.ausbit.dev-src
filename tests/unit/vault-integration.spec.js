import { describe, expect, it } from 'vitest'
import {
  buildBulletinEntries,
  buildReaderRegistry,
  buildVaultBulletinOperation,
  readerRegistryOperation,
  subscriberRows
} from '../../src/services/vaultBulletin'
import {
  canonicalJson,
  encryptPayload,
  generateReaderKeyPair,
  randomKey,
  readerKeyThumbprint,
  sealKeyring,
  wrapRingKey
} from '../../src/services/vaultCrypto'
import {
  buildBulletinSigningPayload,
  buildGrantHeader,
  parseBulletin
} from '../../src/services/vaultGrant'
import {
  MAX_BODY_BYTES,
  MAX_PLAINTEXT_INLINE,
  VAULT_MARKER,
  buildVaultMetadata,
  chooseVaultTransport,
  chunkVaultPayload,
  decryptVaultParts,
  estimateCiphertextLength,
  joinVaultBody,
  splitVaultBody
} from '../../src/services/vaultPayload'
import { prepareVaultPublish } from '../../src/services/vaultCompose'
import { unlockWithGrant } from '../../src/services/vaultUnlock'
import { isBlogPost } from '../../src/services/blogPosts'
import { buildBlogOperation, claimBlog } from '../../src/services/blogSettings'
import { buildPostOperation } from '../../src/services/publish'
import {
  VAULT_CANCEL_MATCHING,
  buildCancelOperation,
  buildOneTimeTransferOperation,
  buildRecurrentTransferOperation,
  buildVaultMemo,
  parseVaultMemo,
  verifyVaultPayment
} from '../../src/services/vaultPayments'
import {
  buildVaultContainerOperation,
  buildVaultProductMetadata,
  buildVaultProductOperation,
  deriveVaultPlan
} from '../../src/services/vaultProduct'

const BLOG = 'alice'
const PERIOD = '2026-11'
const KID = '2026-11'
const PRODUCT = 'alice/membership'
const PREMIUM = 'Members-only secret: the orchid blooms at midnight and only members may read this sentence.'
const SUB = 'abcdefghijklmnop'
const NOW = Date.parse('2026-11-25T00:00:00Z')

const SETTINGS = {
  v: 1,
  enabled: true,
  product: PRODUCT,
  container: 'banksia-vault',
  bulletin: { author: BLOG, permlink: 'vault-2026-11-1' },
  price: '5.000 HBD',
  period: 'month',
  recurrence: 730,
  executions: 12,
  archive: 'all',
  watermark: true,
  updatedAt: '2026-11-20T00:00:00.000Z'
}

const PRODUCT_POST = {
  author: BLOG,
  permlink: 'membership',
  title: 'Membership — @alice',
  body: 'Membership',
  json_metadata: JSON.stringify({
    ...buildVaultProductMetadata(SETTINGS),
    app: 'banksia.io',
    tags: ['membership', 'vault']
  })
}

function plan () {
  return deriveVaultPlan(PRODUCT_POST, { fallback: { executions: SETTINGS.executions } })
}

async function readerKey () {
  const pair = await generateReaderKeyPair({ extractable: true })
  const rkt = await readerKeyThumbprint(pair.publicKeyB64)
  return { pair, readerKey: pair.publicKeyB64, rkt }
}

function paymentRow ({
  index = 1,
  trxId = 'pay-1',
  from = 'bob',
  to = BLOG,
  amount = '5.000 HBD',
  reader = null,
  timestamp = '2026-11-20T10:00:00',
  type = 'fill_recurrent_transfer'
} = {}) {
  const memo = buildVaultMemo({
    product: PRODUCT,
    plan: 'member',
    readerKey: reader,
    sub: SUB
  })
  const body = type === 'transfer'
    ? { from, to, amount, memo }
    : { from, to, amount, memo, remaining_executions: 11 }
  return [index, {
    trx_id: trxId,
    timestamp,
    op: [type, body]
  }]
}

async function fullEntitlement () {
  const reader = await readerKey()
  const contentKey = randomKey()
  const ringKey = randomKey()
  const keyring = { [KID]: contentKey }
  const row = paymentRow({ reader: reader.readerKey })
  const rows = subscriberRows([row], plan(), { now: NOW })
  const expires = rows[0].expires

  const sealed = await sealKeyring(keyring, ringKey, { blog: BLOG, period: PERIOD })
  const header = buildGrantHeader(
    { rkt: reader.rkt, tier: 'member', expires },
    { blog: BLOG, period: PERIOD, tier: 'member' }
  )
  const wrapped = await wrapRingKey(ringKey, reader.readerKey, header)
  const bulletin = {
    v: 1,
    blog: BLOG,
    period: PERIOD,
    seq: 1,
    issued: '2026-11-20T10:00:00.000Z',
    keyring: sealed,
    entries: [{ rkt: reader.rkt, ...wrapped, tier: 'member', expires }],
    claims: [],
    signer: BLOG,
    delegation: null
  }

  const encrypted = await encryptPayload(PREMIUM, contentKey, {
    blog: BLOG,
    permlink: 'members-post',
    kid: KID,
    mode: 'section'
  })
  const metadata = buildVaultMetadata({
    mode: 'section',
    kid: KID,
    iv: encrypted.iv,
    ct: encrypted.ct,
    hash: encrypted.hash,
    bytes: encrypted.bytes,
    tier: 'member',
    price: SETTINGS.price,
    product: PRODUCT,
    container: SETTINGS.container
  })

  return { reader, contentKey, ringKey, keyring, row, rows, bulletin, metadata }
}

describe('vault integration — entitlement end to end', () => {
  it('turns a verified payment into a signed bulletin entry and plaintext', async () => {
    const fixture = await fullEntitlement()
    const verified = verifyVaultPayment(fixture.row, plan(), { now: NOW })
    expect(verified.ok).toBe(true)
    expect(verified).toMatchObject({
      from: 'bob',
      to: BLOG,
      amount: '5.000 HBD',
      type: 'fill_recurrent_transfer'
    })
    expect(fixture.rows).toHaveLength(1)
    expect(fixture.rows[0]).toMatchObject({ account: 'bob', active: true })
    expect(Date.parse(fixture.rows[0].expires)).toBeGreaterThan(NOW)

    // The bulletin entry the dashboard would publish unwraps to the same ring
    // key the sealed keyring was encrypted with.
    const parsed = parseBulletin({ banksia_vault_bulletin: fixture.bulletin })
    expect(parsed).not.toBeNull()
    expect(parsed.entries).toHaveLength(1)

    const result = await unlockWithGrant({
      bulletin: parsed,
      entry: parsed.entries[0],
      readerKey: {
        privateKey: fixture.reader.pair.privateKey,
        publicKeyB64: fixture.reader.readerKey
      },
      metadata: fixture.metadata,
      blog: BLOG,
      permlink: 'members-post',
      now: NOW
    })
    expect(result).toMatchObject({ ok: true, plaintext: PREMIUM, period: PERIOD })
  })

  it('rejects a wrong amount or a wrong recipient before any grant', async () => {
    const fixture = await fullEntitlement()
    const wrongAmount = paymentRow({ reader: fixture.reader.readerKey, amount: '6.000 HBD' })
    const wrongRecipient = paymentRow({ reader: fixture.reader.readerKey, to: 'carol' })

    expect(verifyVaultPayment(wrongAmount, plan(), { now: NOW })).toMatchObject({
      ok: false,
      code: 'amount'
    })
    expect(verifyVaultPayment(wrongRecipient, plan(), { now: NOW })).toMatchObject({
      ok: false,
      code: 'recipient'
    })
  })

  it('locks an expired grant before unwrapping the ring key', async () => {
    const fixture = await fullEntitlement()
    const expiredEntry = { ...fixture.bulletin.entries[0], expires: '2026-11-01T00:00:00.000Z' }
    const result = await unlockWithGrant({
      bulletin: { ...fixture.bulletin, entries: [expiredEntry] },
      entry: expiredEntry,
      readerKey: {
        privateKey: fixture.reader.pair.privateKey,
        publicKeyB64: fixture.reader.readerKey
      },
      metadata: fixture.metadata,
      blog: BLOG,
      permlink: 'members-post',
      now: NOW
    })
    expect(result).toMatchObject({ ok: false, code: 'expired' })
    expect(result.plaintext).toBeUndefined()
  })

  it('uses buildBulletinEntries for the dashboard wrapping path', async () => {
    const fixture = await fullEntitlement()
    const entries = await buildBulletinEntries({
      blog: BLOG,
      period: PERIOD,
      ringKey: fixture.ringKey,
      readers: [{ readerKey: fixture.reader.readerKey, expires: fixture.rows[0].expires }],
      now: NOW
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ rkt: fixture.reader.rkt, tier: 'member' })
    expect(entries[0].epk).toBeTruthy()
    // The signed bulletin must cover the keyring blob hash and every entry.
    const payload = await buildBulletinSigningPayload(fixture.bulletin)
    expect(payload).toContain('"keyringHash":"sha256:')
    expect(payload).toContain(fixture.reader.rkt)
    expect(payload).not.toContain(PREMIUM)
  })
})

describe('vault integration — canonical JSON and size policy', () => {
  it('is stable across nesting and key order and rejects floats', () => {
    const left = { z: 1, a: { y: [true, null, 'x'], b: 2 } }
    const right = { a: { b: 2, y: [true, null, 'x'] }, z: 1 }
    expect(canonicalJson(left)).toBe('{"a":{"b":2,"y":[true,null,"x"]},"z":1}')
    expect(canonicalJson(right)).toBe(canonicalJson(left))
    expect(() => canonicalJson({ nested: { float: 1.5 } })).toThrow(/non-integer/)
    expect(() => canonicalJson({ nested: { missing: undefined } })).toThrow(/undefined/)
  })

  it('classifies inline, companion and too-large payloads', () => {
    expect(chooseVaultTransport(0)).toBe('inline')
    expect(chooseVaultTransport(MAX_PLAINTEXT_INLINE)).toBe('inline')
    expect(chooseVaultTransport(MAX_PLAINTEXT_INLINE + 1)).toBe('comment')
    expect(chooseVaultTransport(90000)).toBe('comment')
    expect(chooseVaultTransport(90001)).toBe('too-large')
    expect(estimateCiphertextLength(3)).toBe(4)
    expect(estimateCiphertextLength(4)).toBe(8)
    expect(MAX_BODY_BYTES).toBe(65535)
  })

  it('builds inline and companion metadata and round-trips chunked parts', async () => {
    const key = randomKey()
    const inline = buildVaultMetadata({
      mode: 'section',
      kid: KID,
      iv: 'a'.repeat(16),
      ct: 'ct',
      hash: 'sha256:' + '0'.repeat(64),
      bytes: 10
    })
    expect(inline).toMatchObject({ v: 1, mode: 'section', kid: KID, ct: 'ct' })

    const chunks = await chunkVaultPayload(PREMIUM, key, {
      blog: BLOG,
      permlink: 'members-post',
      kid: KID,
      mode: 'section'
    }, { chunkSize: 10 })
    expect(chunks.length).toBeGreaterThan(1)
    const parts = buildVaultMetadata({
      mode: 'section',
      kid: KID,
      parts: chunks.map(chunk => 'companion-' + chunk.part),
      hash: 'sha256:' + '0'.repeat(64),
      bytes: PREMIUM.length
    })
    expect(parts.parts).toHaveLength(chunks.length)
    expect(chunks.every(chunk => chunk.part >= 1 && chunk.parts === chunks.length)).toBe(true)

    const decrypted = await decryptVaultParts(chunks, key, {
      blog: BLOG,
      permlink: 'members-post',
      kid: KID,
      mode: 'section'
    })
    expect(decrypted).toBe(PREMIUM)
  })

  it('selects inline, companion or refuses an oversized publish', async () => {
    const key = randomKey()
    const vault = { account: BLOG, keyring: { [KID]: key } }
    const settings = { ...SETTINGS }
    const now = new Date('2026-11-20T00:00:00.000Z')

    const small = await prepareVaultPublish({
      account: BLOG,
      permlink: 'small-post',
      draft: { title: 'Small', body: 'Teaser\n\n' + VAULT_MARKER + 'x'.repeat(1000), vault: { enabled: true, mode: 'section' } },
      vault,
      settings,
      now
    })
    expect(small.transport).toBe('inline')
    expect(small.publicBody).toBe(joinVaultBody('Teaser\n\n'))

    const large = await prepareVaultPublish({
      account: BLOG,
      permlink: 'large-post',
      draft: { title: 'Large', body: 'Teaser\n\n' + VAULT_MARKER + 'x'.repeat(31000), vault: { enabled: true, mode: 'section' } },
      vault,
      settings,
      now
    })
    expect(large.transport).toBe('comment')
    expect(large.vaultMetadata.parts.length).toBeGreaterThan(1)

    await expect(prepareVaultPublish({
      account: BLOG,
      permlink: 'huge-post',
      draft: { title: 'Huge', body: 'Teaser\n\n' + VAULT_MARKER + 'x'.repeat(90001), vault: { enabled: true, mode: 'section' } },
      vault,
      settings,
      now
    })).rejects.toThrow(/companion-comment limit is 90,000 bytes/)
  })
})

describe('vault integration — no plaintext invariant', () => {
  it('keeps premium text out of metadata, bulletins and the published body', async () => {
    const fixture = await fullEntitlement()
    expect(JSON.stringify(fixture.metadata)).not.toContain('orchid blooms')
    expect(JSON.stringify(fixture.bulletin)).not.toContain('orchid blooms')

    const rawDraft = {
      title: 'Members post',
      body: 'A public teaser.\n\n' + VAULT_MARKER + PREMIUM,
      vault: { enabled: true, mode: 'section' },
      tags: ['hive']
    }
    // The composer encrypts first and then publishes the public teaser, not the
    // raw draft body.
    const prepared = await prepareVaultPublish({
      account: BLOG,
      permlink: 'members-post',
      draft: rawDraft,
      vault: { account: BLOG, keyring: { [KID]: fixture.contentKey } },
      settings: SETTINGS,
      now: new Date('2026-11-20T00:00:00.000Z')
    })
    expect(prepared.publicBody).toBe('A public teaser.\n\n' + VAULT_MARKER)
    expect(JSON.stringify(prepared.vaultMetadata)).not.toContain('orchid blooms')

    const operation = buildPostOperation({
      username: BLOG,
      draft: { ...rawDraft, body: prepared.publicBody },
      permlink: 'members-post',
      vaultMetadata: prepared.vaultMetadata
    })
    const [name, body] = operation
    expect(name).toBe('comment')
    expect(body.body).toBe('A public teaser.\n\n' + VAULT_MARKER)
    expect(body.body).not.toContain('orchid blooms')
    expect(body.json_metadata).not.toContain('orchid blooms')
    expect(splitVaultBody(body.body).publicBody).toBe('A public teaser.\n\n')
  })

  it('keeps the archive free of product and container plumbing', () => {
    const normal = {
      author: BLOG,
      permlink: 'normal-post',
      body: 'Hello',
      json_metadata: '{}'
    }
    const product = {
      author: BLOG,
      permlink: 'membership',
      body: 'Membership',
      json_metadata: JSON.stringify({ content_type: 'product' })
    }
    const container = {
      author: BLOG,
      permlink: 'banksia-vault',
      body: 'Container',
      json_metadata: JSON.stringify({ banksia_vault_container: true })
    }
    const reply = {
      author: BLOG,
      permlink: 'a-reply',
      parent_author: BLOG,
      parent_permlink: 'normal-post',
      body: 'Reply',
      json_metadata: '{}'
    }
    expect([normal, product, container, reply].filter(isBlogPost)).toEqual([normal])
  })
})

describe('vault integration — authorities and key material', () => {
  it('keeps account_update2 on posting authority with empty json_metadata', () => {
    const account = {
      name: BLOG,
      posting_json_metadata: JSON.stringify({ profile: { name: 'Alice' } }),
      json_metadata: ''
    }
    const claimed = claimBlog(account, { title: 'Alice writes' })
    expect(claimed.ok).toBe(true)
    const [name, body] = claimed.operation
    expect(name).toBe('account_update2')
    expect(body).toMatchObject({ account: BLOG, json_metadata: '' })
    expect(typeof body.posting_json_metadata).toBe('string')

    const direct = buildBlogOperation(BLOG, '{}')
    expect(direct[0]).toBe('account_update2')
    expect(direct[1].json_metadata).toBe('')
    for (const operation of [claimed.operation, direct]) {
      expect(operation[1].required_auths).toBeUndefined()
      expect(operation[1].required_active_auths).toBeUndefined()
    }
  })

  it('marks subscribe operations as active-key candidates and bulletin/product/registry as posting', async () => {
    const reader = await readerKey()
    const memo = buildVaultMemo({
      product: PRODUCT,
      plan: 'member',
      readerKey: reader.readerKey,
      sub: SUB
    })
    const subscribe = buildRecurrentTransferOperation({
      from: 'bob',
      to: BLOG,
      amount: '5.000 HBD',
      recurrence: 730,
      executions: 12,
      memo
    })
    expect(subscribe[0]).toBe('recurrent_transfer')
    expect(buildOneTimeTransferOperation({
      from: 'bob',
      to: BLOG,
      amount: '5.000 HBD',
      memo
    })[0]).toBe('transfer')
    expect(buildCancelOperation({
      from: 'bob',
      to: BLOG,
      memo,
      recurrence: 730,
      executions: 2
    })[0]).toBe('recurrent_transfer')
    expect(VAULT_CANCEL_MATCHING).toMatchObject({ rule: 'hf28', tested: false })

    const product = buildVaultProductOperation({ account: BLOG, settings: SETTINGS })
    const container = buildVaultContainerOperation({ account: BLOG })
    const bulletin = buildVaultBulletinOperation({
      bulletin: { blog: BLOG, period: PERIOD, seq: 3, signer: BLOG },
      containerAuthor: BLOG,
      containerPermlink: 'banksia-vault'
    })
    const registry = readerRegistryOperation({
      account: BLOG,
      registry: buildReaderRegistry({ blog: BLOG, keys: [{ key: reader.readerKey }] })
    })
    for (const operation of [product, container, bulletin]) {
      expect(operation[0]).toBe('comment')
      expect(operation[1].required_auths).toBeUndefined()
      expect(operation[1].required_posting_auths).toBeUndefined()
    }
    expect(registry[0]).toBe('custom_json')
    expect(registry[1].required_auths).toEqual([])
    expect(registry[1].required_posting_auths).toEqual([BLOG])
  })

  it('puts only the public reader key in the memo', async () => {
    const reader = await readerKey()
    const memo = buildVaultMemo({
      product: PRODUCT,
      plan: 'member',
      readerKey: reader.readerKey,
      sub: SUB
    })
    const parsed = parseVaultMemo(memo)
    expect(parsed.product).toEqual({ author: BLOG, permlink: 'membership' })
    expect(parsed.banksia.reader_key).toBe(reader.readerKey)
    expect(parsed.banksia.reader_key.startsWith('p256:')).toBe(true)
    expect(memo).not.toMatch(/\b5[HJK][1-9A-HJ-NP-Za-km-z]{49}\b/)
    expect(memo).not.toMatch(/private|secret|passphrase|mnemonic/i)
    expect(Object.keys(parsed.banksia).sort()).toEqual(['gift_for', 'plan', 'reader_key', 'sub', 'v'])
  })
})
