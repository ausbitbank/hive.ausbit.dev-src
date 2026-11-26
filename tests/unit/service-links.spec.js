import { describe, expect, it } from 'vitest'
import UserServices from '../../src/components/userServices.vue'

const link = (service, value) =>
  UserServices.methods.returnServiceLink.call({ account: { name: 'alice' } }, service, value)

describe('profile service links', () => {
  it('encodes path and query segments', () => {
    expect(link('twitter', 'a b')).toBe('https://x.com/a%20b')
    expect(link('tiktok', 'x/y')).toBe('https://tiktok.com/@x%2Fy')
    expect(link('xbox', 'a&b=c')).toBe('https://account.xbox.com/en-us/profile?gamertag=a%26b%3Dc')
  })

  it('does not let a profile field inject a host', () => {
    const tumblr = link('tumblr', 'evil.example/x')

    expect(tumblr).toBe('https://evil.example%2Fx.tumblr.com')
    expect(tumblr).not.toMatch(/^https:\/\/evil\.example\//)
    expect(link('bandcamp', 'evil.example?x')).not.toContain('evil.example?')
    expect(link('wordpress', 'evil.example#x')).not.toContain('evil.example#')
  })

  it('requires a mastodon host that looks like a domain', () => {
    expect(link('mastodon', '@user@mastodon.social')).toBe('https://mastodon.social/@user')
    expect(link('mastodon', 'user@mastodon.social')).toBe('https://mastodon.social/@user')
    expect(link('mastodon', '@user@evil.example/path')).toBe(
      'https://mstdn.social/@%40user%40evil.example%2Fpath'
    )
    expect(link('mastodon', 'user')).toBe('https://mstdn.social/@user')
  })

  it('keeps URI-scheme fields readable and free of header tricks', () => {
    expect(link('lightning', 'user@wallet.example')).toBe('lightning:user@wallet.example')
    expect(link('email', 'a@b.example?subject=x')).toBe('mailto:a@b.example')
    expect(link('bitcoin', 'bc1qxyz')).toBe('bitcoin:bc1qxyz')
  })

  it('encodes the pinned permlink', () => {
    expect(link('pinned', 'my post')).toBe('https://banksia.io/@alice/my%20post')
  })
})
