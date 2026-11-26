import { describe, expect, it } from 'vitest'
import {
  MAX_ACCOUNT_METADATA_BYTES,
  accountMetadataSize,
  buildLegacyMetadataOperation,
  buildPostingMetadataOperation,
  canonicalAccountMetadata,
  formatAccountMetadata,
  hasProfileField,
  parseAccountMetadata,
  profileFromMetadata,
  removeProfileField,
  setProfileField
} from '../../src/services/accountMetadata'

describe('account metadata parsing', () => {
  it('treats brand-new account metadata as an empty object', () => {
    // Fresh accounts return '' for both metadata fields on chain.
    expect(parseAccountMetadata('')).toEqual({ ok: true, value: {}, empty: true, error: '' })
    expect(parseAccountMetadata('   ')).toEqual({ ok: true, value: {}, empty: true, error: '' })
    expect(parseAccountMetadata(null)).toEqual({ ok: true, value: {}, empty: true, error: '' })
    expect(parseAccountMetadata(undefined)).toEqual({ ok: true, value: {}, empty: true, error: '' })
  })

  it('parses object JSON and reports whether it has fields', () => {
    expect(parseAccountMetadata('{}')).toMatchObject({ ok: true, empty: true, value: {} })
    expect(parseAccountMetadata('{"profile":{"name":"Banksia"}}')).toMatchObject({
      ok: true,
      empty: false,
      value: { profile: { name: 'Banksia' } }
    })
  })

  it('rejects malformed JSON and non-object values', () => {
    expect(parseAccountMetadata('{oops').ok).toBe(false)
    expect(parseAccountMetadata('[]').ok).toBe(false)
    expect(parseAccountMetadata('null').ok).toBe(false)
    expect(parseAccountMetadata('42').ok).toBe(false)
  })

  it('accepts objects without mutating them', () => {
    const input = { profile: { name: 'Banksia' } }
    const result = parseAccountMetadata(input)
    result.value.profile.name = 'Changed'
    expect(input.profile.name).toBe('Banksia')
  })
})

describe('profile metadata helpers', () => {
  it('creates a profile when the first field is set', () => {
    const next = setProfileField({}, 'profile_image', 'https://images.hive.blog/a.png')
    expect(next).toEqual({ profile: { profile_image: 'https://images.hive.blog/a.png' } })
  })

  it('preserves unrelated metadata and profile fields', () => {
    const next = setProfileField(
      { profile: { name: 'Banksia' }, 'banksia.io': { theme: { schema: 1 } } },
      'cover_image',
      'https://images.hive.blog/cover.png'
    )
    expect(next.profile).toEqual({
      name: 'Banksia',
      cover_image: 'https://images.hive.blog/cover.png'
    })
    expect(next['banksia.io']).toEqual({ theme: { schema: 1 } })
  })

  it('removes a field and drops an empty profile object', () => {
    const once = removeProfileField({ profile: { name: 'Banksia' } }, 'name')
    expect(once).toEqual({})
    const kept = removeProfileField({ profile: { name: 'Banksia', about: 'Hi' } }, 'name')
    expect(kept).toEqual({ profile: { about: 'Hi' } })
  })

  it('reports profile field existence without treating the prototype as a field', () => {
    const value = { profile: { name: 'Banksia' } }
    expect(hasProfileField(value, 'name')).toBe(true)
    expect(hasProfileField(value, 'about')).toBe(false)
    expect(hasProfileField(value, 'toString')).toBe(false)
  })

  it('reads a profile object or falls back to an empty one', () => {
    expect(profileFromMetadata({ profile: { name: 'Banksia' } })).toEqual({ name: 'Banksia' })
    expect(profileFromMetadata({ profile: 'nope' })).toEqual({})
    expect(profileFromMetadata({})).toEqual({})
  })
})

describe('account metadata formatting', () => {
  it('formats and canonicalises consistently', () => {
    const value = { profile: { name: 'Banksia' } }
    expect(JSON.parse(formatAccountMetadata(value))).toEqual(value)
    expect(canonicalAccountMetadata(value)).toBe('{"profile":{"name":"Banksia"}}')
    expect(accountMetadataSize(value)).toBe(new TextEncoder().encode(canonicalAccountMetadata(value)).length)
    expect(MAX_ACCOUNT_METADATA_BYTES).toBe(16000)
  })
})

describe('account metadata operations', () => {
  it('updates posting metadata with account_update2 and leaves legacy metadata unchanged', () => {
    const operation = buildPostingMetadataOperation('banksia-io', '{"profile":{}}')
    expect(operation).toEqual(['account_update2', {
      account: 'banksia-io',
      json_metadata: '',
      posting_json_metadata: '{"profile":{}}',
      extensions: []
    }])
  })

  it('updates legacy metadata with the active key only when account fields exist', () => {
    const account = {
      name: 'banksia-io',
      posting: { weight_threshold: 1, account_auths: [], key_auths: [] },
      memo_key: 'STM111'
    }
    expect(buildLegacyMetadataOperation(account, '{"profile":{}}')).toEqual(['account_update', {
      account: 'banksia-io',
      posting: account.posting,
      memo_key: 'STM111',
      json_metadata: '{"profile":{}}'
    }])
    expect(buildLegacyMetadataOperation({ name: 'banksia-io' }, '{}')).toBe(null)
    expect(buildLegacyMetadataOperation(null, '{}')).toBe(null)
  })
})
