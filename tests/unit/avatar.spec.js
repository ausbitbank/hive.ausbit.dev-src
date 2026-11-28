import { describe, expect, it } from 'vitest'
import { FALLBACK_AVATAR, hiveAvatarUrl } from '../../src/utils/avatar'

describe('hiveAvatarUrl', () => {
  it('builds the default and larger variants and encodes the account name', () => {
    const cases = [
      ['alice', undefined, 'https://images.hive.blog/u/alice/avatar/small'],
      ['alice', 'medium', 'https://images.hive.blog/u/alice/avatar/medium'],
      ['alice', 'large', 'https://images.hive.blog/u/alice/avatar/large'],
      ['a b', undefined, 'https://images.hive.blog/u/a%20b/avatar/small']
    ]
    for (const [account, size, expected] of cases) {
      expect(hiveAvatarUrl(account, size)).toBe(expected)
    }
  })

  it('falls back when there is no account', () => {
    expect(hiveAvatarUrl('')).toBe(FALLBACK_AVATAR)
    expect(hiveAvatarUrl(null)).toBe(FALLBACK_AVATAR)
  })
})
