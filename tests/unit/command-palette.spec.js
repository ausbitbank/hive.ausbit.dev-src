import { describe, expect, it } from 'vitest'
import { nextSelection, resolveEnterAction, resolveJumpResults } from '../../src/components/CommandPalette.vue'

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

describe('command palette jump results', () => {
  it('offers topic destinations for a bare word, not an account jump', () => {
    const paths = resolveJumpResults('photography').map(item => item.path)
    expect(paths).toContain('/trending/photography')
    expect(paths).not.toContain('/@photography')
  })

  it('reveals an account jump once a bare word matches a real account', () => {
    const paths = resolveJumpResults('ausbitbank', { accountChecks: { ausbitbank: 'found' } }).map(item => item.path)
    expect(paths).toContain('/@ausbitbank')
    expect(paths).toContain('/@ausbitbank/wallet')
  })

  it('keeps explicit accounts, tags, blocks and URLs as direct jumps', () => {
    expect(resolveJumpResults('@alice').map(item => item.path)).toContain('/@alice')
    expect(resolveJumpResults('#photography').map(item => item.path)).toEqual(
      expect.arrayContaining(['/trending/photography', '/created/photography', '/hot/photography'])
    )
    expect(resolveJumpResults('100000000').map(item => item.path)).toEqual(['/b/100000000'])
    expect(resolveJumpResults('https://peakd.com/@alice').map(item => item.path)).toContain('/@alice')
  })

  it('returns nothing for empty or unrecognised input', () => {
    expect(resolveJumpResults('')).toEqual([])
    expect(resolveJumpResults('   ')).toEqual([])
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
