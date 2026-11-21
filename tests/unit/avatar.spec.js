import { describe, expect, it } from 'vitest'
import { FALLBACK_AVATAR, hiveAvatarUrl } from '../../src/utils/avatar'

describe('hiveAvatarUrl', () => {
  it('defaults to the 64px variant', () => {
    expect(hiveAvatarUrl('alice')).toBe('https://images.hive.blog/u/alice/avatar/small')
  })

  it('supports the larger variants', () => {
    expect(hiveAvatarUrl('alice', 'medium')).toBe('https://images.hive.blog/u/alice/avatar/medium')
    expect(hiveAvatarUrl('alice', 'large')).toBe('https://images.hive.blog/u/alice/avatar/large')
  })

  it('encodes the account name', () => {
    expect(hiveAvatarUrl('a b')).toBe('https://images.hive.blog/u/a%20b/avatar/small')
  })

  it('falls back when there is no account', () => {
    expect(hiveAvatarUrl('')).toBe(FALLBACK_AVATAR)
    expect(hiveAvatarUrl(null)).toBe(FALLBACK_AVATAR)
  })
})
