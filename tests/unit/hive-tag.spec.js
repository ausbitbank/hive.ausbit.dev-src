import { describe, expect, it } from 'vitest'
import { MAX_TAG_LENGTH, isValidTag, sanitizeTag } from '../../src/utils/hiveTag'

describe('hive tags', () => {
  it('accepts the tags hivemind lets you query', () => {
    expect(isValidTag('hive')).toBe(true)
    expect(isValidTag('hive-174578')).toBe(true)
    expect(isValidTag('c-c-c')).toBe(true)
  })

  it('rejects tags hivemind asserts on', () => {
    expect(isValidTag('hive.ausbit.dev')).toBe(false)
    expect(isValidTag('Hive')).toBe(false)
    expect(isValidTag('bad tag')).toBe(false)
    expect(isValidTag('')).toBe(false)
    expect(isValidTag(null)).toBe(false)
  })

  it('sanitises composer input into a publishable tag', () => {
    expect(sanitizeTag(' #My Tag ')).toBe('my-tag')
    expect(sanitizeTag('hive.ausbit.dev')).toBe('hive-ausbit-dev')
    expect(sanitizeTag('a'.repeat(40))).toHaveLength(MAX_TAG_LENGTH)
    expect(sanitizeTag('!!!')).toBe('')
  })
})
