import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WIDGET_WIDTH,
  GRID_COLUMNS,
  MAX_WIDGETS,
  WIDGET_REGISTRY,
  WIDGET_WIDTHS,
  addWidget,
  buildLayout,
  canAddWidget,
  clampWidth,
  createWidgetId,
  defaultSettingsFor,
  insertWidget,
  isDefaultLayout,
  isKnownWidgetType,
  moveWidget,
  normaliseLayout,
  normaliseWidget,
  nudgeWidget,
  packRows,
  removeWidget,
  setWidgetWidth,
  stepWidgetWidth,
  updateWidgetSettings,
  widgetMeta,
  widthChoicesFor,
  DEFAULT_LAYOUT
} from '../../src/services/dashboardLayout'

function layoutOf (...types) {
  return buildLayout(types.map(type => ({ type, width: widgetMeta(type).defaultWidth, settings: {} })))
}

describe('dashboard widget registry', () => {
  it('exposes a known widget for every default layout entry', () => {
    for (const entry of DEFAULT_LAYOUT) {
      expect(isKnownWidgetType(entry.type)).toBe(true)
    }
  })

  it('keeps type, component and category on every registry entry', () => {
    for (const entry of WIDGET_REGISTRY) {
      expect(entry.type).toBeTruthy()
      expect(entry.component).toBeTruthy()
      expect(entry.label).toBeTruthy()
      expect(entry.category).toBeTruthy()
      expect(entry.defaultWidth).toBeTruthy()
    }
  })

  it('rejects unknown widget types', () => {
    expect(isKnownWidgetType('nope')).toBe(false)
    expect(normaliseWidget({ type: 'nope' })).toBeNull()
    expect(widgetMeta('nope')).toBeNull()
  })

  it('copies default settings so instances do not share objects', () => {
    const first = defaultSettingsFor('witnesses')
    const second = defaultSettingsFor('witnesses')
    first.limit = 99
    expect(second.limit).toBe(6)
    expect(defaultSettingsFor('nope')).toEqual({})
  })
})

describe('widget widths', () => {
  it('maps every width token to grid columns', () => {
    for (const width of WIDGET_WIDTHS) {
      expect(width.columns).toBeGreaterThan(0)
      expect(width.columns).toBeLessThanOrEqual(GRID_COLUMNS)
    }
  })

  it('clamps a width below the widget minimum', () => {
    expect(clampWidth('posts', 'quarter')).toBe('half')
    expect(clampWidth('posts', 'full')).toBe('full')
  })

  it('falls back to full width for unknown tokens', () => {
    expect(clampWidth('block', 'enormous')).toBe(DEFAULT_WIDGET_WIDTH)
  })

  it('setWidgetWidth clamps instead of storing an invalid value', () => {
    const [widget] = layoutOf('posts')
    const next = setWidgetWidth([widget], widget.id, 'quarter')
    expect(next[0].width).toBe('half')
  })

  it('lists the same choices the +/- width buttons step through', () => {
    expect(widthChoicesFor('block')).toEqual(['quarter', 'third', 'half', 'twoThirds', 'full'])
    expect(widthChoicesFor('posts')).toEqual(['half', 'twoThirds', 'full'])
    expect(widthChoicesFor('nope')).toEqual([])
  })

  it('steps a widget wider and narrower within its bounds', () => {
    const [widget] = layoutOf('posts')
    const start = { ...widget, width: 'half' }

    const wider = stepWidgetWidth([start], start.id, 1)
    expect(wider[0].width).toBe('twoThirds')

    const back = stepWidgetWidth(wider, start.id, -1)
    expect(back[0].width).toBe('half')

    // At the minimum and at full width the token does not move.
    expect(stepWidgetWidth([start], start.id, -1)[0].width).toBe('half')
    const full = { ...start, width: 'full' }
    expect(stepWidgetWidth([full], full.id, 1)[0].width).toBe('full')
  })

  it('leaves other widgets and unknown ids alone when stepping width', () => {
    const layout = layoutOf('posts', 'block')
    const next = stepWidgetWidth(layout, 'missing', 1)
    expect(next.map(widget => widget.width)).toEqual(layout.map(widget => widget.width))
    const widened = stepWidgetWidth(layout, layout[1].id, 1)
    expect(widened[0].width).toBe(layout[0].width)
    expect(widened[1].width).toBe('twoThirds')
  })
})

