import { describe, expect, it } from 'vitest'
import {
  BULLETIN_MAX_ENTRIES,
  BULLETIN_WARN_ENTRIES,
  buildBulletinEntries,
  buildReaderRegistry,
  buildVaultBulletin,
  buildVaultBulletinBundle,
  buildVaultBulletinOperation,
  buildVaultBulletinPartOperation,
  bulletinFromReplies,
  bulletinSize,
  grantExpiry,
  isBulletinTooLarge,
  nextSeq,
  pendingGrants,
  readerRegistryOperation,
  subscriberRows
} from '../../src/services/vaultBulletin'
import {
  generateReaderKeyPair,
  openKeyring,
  randomKey,
  readerKeyThumbprint,
  unwrapRingKey
} from '../../src/services/vaultCrypto'
import {
  buildBulletinSigningPayload,
  buildGrantHeader,
  verifyGrant
} from '../../src/services/vaultGrant'
import { buildVaultMemo } from '../../src/services/vaultPayments'
import { deriveVaultPlan } from '../../src/services/vaultProduct'

const BLOG = 'alice'
const PERIOD = '2026-11'
const NOW = Date.parse('2026-11-21T00:00:00Z')
const SUB = 'abcdefghijklmnop'

const PRODUCT_POST = {
  author: BLOG,
  permlink: 'membership',
  title: 'Membership',
  json_metadata: JSON.stringify({
    content_type: 'product',
    version: 0.1,
    currency: 'HIVE:HBD',
    price: 5,
    subscription: 1,
    subscription_recurrence: 730,
    status: 1,
    tags: ['membership'],
    banksia_vault_product: {
      v: 1,
      plan: 'member',
      container: 'banksia-vault',
      archive: 'all'
    }
  })
}

function plan () {
  return deriveVaultPlan(PRODUCT_POST)
}

function memo (readerKey, planName = 'member') {
  return buildVaultMemo({
    product: BLOG + '/membership',
    plan: planName,
    readerKey,
    sub: SUB
  })
}

function recurringRow ({ from = 'bob', readerKey, timestamp, txid, amount = '5.000 HBD', remaining = 11 }) {
  return [1, {
    op: ['fill_recurrent_transfer', {
      from,
      to: BLOG,
      amount,
      memo: memo(readerKey),
      remaining_executions: remaining
    }],
    timestamp,
    trx_id: txid
  }]
}

function reply (period, seq, permlink) {
  return {
    author: BLOG,
    permlink: permlink || 'vault-' + period + '-' + seq,
    json_metadata: JSON.stringify({
      banksia_vault_bulletin: {
        v: 1,
        blog: BLOG,
        period,
        seq,
        issued: '2026-11-01T00:00:00Z',
        keyring: { alg: 'A256GCM', iv: 'aa', ct: 'bb' },
        entries: [],
        claims: [],
        signer: BLOG,
        delegation: null
      }
    })
  }
}

