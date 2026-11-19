import { describe, expect, it } from 'vitest'
import { nextSelection, resolveEnterAction } from '../../src/components/CommandPalette.vue'

describe('command palette navigation', () => {
  it('walks results then lands on the search row going down', () => {
    // total 3 result rows plus the "Search for …" row (index -1).
    expect(nextSelection(0, 3, 1, true)).toBe(1)
    expect(nextSelection(1, 3, 1, true)).toBe(2)
    expect(nextSelection(2, 3, 1, true)).toBe(-1)
  })

  it('wraps from the search row back to the first result going down', () => {
    expect(nextSelection(-1, 3, 1, true)).toBe(0)
  })

  it('walks results backwards then onto the search row going up', () => {
    expect(nextSelection(2, 3, -1, true)).toBe(1)
    expect(nextSelection(1, 3, -1, true)).toBe(0)
    expect(nextSelection(0, 3, -1, true)).toBe(-1)
  })

  it('does not get stuck on the search row when pressing up', () => {
    // Regression: pressing Up on the search row previously returned -1 again.
    expect(nextSelection(-1, 3, -1, true)).toBe(2)
  })

  it('wraps without a search row', () => {
    expect(nextSelection(2, 3, 1, false)).toBe(0)
    expect(nextSelection(0, 3, -1, false)).toBe(2)
  })

  it('only offers the search row when one is shown', () => {
    expect(nextSelection(0, 3, 1, false)).toBe(1)
    expect(nextSelection(2, 3, 1, false)).toBe(0)
  })

  it('handles an empty palette', () => {
    expect(nextSelection(0, 0, 1, false)).toBe(-1)
    expect(nextSelection(0, 0, -1, false)).toBe(-1)
    expect(nextSelection(0, 0, 1, true)).toBe(-1)
  })
})

describe('command palette enter', () => {
  it('opens full search when the search row is selected', () => {
    expect(resolveEnterAction(-1, false, true)).toBe('search')
  })

  it('selects the highlighted result', () => {
    expect(resolveEnterAction(0, true, true)).toBe('select')
    expect(resolveEnterAction(2, true, false)).toBe('select')
  })

  it('falls back to full search when a result index is stale', () => {
    expect(resolveEnterAction(5, false, true)).toBe('search')
  })

  it('does nothing when there is neither a result nor a search row', () => {
    expect(resolveEnterAction(0, false, false)).toBe('none')
    expect(resolveEnterAction(-1, false, false)).toBe('none')
  })
})