describe('widget instances', () => {
  it('creates unique ids', () => {
    const ids = new Set([createWidgetId('a'), createWidgetId('a'), createWidgetId('a')])
    expect(ids.size).toBe(3)
  })

  it('merges defaults under stored settings', () => {
    const widget = normaliseWidget({ type: 'witnesses', settings: { limit: 10 } })
    expect(widget.settings).toEqual({ limit: 10, pinMine: false, showHealth: true })
    expect(widget.width).toBe('full')
  })

  it('adds a widget with defaults and blocks a second singleton', () => {
    const layout = layoutOf('block')
    expect(canAddWidget(layout, 'block').ok).toBe(false)
    expect(addWidget(layout, 'block')).toHaveLength(1)
    const next = addWidget(layout, 'wallet')
    expect(next).toHaveLength(2)
    expect(next[1].settings).toEqual({ account: '' })
  })

  it('inserts after a chosen widget so the add drawer can place it locally', () => {
    const layout = layoutOf('block', 'posts')
    const next = insertWidget(layout, 'witnesses', { afterId: layout[0].id })
    expect(next.map(widget => widget.type)).toEqual(['block', 'witnesses', 'posts'])
  })

  it('appends when the anchor no longer exists', () => {
    const layout = layoutOf('block')
    const next = insertWidget(layout, 'wallet', { afterId: 'missing' })
    expect(next.map(widget => widget.type)).toEqual(['block', 'wallet'])
  })

  it('updates settings without dropping unknown keys', () => {
    const [widget] = layoutOf('market')
    const next = updateWidgetSettings([widget], widget.id, { coinIds: ['hive', 'bitcoin'] })
    expect(next[0].settings.coinIds).toEqual(['hive', 'bitcoin'])
  })

  it('removes widgets by instance id', () => {
    const layout = layoutOf('block', 'wallet')
    expect(removeWidget(layout, layout[0].id).map(widget => widget.type)).toEqual(['wallet'])
  })

  it('moves a widget to an index and nudges it one slot', () => {
    const layout = layoutOf('block', 'market', 'witnesses')
    const moved = moveWidget(layout, layout[2].id, 0)
    expect(moved.map(widget => widget.type)).toEqual(['witnesses', 'block', 'market'])
    const nudged = nudgeWidget(layout, layout[0].id, 1)
    expect(nudged.map(widget => widget.type)).toEqual(['market', 'block', 'witnesses'])
    expect(nudgeWidget(layout, layout[0].id, -1)).toEqual(layout)
  })
})

describe('layout normalisation', () => {
  it('drops unknown types, duplicates and excess widgets', () => {
    const raw = [
      { type: 'block' },
      { type: 'block' },
      { type: 'unknown' },
      ...Array.from({ length: MAX_WIDGETS + 5 }, () => ({ type: 'market' }))
    ]
    const layout = normaliseLayout(raw)
    expect(layout.filter(widget => widget.type === 'block')).toHaveLength(1)
    expect(layout.length).toBe(MAX_WIDGETS)
    expect(layout.every(widget => widget.type !== 'unknown')).toBe(true)
  })

  it('gives duplicate ids fresh ids', () => {
    const layout = normaliseLayout([
      { id: 'same', type: 'market' },
      { id: 'same', type: 'witnesses' }
    ])
    expect(layout[0].id).not.toBe(layout[1].id)
  })

  it('returns an empty list for non-arrays', () => {
    expect(normaliseLayout(null)).toEqual([])
    expect(normaliseLayout({})).toEqual([])
  })

  it('recognises an untouched default layout', () => {
    expect(isDefaultLayout(normaliseLayout(DEFAULT_LAYOUT.map(entry => ({ type: entry.type, width: entry.width }))))).toBe(true)
    expect(isDefaultLayout(buildLayout([{ type: 'wallet' }]))).toBe(false)
  })
})

describe('row packing', () => {
  it('places two half-width widgets on one row', () => {
    const rows = packRows(layoutOf('block', 'market'))
    expect(rows).toHaveLength(1)
    expect(rows[0].map(entry => entry.columns)).toEqual([6, 6])
  })

  it('breaks a row when the next widget would overflow', () => {
    const rows = packRows(layoutOf('market', 'market', 'market'))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveLength(2)
    expect(rows[1]).toHaveLength(1)
  })

  it('puts a full-width widget on its own row', () => {
    const rows = packRows(layoutOf('witnesses'))
    expect(rows).toHaveLength(1)
    expect(rows[0][0].columns).toBe(GRID_COLUMNS)
  })

  it('handles empty input', () => {
    expect(packRows([])).toEqual([])
    expect(packRows(null)).toEqual([])
  })
})