describe('vault bulletin expiry and subscribers', () => {
  it('adds a 24 hour grace to a recurring grant and 31 days to a one-time grant', () => {
    const payment = { type: 'fill_recurrent_transfer', timestamp: '2026-01-01T00:00:00Z' }
    const expected = new Date(Date.parse('2026-01-01T00:00:00Z') + (730 + 24) * 60 * 60 * 1000).toISOString()
    expect(grantExpiry(payment, { recurrence: 730 })).toBe(expected)

    const oneTime = { type: 'transfer', timestamp: '2026-01-01T00:00:00Z' }
    expect(grantExpiry(oneTime, { recurrence: 730 })).toBe('2026-02-01T00:00:00.000Z')
    expect(grantExpiry({ type: 'transfer', timestamp: '' }, { recurrence: 730 })).toBe('')
  })

  it('builds one row per reader key, newest payment wins, self and gifts excluded', async () => {
    const first = await generateReaderKeyPair()
    const second = await generateReaderKeyPair()
    const third = await generateReaderKeyPair()
    const history = [
      recurringRow({ readerKey: first.publicKeyB64, timestamp: '2026-11-20T00:00:00', txid: 'newer' }),
      recurringRow({ readerKey: first.publicKeyB64, timestamp: '2026-10-20T00:00:00', txid: 'older' }),
      recurringRow({ readerKey: second.publicKeyB64, timestamp: '2026-11-10T00:00:00', txid: 'second' }),
      recurringRow({ from: BLOG, readerKey: third.publicKeyB64, timestamp: '2026-11-15T00:00:00', txid: 'self' })
    ]

    const rows = subscriberRows(history, plan(), { now: NOW })
    expect(rows).toHaveLength(2)
    const newest = rows.find(row => row.readerKey === first.publicKeyB64)
    expect(newest.txid).toBe('newer')
    expect(newest.account).toBe('bob')
    expect(newest.amount).toBe('5.000 HBD')
    expect(newest.lastPayment).toBe('2026-11-20T00:00:00.000Z')
    expect(newest.expires).toBe(new Date(Date.parse('2026-11-20T00:00:00Z') + 754 * 60 * 60 * 1000).toISOString())
    expect(newest.active).toBe(true)
    expect(newest.executionsRemaining).toBe(11)
    expect(rows.some(row => row.account === BLOG)).toBe(false)

    const giftMemo = buildVaultMemo({
      product: BLOG + '/membership',
      plan: 'member',
      readerKey: third.publicKeyB64,
      sub: SUB,
      giftFor: 'carol'
    })
    const withGift = history.concat([[
      3,
      {
        op: ['transfer', { from: 'bob', to: BLOG, amount: '5.000 HBD', memo: giftMemo }],
        timestamp: '2026-11-19T00:00:00',
        trx_id: 'gift'
      }
    ]])
    const giftRows = subscriberRows(withGift, plan(), { now: NOW })
    expect(giftRows).toHaveLength(2)
    expect(giftRows.some(row => row.txid === 'gift')).toBe(false)
  })
})

describe('vault bulletin construction', () => {
  it('wraps the ring key for each reader with a bound header', async () => {
    const readerA = await generateReaderKeyPair()
    const readerB = await generateReaderKeyPair()
    const ringKey = await randomKey()
    const expires = '2026-12-21T00:00:00Z'
    const entries = await buildBulletinEntries({
      blog: BLOG,
      period: PERIOD,
      ringKey,
      readers: [
        { readerKey: readerA.publicKeyB64, expires },
        { readerKey: readerB.publicKeyB64, expires }
      ]
    })

    expect(entries).toHaveLength(2)
    const rktA = await readerKeyThumbprint(readerA.publicKeyB64)
    const entryA = entries.find(entry => entry.rkt === rktA)
    expect(entryA).toBeTruthy()
    expect(entryA.alg).toBe('P256-HKDF-SHA256-A256GCM')
    expect(entryA.tier).toBe('member')
    expect(entryA.expires).toBe(expires)
    expect(entryA.rkt).toMatch(/^[0-9a-f]{16}$/)
    expect(entryA.epk.length).toBeGreaterThan(0)
    expect(entryA.iv.length).toBeGreaterThan(0)
    expect(entryA.ct.length).toBeGreaterThan(0)

    const header = buildGrantHeader({ rkt: rktA, tier: 'member', expires }, { blog: BLOG, period: PERIOD })
    const unwrapped = await unwrapRingKey(entryA, readerA, header)
    expect(unwrapped).toBe(ringKey)

    const splitEntries = await buildBulletinEntries({
      blog: BLOG,
      period: PERIOD,
      ringKey,
      readers: Array.from({ length: BULLETIN_MAX_ENTRIES + 1 }, () => ({ readerKey: readerA.publicKeyB64, expires }))
    })
    expect(splitEntries).toHaveLength(1)
  })

  it('seals the keyring and signs the exact bulletin payload', async () => {
    const reader = await generateReaderKeyPair()
    const ringKey = await randomKey()
    const keyring = { [PERIOD]: await randomKey() }
    const entries = await buildBulletinEntries({
      blog: BLOG,
      period: PERIOD,
      ringKey,
      readers: [{ readerKey: reader.publicKeyB64, expires: '2026-12-21T00:00:00Z' }]
    })
    const signAdapter = { sign: async text => 'sig:' + text }
    const bulletin = await buildVaultBulletin({
      blog: BLOG,
      period: PERIOD,
      seq: 3,
      keyring,
      ringKey,
      entries,
      signer: BLOG,
      issued: '2026-11-27T12:00:00Z',
      signAdapter
    })

    expect(bulletin.v).toBe(1)
    expect(bulletin.blog).toBe(BLOG)
    expect(bulletin.period).toBe(PERIOD)
    expect(bulletin.seq).toBe(3)
    expect(bulletin.delegation).toBeNull()
    expect(bulletin.keyring.alg).toBe('A256GCM')
    expect(bulletin.entries).toHaveLength(1)
    expect(bulletin.sig).toBe('sig:' + await buildBulletinSigningPayload(bulletin))

    expect(await openKeyring(bulletin.keyring, ringKey, { blog: BLOG, period: PERIOD })).toEqual(keyring)

    const expected = await buildBulletinSigningPayload(bulletin)
    expect(await verifyGrant(bulletin, {
      verify: async (text, sig) => text === expected && sig === bulletin.sig
    })).toBe(true)
    expect(await verifyGrant({ ...bulletin, seq: 4 }, {
      verify: async (text, sig) => text === expected && sig === bulletin.sig
    })).toBe(false)
  })

  it('builds the exact comment operation with the payload in metadata', async () => {
    const reader = await generateReaderKeyPair()
    const ringKey = await randomKey()
    const entries = await buildBulletinEntries({
      blog: BLOG,
      period: PERIOD,
      ringKey,
      readers: [{ readerKey: reader.publicKeyB64, expires: '2026-12-21T00:00:00Z' }]
    })
    const bulletin = await buildVaultBulletin({
      blog: BLOG,
      period: PERIOD,
      seq: 3,
      keyring: { [PERIOD]: await randomKey() },
      ringKey,
      entries,
      signer: BLOG,
      issued: '2026-11-27T12:00:00Z',
      signAdapter: { sign: async () => 'a'.repeat(130) }
    })
    const operation = buildVaultBulletinOperation({
      bulletin,
      containerAuthor: BLOG,
      containerPermlink: 'banksia-vault'
    })

    expect(operation[0]).toBe('comment')
    expect(operation[1].parent_author).toBe(BLOG)
    expect(operation[1].parent_permlink).toBe('banksia-vault')
    expect(operation[1].author).toBe(BLOG)
    expect(operation[1].permlink).toBe('vault-2026-11-3')
    expect(operation[1].body.length).toBeLessThan(100)
    const metadata = JSON.parse(operation[1].json_metadata)
    expect(metadata.app).toBe('banksia.io')
    expect(metadata.banksia_vault_bulletin).toEqual(bulletin)
    expect(buildVaultBulletinOperation({ bulletin: null })).toBeNull()
  })
})

