import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_VIEWS, loadViews, removeView, saveView } from '../../src/services/downvoteViews'

beforeEach(() => {
  localStorage.clear()
})

describe('downvote saved views', () => {
  it('saves, replaces and removes a view by name', () => {
    saveView('viewer', 'Exact flags', { range: '30', impact: 'exact', notes: '1' }, 'Last 30 days · exact')
    let views = loadViews('viewer')
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({ name: 'Exact flags', summary: 'Last 30 days · exact' })
    expect(views[0].filters).toMatchObject({ range: '30', impact: 'exact', notes: '1' })

    saveView('viewer', 'exact flags', { range: '7' }, 'Last 7 days')
    views = loadViews('viewer')
    expect(views).toHaveLength(1)
    expect(views[0].filters.range).toBe('7')

    removeView('viewer', 'EXACT FLAGS')
    expect(loadViews('viewer')).toEqual([])
  })

  it('keeps scopes separate and caps the list', () => {
    saveView('alice', 'Mine', { range: '7' })
    expect(loadViews('bob')).toEqual([])
    for (let index = 0; index < MAX_VIEWS + 5; index++) {
      saveView('alice', 'View ' + index, { range: '30' })
    }
    expect(loadViews('alice').length).toBe(MAX_VIEWS)
  })

  it('drops invalid filter values and names', () => {
    saveView('viewer', '', { range: '7' })
    expect(loadViews('viewer')).toEqual([])
    saveView('viewer', 'Safe', { range: '7', ignored: true, notes: false, voter: ' bob ', extra: 'x' })
    const view = loadViews('viewer')[0]
    expect(view.filters).toEqual({ range: '7', ignored: '1', voter: 'bob' })
  })
})
