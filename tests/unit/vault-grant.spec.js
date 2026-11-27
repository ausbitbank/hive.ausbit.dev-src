import { describe, expect, it } from 'vitest'
import {
  BULLETIN_SIG_PREFIX,
  GRANT_SIG_PREFIX,
  sha256Hex
} from '../../src/services/vaultCrypto'
import {
  buildBulletinSigningPayload,
  buildGrantHeader,
  buildGrantSigningPayload,
  bulletinPayloadObject,
  bulletinPermlink,
  canonicalJson,
  isGrantValid,
  nextBulletinSequence,
  parseBulletin,
  signGrant,
  verifyDelegation,
  verifyGrant
} from '../../src/services/vaultGrant'

const RKT = 'a1b2c3d4e5f6a7b8'
const BLOG = 'alice'
const PERIOD = '2026-11'
const EXPIRES = '2026-12-27T12:00:00Z'

function fakeSigner (id = 'creator') {
  return { sign: async text => `${id}:${await sha256Hex(text)}` }
}

function fakeVerifier (id = 'creator') {
  return { verify: async (text, sig) => sig === `${id}:${await sha256Hex(text)}` }
}

function bulletinFixture () {
  return {
    v: 1,
    blog: BLOG,
    period: PERIOD,
    seq: 3,
    issued: '2026-11-27T12:00:00Z',
    keyring: { alg: 'A256GCM', iv: 'keyring-iv', ct: 'keyring-ct' },
    entries: [
      {
        rkt: RKT,
        alg: 'P256-HKDF-SHA256-A256GCM',
        epk: 'ephemeral-point',
        iv: 'entry-iv',
        ct: 'wrapped-ring-key',
        tier: 'member',
        expires: EXPIRES
      }
    ],
    claims: [],
    signer: BLOG,
    delegation: null
  }
}

describe('grant headers', () => {
  it('builds exactly the six signed fields', () => {
    const header = buildGrantHeader(
      { rkt: RKT, tier: 'patron', expires: EXPIRES },
      { blog: BLOG, period: PERIOD }
    )
    expect(Object.keys(header).sort()).toEqual(['blog', 'expires', 'period', 'rkt', 'tier'])
    expect(header).toEqual({
      blog: BLOG,
      rkt: RKT,
      period: PERIOD,
      tier: 'patron',
      expires: EXPIRES
    })
  })

  it('defaults the tier from the context and then to member', () => {
    expect(buildGrantHeader({ rkt: RKT, expires: EXPIRES }, { blog: BLOG, period: PERIOD, tier: 'supporter' }).tier)
      .toBe('supporter')
    expect(buildGrantHeader({ rkt: RKT, expires: EXPIRES }, { blog: BLOG, period: PERIOD }).tier)
      .toBe('member')
  })

  it('validates its inputs', () => {
    expect(() => buildGrantHeader({ rkt: 'nope', expires: EXPIRES }, { blog: BLOG, period: PERIOD }))
      .toThrow(/thumbprint/)
    expect(() => buildGrantHeader({ rkt: RKT, expires: 'soon' }, { blog: BLOG, period: PERIOD }))
      .toThrow(/expires/)
    expect(() => buildGrantHeader({ rkt: RKT, expires: EXPIRES }, { blog: 'Not An Account', period: PERIOD }))
      .toThrow(/account/)
    expect(() => buildGrantHeader({ rkt: RKT, expires: EXPIRES }, { blog: BLOG, period: '2026-1' }))
      .toThrow(/period/)
  })
})

describe('bulletin signing payloads', () => {
  it('uses the bulletin prefix and strips the signature', async () => {
    const signed = await signGrant(bulletinFixture(), fakeSigner())
    const payload = await buildBulletinSigningPayload(signed)
    expect(payload.startsWith(`${BULLETIN_SIG_PREFIX}|`)).toBe(true)
    expect(payload).not.toContain('"sig"')
    expect(payload).not.toContain(signed.sig)
  })

  it('adds a deterministic keyring hash to the signed object', async () => {
    const bulletin = bulletinFixture()
    const payload = await bulletinPayloadObject(bulletin)
    expect(payload.sig).toBeUndefined()
    expect(payload.keyringHash).toBe(`sha256:${await sha256Hex(canonicalJson(bulletin.keyring))}`)
    expect(payload.entries).toEqual(bulletin.entries)
    expect(await bulletinPayloadObject(bulletin)).toEqual(payload)
  })

  it('does not add a keyring hash without a keyring', async () => {
    const payload = await bulletinPayloadObject({ v: 1, blog: BLOG, period: PERIOD, seq: 1, entries: [] })
    expect(payload.keyringHash).toBeUndefined()
  })

  it('uses the grant prefix for non-bulletin objects', () => {
    const payload = buildGrantSigningPayload({ blog: BLOG, rkt: RKT, expires: EXPIRES, sig: 'ignored' })
    expect(payload.startsWith(`${GRANT_SIG_PREFIX}|`)).toBe(true)
    expect(payload).not.toContain('ignored')
  })
})