describe('vault bulletin discovery and limits', () => {
  it('chooses the newest period and sequence from replies', () => {
    const replies = [
      reply('2026-11', 2),
      reply('2026-12', 1),
      reply('2026-11', 3)
    ]
    const newest = bulletinFromReplies(replies)
    expect(newest.period).toBe('2026-12')
    expect(newest.seq).toBe(1)
    expect(bulletinFromReplies([])).toBeNull()
    expect(nextSeq(replies, '2026-11')).toBe(4)
    expect(nextSeq(replies, '2026-12')).toBe(2)
    expect(nextSeq(replies, null)).toBe(4)
  })

  it('warns over 250 entries and fails over the byte limit', async () => {
    const small = { v: 1, blog: BLOG, period: PERIOD, seq: 1, entries: [] }
    expect(isBulletinTooLarge(small)).toEqual({ tooLarge: false, bytes: bulletinSize(small), reason: '' })

    const many = {
      ...small,
      entries: Array.from({ length: BULLETIN_WARN_ENTRIES + 1 }, () => ({ rkt: 'a'.repeat(16) }))
    }
    const warning = isBulletinTooLarge(many)
    expect(warning.tooLarge).toBe(false)
    expect(warning.reason).toMatch(/250/)

    const huge = { ...small, entries: [{ rkt: 'a'.repeat(16), ct: 'a'.repeat(60000) }] }
    const tooLarge = isBulletinTooLarge(huge)
    expect(tooLarge.tooLarge).toBe(true)
    expect(tooLarge.bytes).toBeGreaterThan(60000)
    expect(tooLarge.reason).toMatch(/split/i)
  })

  it('builds the reader key registry and its posting operation', async () => {
    const reader = await generateReaderKeyPair()
    const registry = buildReaderRegistry({
      blog: BLOG,
      keys: [
        { key: reader.publicKeyB64, label: 'Laptop', created: '2026-11-01T00:00:00Z' },
        { key: 'not-a-key' }
      ],
      revoked: [reader.publicKeyB64, reader.publicKeyB64]
    })
    expect(registry).toEqual({
      v: 1,
      blog: BLOG,
      keys: [{ key: reader.publicKeyB64, label: 'Laptop', created: '2026-11-01T00:00:00Z' }],
      revoked: [reader.publicKeyB64]
    })
    const operation = readerRegistryOperation({ account: BLOG, registry })
    expect(operation[0]).toBe('custom_json')
    expect(operation[1].required_auths).toEqual([])
    expect(operation[1].required_posting_auths).toEqual([BLOG])
    expect(operation[1].id).toBe('banksia.vault.reader_key')
    expect(JSON.parse(operation[1].json)).toEqual(registry)
    expect(buildReaderRegistry({ blog: 'bad name' })).toBeNull()
    expect(readerRegistryOperation({ account: BLOG, registry: null })).toBeNull()
  })

  it('flags grants that are missing or expire within a day', async () => {
    const reader = await generateReaderKeyPair()
    const other = await generateReaderKeyPair()
    const ringKey = await randomKey()
    const expires = '2026-11-30T00:00:00Z'
    const entries = await buildBulletinEntries({
      blog: BLOG,
      period: PERIOD,
      ringKey,
      readers: [{ readerKey: reader.publicKeyB64, expires }]
    })
    const bulletin = { entries }

    expect(await pendingGrants({
      bulletin,
      subscriber: { readerKey: reader.publicKeyB64 },
      now: NOW
    })).toBe(false)
    expect(await pendingGrants({
      bulletin,
      subscriber: { readerKey: reader.publicKeyB64 },
      now: Date.parse('2026-11-29T12:00:00Z')
    })).toBe(true)
    expect(await pendingGrants({
      bulletin,
      subscriber: { readerKey: other.publicKeyB64 },
      now: NOW
    })).toBe(true)
    expect(await pendingGrants({ bulletin, subscriber: {}, now: NOW })).toBe(true)
  })
})

