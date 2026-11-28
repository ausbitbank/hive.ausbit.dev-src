import { beforeEach, describe, expect, it } from 'vitest'
import { loadLastVisit, saveLastVisit } from '../../src/services/downvoteVisit'

beforeEach(() => {
  localStorage.clear()
})

describe('downvote last visit', () => {
  it('stores a per-scope and per-account timestamp', () => {
    expect(loadLastVisit('viewer', 'alice')).toBe(0)
    const saved = saveLastVisit('viewer', 'alice', 1760000000123)
    expect(saved).toBe(1760000000123)
    expect(loadLastVisit('viewer', 'alice')).toBe(1760000000123)
    expect(loadLastVisit('viewer', 'bob')).toBe(0)
    expect(loadLastVisit('guest', 'alice')).toBe(0)
  })

  it('ignores invalid timestamps', () => {
    expect(saveLastVisit('viewer', 'alice', Number.NaN)).toBe(0)
    expect(loadLastVisit('viewer', 'alice')).toBe(0)
  })
})
