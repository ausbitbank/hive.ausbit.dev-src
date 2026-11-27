import { describe, expect, it } from 'vitest'
import { isValidAccountName, validateAccountName } from '../../src/services/hiveNames'

const VALID = ['abc', 'alice', 'hive.fund', 'a-b-c', 'abc123', 'abc.defg', 'a1b']
const INVALID = [
  '',
  'ab',
  'a'.repeat(17),
  'Abc',
  '1abc',
  'abc_',
  'abc-',
  '-abc',
  'abc..def',
  '.abc',
  'abc.',
  'abc def',
  'ab.cdef',
  'ümlaut'
]

describe('validateAccountName', () => {
  it.each(VALID)('accepts %s', name => {
    expect(validateAccountName(name)).toBeNull()
    expect(isValidAccountName(name)).toBe(true)
  })

  it.each(INVALID)('rejects %j', name => {
    expect(typeof validateAccountName(name)).toBe('string')
    expect(isValidAccountName(name)).toBe(false)
  })

  it('explains each failure with the Hive-style message', () => {
    expect(validateAccountName(null)).toBe('Account name should not be empty.')
    expect(validateAccountName('ab')).toBe('Account name should be longer.')
    expect(validateAccountName('a'.repeat(17))).toBe('Account name should be shorter.')
    expect(validateAccountName('Abc')).toBe('Account name should start with a lowercase letter.')
    expect(validateAccountName('abc_')).toBe('Account name should have only lowercase letters, digits, or dashes.')
    expect(validateAccountName('abc-')).toBe('Account name should end with a lowercase letter or digit.')
    expect(validateAccountName('ab.cdef')).toBe('Each account segment should be longer')
    expect(validateAccountName('abc.def-')).toBe('Each account segment should end with a lowercase letter or digit.')
  })

  it('treats non-empty non-strings as empty rather than throwing on length', () => {
    expect(validateAccountName(123)).toBe('Account name should not be empty.')
  })
})
