import { describe, expect, it } from 'vitest'
import {
  authoritiesFromPayload,
  authoritiesMatchKeys,
  authoritiesMatchPayload,
  buildClaimLink,
  buildClaimPayload,
  claimAgeDays,
  claimFingerprint,
  claimFromLink,
  decodeClaimPayload,
  encodeClaimPayload,
  publicKeysFromAuthorities
} from '../../src/services/accountClaim'

const KEY = 'STM' + 'A'.repeat(50)

function payload (overrides = {}) {
  return buildClaimPayload({
    username: 'alice',
    owner: KEY,
    active: KEY,
    posting: KEY,
    memo: KEY,
    createdAt: 1700000000000,
    nonce: '0123456789abcdef',
    ...overrides
  })
}

describe('account claim links', () => {
  it('builds and round-trips a public-key-only payload', () => {
    const claim = payload()
    const encoded = encodeClaimPayload(claim)
    const decoded = decodeClaimPayload(encoded)

    expect(decoded).toEqual(claim)
    expect(decoded).not.toHaveProperty('password')
    expect(decoded).not.toHaveProperty('privateKeys')
  })

  it('normalises the username and keeps a stable key set', () => {
    const claim = payload({ username: ' Alice ' })
    expect(claim.u).toBe('alice')
    expect(claim.o).toBe(KEY)
    expect(claim.a).toBe(KEY)
    expect(claim.p).toBe(KEY)
    expect(claim.m).toBe(KEY)
  })

  it('reads a claim from a full link fragment', () => {
    const claim = payload()
    const link = buildClaimLink(claim, 'https://banksia.io')
    expect(link.startsWith('https://banksia.io/create/claim#claim=')).toBe(true)
    expect(claimFromLink(link)).toEqual(claim)
  })

  it('accepts a bare hash and a query fallback', () => {
    const claim = payload()
    const encoded = encodeClaimPayload(claim)
    expect(claimFromLink('#claim=' + encoded)).toEqual(claim)
    expect(claimFromLink('https://banksia.io/create/claim?claim=' + encoded)).toEqual(claim)
  })

  it('returns null when a link has no claim payload', () => {
    expect(claimFromLink('https://banksia.io/join')).toBeNull()
    expect(claimFromLink('')).toBeNull()
  })

  it('rejects malformed payloads and invalid account names', () => {
    expect(() => claimFromLink('https://banksia.io/create/claim#claim=not-base64')).toThrow()
    expect(() => payload({ username: 'A' })).toThrow()
    expect(() => payload({ username: 'alice' })).not.toThrow()
  })

  it('rejects invalid public keys', () => {
    expect(() => payload({ owner: 'not-a-key' })).toThrow(/owner public key/)
    expect(() => payload({ memo: 'STM0OIl' })).toThrow(/memo public key/)
  })

  it('converts payload keys into Hive authorities', () => {
    const claim = payload()
    const authorities = authoritiesFromPayload(claim)
    expect(authorities.owner).toEqual({ weight_threshold: 1, account_auths: [], key_auths: [[KEY, 1]] })
    expect(authorities.active).toEqual({ weight_threshold: 1, account_auths: [], key_auths: [[KEY, 1]] })
    expect(authorities.posting).toEqual({ weight_threshold: 1, account_auths: [], key_auths: [[KEY, 1]] })
    expect(authorities.memo_key).toBe(KEY)
  })

  it('extracts public keys from generated authorities', () => {
    const authority = { weight_threshold: 1, account_auths: [], key_auths: [[KEY, 1]] }
    expect(publicKeysFromAuthorities({
      owner: authority,
      active: authority,
      posting: authority,
      memo_key: KEY
    })).toEqual({ owner: KEY, active: KEY, posting: KEY, memo: KEY })
  })

  it('produces a stable fingerprint and age', async () => {
    const claim = payload()
    const first = await claimFingerprint(claim)
    const second = await claimFingerprint({ ...claim })
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{8,16}$/)
    expect(claimAgeDays(claim, claim.t + 86400000)).toBeCloseTo(1)
  })
})

describe('claim authority matching', () => {
  it('accepts the exact generated authorities', () => {
    const claim = payload()
    const account = { ...authoritiesFromPayload(claim), name: 'alice' }
    expect(authoritiesMatchPayload(account, claim)).toBe(true)
    expect(authoritiesMatchKeys(account, {
      owner: claim.o,
      active: claim.a,
      posting: claim.p,
      memo: claim.m
    })).toBe(true)
  })

  it('rejects extra account authority, thresholds and extra keys', () => {
    const claim = payload()
    const exact = authoritiesFromPayload(claim)
    const withAccount = {
      ...exact,
      active: { ...exact.active, account_auths: [['sponsor', 1]] }
    }
    const withThreshold = {
      ...exact,
      posting: { ...exact.posting, weight_threshold: 2 }
    }
    const withExtraKey = {
      ...exact,
      owner: { ...exact.owner, key_auths: [...exact.owner.key_auths, ['STM' + 'B'.repeat(50), 1]] }
    }
    expect(authoritiesMatchPayload(withAccount, claim)).toBe(false)
    expect(authoritiesMatchPayload(withThreshold, claim)).toBe(false)
    expect(authoritiesMatchPayload(withExtraKey, claim)).toBe(false)
    expect(authoritiesMatchPayload({ ...exact, memo_key: 'STM' + 'C'.repeat(50) }, claim)).toBe(false)
  })

  it('rejects a missing key set or payload', () => {
    expect(authoritiesMatchPayload({}, null)).toBe(false)
    expect(authoritiesMatchKeys({}, {})).toBe(false)
  })
})
