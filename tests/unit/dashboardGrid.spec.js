import { describe, expect, it } from 'vitest'
import {
  centreX,
  dropTargetFor,
  groupIntoRows,
  insertIndexFor,
  isDragGesture,
  moveTargetFor,
  toRect
} from '../../src/services/dashboardGrid'
import { moveWidget, buildLayout, widgetMeta, WIDGET_WIDTHS, GRID_COLUMNS, packRows } from '../../src/services/dashboardLayout'

// Rects use the DOMRect shape so the same code path as the browser is tested.
function rect (left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height }
}

// Two columns of 400px at x=0 and x=420, three rows of 200px.
const grid = [
  rect(0, 0, 400, 200), // 0
  rect(420, 0, 400, 200), // 1
  rect(0, 220, 400, 200), // 2
  rect(420, 220, 400, 200), // 3
  rect(0, 440, 820, 200) // 4
]

describe('dashboard grid geometry', () => {
  it('normalises DOMRect and plain rects', () => {
    expect(toRect(rect(10, 20, 30, 40))).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(toRect({ x: 1, y: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(toRect(null)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(centreX(rect(0, 0, 400, 10))).toBe(200)
  })

  it('groups cards into visual rows', () => {
    expect(groupIntoRows(grid)).toEqual([[0, 1], [2, 3], [4]])
    expect(groupIntoRows([])).toEqual([])
  })

  it('drops on the left or right half of the card under the pointer', () => {
    expect(dropTargetFor({ rects: grid, x: 50, y: 100 })).toEqual({ index: 0, edge: 'before' })
    expect(dropTargetFor({ rects: grid, x: 350, y: 100 })).toEqual({ index: 0, edge: 'after' })
    expect(dropTargetFor({ rects: grid, x: 500, y: 100 })).toEqual({ index: 1, edge: 'before' })
    expect(dropTargetFor({ rects: grid, x: 800, y: 100 })).toEqual({ index: 1, edge: 'after' })
  })

  it('picks the nearest row vertically, so a drop under a row lands after it', () => {
    // y=210 is inside the 20px gap between the first row and the second; the
    // first row edge is 200 and the second starts at 220, so both are 10 away
    // and the tie goes to the lower one, i.e. a drop just below a row.
    expect(dropTargetFor({ rects: grid, x: 100, y: 210 })).toEqual({ index: 2, edge: 'before' })
    // Inside the second row.
    expect(dropTargetFor({ rects: grid, x: 100, y: 300 })).toEqual({ index: 2, edge: 'before' })
    // Above the whole grid.
    expect(dropTargetFor({ rects: grid, x: 100, y: -50 })).toEqual({ index: 0, edge: 'before' })
    // Below the last row.
    expect(dropTargetFor({ rects: grid, x: 500, y: 700 })).toEqual({ index: 4, edge: 'after' })
  })

  it('returns null for an empty grid', () => {
    expect(dropTargetFor({ rects: [], x: 0, y: 0 })).toBeNull()
  })

  it('turns a target into an insertion index', () => {
    expect(insertIndexFor({ index: 2, edge: 'before' })).toBe(2)
    expect(insertIndexFor({ index: 2, edge: 'after' })).toBe(3)
    expect(insertIndexFor(null)).toBe(-1)
  })

  it('ignores a pointer that has not moved beyond the slop', () => {
    expect(isDragGesture(2, 2)).toBe(false)
    expect(isDragGesture(4, 2)).toBe(true)
    expect(isDragGesture(-9, 0)).toBe(true)
  })

  it('clamps move targets to the widget count', () => {
    expect(moveTargetFor(-3, 5)).toBe(0)
    expect(moveTargetFor(2.6, 5)).toBe(3)
    expect(moveTargetFor(99, 5)).toBe(5)
  })

  it('moving a widget to a visual insertion position matches moveWidget', () => {
    const layout = buildLayout([
      { type: 'block', width: 'half', settings: {} },
      { type: 'market', width: 'half', settings: {} },
      { type: 'posts', width: 'full', settings: {} },
      { type: 'witnesses', width: 'full', settings: {} },
      { type: 'accountPosts', width: 'full', settings: {} }
    ])
    const order = list => list.map(widget => widget.type)

    // Drag posts (index 2) to the very start: drop before block.
    expect(order(moveWidget(layout, layout[2].id, moveTargetFor(0, 5)))[0]).toBe('posts')
    // Drag posts to after the last widget.
    expect(order(moveWidget(layout, layout[2].id, moveTargetFor(5, 5))).at(-1)).toBe('posts')
    // Drag witnesses (index 3) to just before accountPosts (visual 3 of 4).
    expect(order(moveWidget(layout, layout[3].id, moveTargetFor(3, 4)))).toEqual(['block', 'market', 'posts', 'witnesses', 'accountPosts'])
    // Drag accountPosts to the front.
    expect(order(moveWidget(layout, layout[4].id, moveTargetFor(0, 5)))[0]).toBe('accountPosts')
  })

  it('every registry width token maps to columns within the grid', () => {
    for (const entry of WIDGET_WIDTHS) {
      expect(entry.columns).toBeGreaterThan(0)
      expect(entry.columns).toBeLessThanOrEqual(GRID_COLUMNS)
    }
    expect(WIDGET_WIDTHS.map(entry => entry.value)).toEqual(['quarter', 'third', 'half', 'twoThirds', 'full'])
    // Packing a mixed row never exceeds 12 columns.
    const rows = packRows([
      { type: 'block', width: 'half' },
      { type: 'market', width: 'half' },
      { type: 'posts', width: 'full' }
    ])
    for (const row of rows) {
      expect(row.reduce((sum, item) => sum + item.columns, 0)).toBeLessThanOrEqual(GRID_COLUMNS)
    }
    expect(widgetMeta('market').minWidth).toBeTruthy()
  })
})