describe('grant signing and verification', () => {
  it('signs and verifies a bulletin', async () => {
    const signed = await signGrant(bulletinFixture(), fakeSigner())
    expect(typeof signed.sig).toBe('string')
    expect(await verifyGrant(signed, fakeVerifier())).toBe(true)
  })

  it('signs and verifies a standalone grant', async () => {
    const grant = { blog: BLOG, rkt: RKT, period: PERIOD, tier: 'member', expires: EXPIRES }
    const signed = await signGrant(grant, fakeSigner())
    expect(await verifyGrant(signed, fakeVerifier())).toBe(true)
  })

  it('detects a tampered entry', async () => {
    const signed = await signGrant(bulletinFixture(), fakeSigner())
    signed.entries[0].ct = 'another-wrapped-key'
    expect(await verifyGrant(signed, fakeVerifier())).toBe(false)
  })

  it('detects a swapped keyring via the keyring hash', async () => {
    const signed = await signGrant(bulletinFixture(), fakeSigner())
    signed.keyring = { alg: 'A256GCM', iv: 'other-iv', ct: 'other-ct' }
    expect(await verifyGrant(signed, fakeVerifier())).toBe(false)

    // Adding a forged keyringHash does not help: verification recomputes it.
    const forged = {
      ...signed,
      keyringHash: `sha256:${await sha256Hex(canonicalJson(signed.keyring))}`
    }
    expect(await verifyGrant(forged, fakeVerifier())).toBe(false)
  })

  it('detects a different signer', async () => {
    const signed = await signGrant(bulletinFixture(), fakeSigner('mallory'))
    expect(await verifyGrant(signed, fakeVerifier('creator'))).toBe(false)
  })

  it('returns false for malformed grants instead of throwing', async () => {
    expect(await verifyGrant(null, fakeVerifier())).toBe(false)
    expect(await verifyGrant({}, fakeVerifier())).toBe(false)
    expect(await verifyGrant(bulletinFixture(), fakeVerifier())).toBe(false)
    expect(await verifyGrant({ ...bulletinFixture(), sig: 'x' }, null)).toBe(false)
  })

  it('rejects a signer that returns no signature', async () => {
    await expect(signGrant(bulletinFixture(), { sign: async () => '' })).rejects.toThrow(/signature/)
  })
})

describe('grant validity', () => {
  const now = Date.parse('2026-11-27T12:00:00Z')
  const valid = { blog: BLOG, period: PERIOD, rkt: RKT, expires: EXPIRES, tier: 'member' }

  it('accepts a matching, unexpired grant', () => {
    expect(isGrantValid(valid, { blog: BLOG, period: PERIOD, rkt: RKT, now })).toBe(true)
    expect(isGrantValid(valid, { now: new Date(now) })).toBe(true)
  })

  it('rejects expiry and mismatched bindings', () => {
    expect(isGrantValid(valid, { now: Date.parse(EXPIRES) + 1 })).toBe(false)
    expect(isGrantValid({ ...valid, blog: 'bob' }, { blog: BLOG, now })).toBe(false)
    expect(isGrantValid({ ...valid, period: '2026-10' }, { period: PERIOD, now })).toBe(false)
    expect(isGrantValid({ ...valid, rkt: 'ffffffffffffffff' }, { rkt: RKT, now })).toBe(false)
  })

  it('never throws on malformed values', () => {
    expect(isGrantValid(null)).toBe(false)
    expect(isGrantValid({})).toBe(false)
    expect(isGrantValid({ expires: 'not a date' })).toBe(false)
    expect(isGrantValid(valid, { now: 'not a date' })).toBe(false)
  })
})

