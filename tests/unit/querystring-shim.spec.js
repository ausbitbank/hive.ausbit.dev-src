import { describe, it, expect } from 'vitest'
import { stringify as nodeStringify } from 'node:querystring'
import { stringify, parse } from '../../src/shims/querystring'

describe('querystring shim', () => {
  it('matches Node for image proxy options', () => {
    const options = { format: 'match', mode: 'fit', width: 100, height: 200, blur: 1 }
    expect(stringify(options)).toBe(nodeStringify(options))
  })

  it('matches Node for spaces and unicode', () => {
    const options = { q: 'hello world', emoji: '😀', amp: 'a&b' }
    expect(stringify(options)).toBe(nodeStringify(options))
  })

  it('round-trips simple values', () => {
    expect(parse('format=match&mode=fit&width=100')).toEqual({
      format: 'match',
      mode: 'fit',
      width: '100'
    })
  })
})
