import { describe, expect, it } from 'vitest'
import {
  blogProductPath,
  isProductAuthor,
  isProductPermlink,
  parseProductRoute
} from '../../src/services/blogProductPath'

describe('blog product paths', () => {
  it('builds owner, third-party and malformed shop URLs', () => {
    const cases = [
      [['managed-hosting', 'alice', 'alice'], '/shop/managed-hosting'],
      [['managed-hosting', '', 'alice'], '/shop/managed-hosting'],
      [['managed-hosting', 'Alice', 'alice'], '/shop/managed-hosting'],
      [['managed-hosting', 'bob', 'alice'], '/shop/@bob/managed-hosting'],
      [[''], '/shop'],
      [['not valid'], '/shop'],
      [['managed-hosting', 'not a name', 'alice'], '/shop']
    ]
    for (const [args, expected] of cases) expect(blogProductPath(...args)).toBe(expected)
  })

  it('validates product authors and permlinks', () => {
    expect(isProductAuthor('alice')).toBe(true)
    expect(isProductAuthor('Alice')).toBe(true)
    expect(isProductAuthor('a')).toBe(false)
    expect(isProductPermlink('managed-hosting')).toBe(true)
    expect(isProductPermlink('managed hosting')).toBe(false)
  })

  it('parses owner and explicit author routes', () => {
    expect(parseProductRoute({ permlink: 'managed-hosting' }, 'alice'))
      .toEqual({ author: 'alice', permlink: 'managed-hosting' })
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
