import { describe, expect, it } from 'vitest'
import {
  blogProductPath,
  isProductAuthor,
  isProductPermlink,
  parseProductRoute
} from '../../src/services/blogProductPath'

describe('blog product paths', () => {
  it('keeps owner products on the clean shop URL', () => {
    expect(blogProductPath('managed-hosting', 'alice', 'alice')).toBe('/shop/managed-hosting')
    expect(blogProductPath('managed-hosting', '', 'alice')).toBe('/shop/managed-hosting')
    expect(blogProductPath('managed-hosting', 'Alice', 'alice')).toBe('/shop/managed-hosting')
  })

  it('names a third-party seller in the path', () => {
    expect(blogProductPath('managed-hosting', 'bob', 'alice')).toBe('/shop/@bob/managed-hosting')
  })

  it('falls back to the shop for malformed references', () => {
    expect(blogProductPath('')).toBe('/shop')
    expect(blogProductPath('not valid')).toBe('/shop')
    expect(blogProductPath('managed-hosting', 'not a name', 'alice')).toBe('/shop')
  })

  it('validates product authors and permlinks', () => {
    expect(isProductAuthor('alice')).toBe(true)
    expect(isProductAuthor('Alice')).toBe(true)
    expect(isProductAuthor('a')).toBe(false)
    expect(isProductPermlink('managed-hosting')).toBe(true)
    expect(isProductPermlink('managed hosting')).toBe(false)
  })

  it('parses the owner route with the blog account', () => {
    expect(parseProductRoute({ permlink: 'managed-hosting' }, 'alice'))
      .toEqual({ author: 'alice', permlink: 'managed-hosting' })
  })

  it('parses an explicit author route', () => {
    expect(parseProductRoute({ author: 'Bob', permlink: 'managed-hosting' }, 'alice'))
      .toEqual({ author: 'bob', permlink: 'managed-hosting' })
  })

  it('rejects malformed route params before fetching', () => {
    expect(parseProductRoute({ permlink: '' }, 'alice')).toBeNull()
    expect(parseProductRoute({ permlink: 'managed-hosting' }, '')).toBeNull()
    expect(parseProductRoute({ author: 'not a name', permlink: 'managed-hosting' }, 'alice')).toBeNull()
    expect(parseProductRoute({ author: 'bob', permlink: 'bad permlink' }, 'alice')).toBeNull()
  })
})