describe('bulletin parsing', () => {
  it('parses the wrapped form from JSON text', () => {
    const parsed = parseBulletin(JSON.stringify({ app: 'banksia', banksia_vault_bulletin: bulletinFixture() }))
    expect(parsed).not.toBeNull()
    expect(parsed.v).toBe(1)
    expect(parsed.blog).toBe(BLOG)
    expect(parsed.period).toBe(PERIOD)
    expect(parsed.seq).toBe(3)
    expect(parsed.keyring).toEqual({ alg: 'A256GCM', iv: 'keyring-iv', ct: 'keyring-ct' })
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].rkt).toBe(RKT)
  })

  it('parses the unwrapped form from an object', () => {
    expect(parseBulletin(bulletinFixture())).toMatchObject({ blog: BLOG, period: PERIOD, seq: 3 })
    expect(parseBulletin(JSON.stringify(bulletinFixture()))).not.toBeNull()
  })

  it('preserves optional fields and drops malformed entries', () => {
    const bulletin = bulletinFixture()
    delete bulletin.keyring.alg
    delete bulletin.entries[0].alg
    delete bulletin.entries[0].tier
    bulletin.entries.push({ rkt: 'missing-material' }, null)
    const parsed = parseBulletin(bulletin)
    expect(parsed.keyring.alg).toBeUndefined()
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].alg).toBeUndefined()
    expect(parsed.entries[0].tier).toBeUndefined()
    expect(parsed.claims).toEqual([])
  })

  it('keeps a parsed bulletin signature-verifiable', async () => {
    const signed = await signGrant(bulletinFixture(), fakeSigner())
    const parsed = parseBulletin(JSON.stringify({ banksia_vault_bulletin: signed }))
    expect(parsed).not.toBeNull()
    expect(await verifyGrant(parsed, fakeVerifier())).toBe(true)
  })

  it('rejects wrong versions, missing entries and bad periods', () => {
    expect(parseBulletin({ ...bulletinFixture(), v: 2 })).toBeNull()
    const noEntries = bulletinFixture()
    delete noEntries.entries
    expect(parseBulletin(noEntries)).toBeNull()
    expect(parseBulletin({ ...bulletinFixture(), entries: 'nope' })).toBeNull()
    expect(parseBulletin({ ...bulletinFixture(), period: 'November' })).toBeNull()
    expect(parseBulletin({ ...bulletinFixture(), blog: 'A!' })).toBeNull()
    expect(parseBulletin({ ...bulletinFixture(), seq: 0 })).toBeNull()
    expect(parseBulletin({ ...bulletinFixture(), seq: 1.5 })).toBeNull()
    expect(parseBulletin({ ...bulletinFixture(), keyring: null })).toBeNull()
    expect(parseBulletin('{not json')).toBeNull()
    expect(parseBulletin(null)).toBeNull()
  })
})

describe('bulletin sequencing and permlinks', () => {
  it('finds the next sequence for a period', () => {
    const replies = [
      { permlink: 'vault-2026-11-1' },
      { permlink: 'vault-2026-11-2-4' },
      { permlink: 'vault-2026-11-02' },
      { permlink: 'not-a-bulletin' },
      { permlink: 'vault-2026-10-9' }
    ]
    expect(nextBulletinSequence(replies, PERIOD)).toBe(3)
    expect(nextBulletinSequence(
      replies.filter(reply => reply.permlink.startsWith('vault-2026-11')),
      PERIOD
    )).toBe(3)
    expect(nextBulletinSequence([])).toBe(1)
    expect(nextBulletinSequence(null)).toBe(1)
    expect(nextBulletinSequence(['vault-2026-11-4'], PERIOD)).toBe(5)
    expect(nextBulletinSequence(replies, '2026-12')).toBe(1)
  })

  it('builds deterministic permlinks', () => {
    expect(bulletinPermlink(PERIOD, 3)).toBe('vault-2026-11-3')
    expect(bulletinPermlink(PERIOD, 3, 2)).toBe('vault-2026-11-3-2')
    expect(() => bulletinPermlink('2026-11', 0)).toThrow(/positive/)
    expect(() => bulletinPermlink('2026-11', 3, 0)).toThrow(/part/)
    expect(() => bulletinPermlink('bad', 1)).toThrow(/period/)
  })
})

describe('delegation certificates', () => {
  const now = Date.now()
  const certificate = {
    v: 1,
    id: 'banksia.vault.delegate',
    blog: BLOG,
    delegate: 'p256:relay',
    scope: ['grant', 'bulletin'],
    notBefore: new Date(now - 60_000).toISOString(),
    notAfter: new Date(now + 86_400_000).toISOString(),
    nonce: 'abc'
  }

  it('verifies a valid certificate against any posting key', async () => {
    const signed = await signGrant(certificate, fakeSigner())
    expect(await verifyDelegation(signed, ['STM111', 'STM222'], fakeVerifier())).toBe(true)
  })

  it('rejects expired, not-yet-valid, wrong-scope and wrong-signature certificates', async () => {
    const signed = await signGrant(certificate, fakeSigner())

    expect(await verifyDelegation(
      { ...signed, notAfter: new Date(now - 1).toISOString() },
      ['STM111'],
      fakeVerifier()
    )).toBe(false)

    expect(await verifyDelegation(
      { ...signed, notBefore: new Date(now + 60_000).toISOString() },
      ['STM111'],
      fakeVerifier()
    )).toBe(false)

    expect(await verifyDelegation({ ...signed, scope: ['bulletin'] }, ['STM111'], fakeVerifier())).toBe(false)
    expect(await verifyDelegation({ ...signed, v: 2 }, ['STM111'], fakeVerifier())).toBe(false)
    expect(await verifyDelegation({ ...signed, sig: 'not-a-signature' }, ['STM111'], fakeVerifier())).toBe(false)
    expect(await verifyDelegation(signed, [], fakeVerifier())).toBe(false)
    expect(await verifyDelegation(null, ['STM111'], fakeVerifier())).toBe(false)
  })
})