describe('multi-part bulletins', () => {
  it('splits more than 300 entries into a signed manifest and parts', async () => {
    const ringKey = await randomKey()
    const keyring = { [PERIOD]: await randomKey() }
    const entries = Array.from({ length: 301 }, (_, index) => ({
      rkt: index.toString(16).padStart(16, '0'),
      alg: 'P256-HKDF-SHA256-A256GCM',
      epk: 'epk',
      iv: 'iv',
      ct: 'ct',
      tier: 'member',
      expires: '2026-12-21T00:00:00Z'
    }))
    const bundle = await buildVaultBulletinBundle({
      blog: BLOG,
      period: PERIOD,
      seq: 4,
      keyring,
      ringKey,
      entries,
      signer: BLOG,
      issued: '2026-11-27T12:00:00Z',
      signAdapter: { sign: async text => 'sig:' + text }
    })
    expect(bundle.bulletin.entries).toEqual([])
    expect(bundle.bulletin.parts).toHaveLength(2)
    expect(bundle.bulletin.parts[0]).toMatchObject({
      permlink: 'vault-2026-11-4-1',
      hash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      entries: 300
    })
    expect(bundle.parts).toHaveLength(2)
    expect(bundle.parts[1].part).toMatchObject({
      v: 1, blog: BLOG, period: PERIOD, seq: 4, part: 2, parts: 2
    })
    expect(bundle.parts[1].part.entries).toHaveLength(1)
    expect(bundle.bulletin.sig).toMatch(/^sig:/)

    const partOperation = buildVaultBulletinPartOperation({
      part: bundle.parts[0].part,
      author: BLOG,
      containerAuthor: BLOG,
      containerPermlink: 'banksia-vault'
    })
    expect(partOperation[0]).toBe('comment')
    expect(partOperation[1].permlink).toBe('vault-2026-11-4-1')
    expect(JSON.parse(partOperation[1].json_metadata).banksia_vault_bulletin_part.entries).toHaveLength(300)
  })

  it('keeps a small list as a single signed bulletin', async () => {
    const ringKey = await randomKey()
    const bundle = await buildVaultBulletinBundle({
      blog: BLOG,
      period: PERIOD,
      seq: 1,
      keyring: { [PERIOD]: await randomKey() },
      ringKey,
      entries: [],
      signer: BLOG,
      issued: '2026-11-27T12:00:00Z',
      signAdapter: { sign: async text => 'sig:' + text }
    })
    expect(bundle.parts).toEqual([])
    expect(bundle.bulletin.parts).toBeUndefined()
    expect(bundle.bulletin.entries).toEqual([])
  })
})
