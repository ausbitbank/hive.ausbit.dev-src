import { describe, expect, it } from 'vitest'
import {
  buildAccountCreationMetadata,
  hasProfileMetadata,
  isNewAccount,
  onboardingSponsor,
  parseMetadataObject,
  profileFromMetadata
} from '../../src/services/accountOnboarding'

describe('account onboarding metadata', () => {
  it('builds small, valid creation metadata with sponsor attribution', () => {
    const raw = buildAccountCreationMetadata({
      sponsor: 'AusbitBank',
      via: 'claim-link',
      nonce: 'abc123'
    })
    expect(JSON.parse(raw)).toEqual({
      app: 'banksia.io',
      via: 'claim-link',
      nonce: 'abc123',
      onboarding: {
        version: 1,
        sponsor: 'ausbitbank'
      }
    })
  })

  it('omits an invalid sponsor rather than writing bad attribution', () => {
    const metadata = JSON.parse(buildAccountCreationMetadata({ sponsor: 'Not A Name', via: 'create-page' }))
    expect(metadata.onboarding).toEqual({ version: 1 })
  })

  it('reads the sponsor from legacy or posting metadata', () => {
    expect(onboardingSponsor(JSON.stringify({ onboarding: { sponsor: 'alice' } }))).toBe('alice')
    expect(onboardingSponsor('', JSON.stringify({ onboarding: { sponsor: 'bob' } }))).toBe('bob')
    expect(onboardingSponsor(JSON.stringify({ sponsor: 'carol' }))).toBe('carol')
    expect(onboardingSponsor('not-json')).toBe('')
  })

  it('parses profile metadata safely', () => {
    const raw = JSON.stringify({ profile: { name: 'Alice', about: 'Hi' }, version: 2 })
    expect(profileFromMetadata(raw)).toEqual({ name: 'Alice', about: 'Hi' })
    expect(hasProfileMetadata(raw)).toBe(true)
    expect(hasProfileMetadata('')).toBe(false)
    expect(hasProfileMetadata('{bad json')).toBe(false)
    expect(parseMetadataObject('null')).toEqual({})
  })

  it('only treats recent accounts as new', () => {
    const now = Date.parse('2026-11-26T12:00:00Z')
    expect(isNewAccount('2026-11-20T12:00:00', now)).toBe(true)
    expect(isNewAccount('2026-09-01T12:00:00', now)).toBe(false)
    expect(isNewAccount('', now)).toBe(false)
    expect(isNewAccount('not-a-date', now)).toBe(false)
  })
})
