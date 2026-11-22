import { describe, expect, it, vi } from 'vitest'
import CommunityIndexPage from '../../src/pages/communityIndex.vue'

// Quasar's clearable field emits `update:modelValue(null)`. The page must keep
// rendering and reset the search cleanly instead of calling `.trim()` on null.
describe('community index search clearing', () => {
  it('normalises a cleared model to an empty search string', () => {
    const searchText = CommunityIndexPage.computed.searchText.call({ query: null })
    expect(searchText).toBe('')
    expect(CommunityIndexPage.computed.filtersActive.call({ searchText, hideNsfw: false })).toBe(false)
  })

  it('clears the query, URL and paging immediately', () => {
    const ctx = {
      query: 'photography',
      searchTimer: null,
      syncUrl: vi.fn(),
      load: vi.fn()
    }
    CommunityIndexPage.methods.clearSearch.call(ctx)
    expect(ctx.query).toBe('')
    expect(ctx.syncUrl).toHaveBeenCalledWith('')
    expect(ctx.load).toHaveBeenCalledWith({ reset: true })
  })
})
