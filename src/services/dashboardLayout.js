// Pure layout model for the customisable home dashboard.
//
// A dashboard is an ordered list of widget instances. Widgets are placed on a
// 12-column grid; each instance carries a width token (`quarter`, `third`,
// `half`, `twoThirds`, `full`) rather than a pixel width so the same layout
// works at every breakpoint. Everything here is pure so the arrangement logic
// can be unit tested without mounting Vue.
//
// Order matters: rows are filled left-to-right, and a widget moves to the next
// row when it would overflow the 12 columns. That is what keeps the built-in
// default layout identical to the old hard-coded page.

/** Columns available to widget widths. */
export const GRID_COLUMNS = 12

/** Width tokens and how many columns each occupies. */
export const WIDGET_WIDTHS = [
  { value: 'quarter', label: 'Quarter', columns: 3 },
  { value: 'third', label: 'Third', columns: 4 },
  { value: 'half', label: 'Half', columns: 6 },
  { value: 'twoThirds', label: 'Two thirds', columns: 8 },
  { value: 'full', label: 'Full width', columns: 12 }
]

export const DEFAULT_WIDGET_WIDTH = 'full'
export const MAX_WIDGETS = 20

/**
 * Widget catalogue. `component` is the Vue component name registered by the
 * dashboard grid; `defaultSettings` is spread into each new instance so that
 * adding a widget never needs its own dialog before it renders.
 *
 * `singleton: true` widgets may only appear once per dashboard (a second live
 * block card has no extra value); others can be added several times with
 * different settings (coin prices in AUD and USD, two community feeds, ...).
 *
 * `requiresAccount` widgets need a signed-in user. Guests can still add them,
 * but the shell renders a "log in to see this" state instead of empty data.
 *
 * `live` widgets keep their own polling timer, so the grid only mounts them
 * while they are on screen.
 */
export const WIDGET_REGISTRY = [
  {
    type: 'block',
    component: 'HomeBlockCard',
    label: 'Live block',
    description: 'Latest block, transactions, operations and top operation mix.',
    category: 'network',
    icon: 'view_agenda',
    defaultWidth: 'half',
    minWidth: 'quarter',
    defaultSettings: {},
    singleton: true,
    live: true
  },
  {
    type: 'market',
    component: 'HomeMarketCard',
    label: 'Coin prices',
    description: 'Price, 24h change and sparkline for the coins you choose.',
    category: 'markets',
    icon: 'show_chart',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {},
    singleton: false
  },
  {
    type: 'witnesses',
    component: 'HomeWitnessCard',
    label: 'Top witnesses',
    description: 'Witness approval ranking, optionally pinned to your own witness.',
    category: 'governance',
    icon: 'how_to_vote',
    defaultWidth: 'full',
    minWidth: 'third',
    defaultSettings: { limit: 6, pinMine: false, showHealth: true },
    singleton: false
  },
  {
    type: 'posts',
    component: 'HomeTrendingPosts',
    label: 'Posts on Hive',
    description: 'Trending, new or hot posts, or a community, tag, account feed or short-form timeline.',
    category: 'community',
    icon: 'article',
    defaultWidth: 'full',
    minWidth: 'half',
    defaultSettings: { source: 'trending', tag: '', reference: '', limit: 6, showSortToggle: true },
    singleton: false
  },
  {
    type: 'accountPosts',
    component: 'HomeRecentPosts',
    label: 'Account posts',
    description: 'Recent posts from one account or any feed reference — yours by default.',
    category: 'community',
    icon: 'person',
    defaultWidth: 'full',
    minWidth: 'third',
    defaultSettings: { account: '', reference: '', sort: 'blog', limit: 4 },
    singleton: false
  },
  {
    type: 'wallet',
    component: 'WidgetWallet',
    label: 'My wallet',
    description: 'Portfolio value, balance breakdown and claimable rewards.',
    category: 'account',
    icon: 'account_balance_wallet',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '', currency: 'usd', includeHiveEngine: true },
    requiresAccount: true
  },
  {
    type: 'myWitness',
    component: 'WidgetMyWitness',
    label: 'My witness',
    description: 'Your witness rank, votes, gap to the top 20 and health.',
    category: 'governance',
    icon: 'verified',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: { account: '' },
    requiresAccount: true
  },
  {
    type: 'witnessHealth',
    component: 'WidgetWitnessHealth',
    label: 'Witness health',
    description: 'Health of the witnesses you vote for and your vote weight.',
    category: 'governance',
    icon: 'health_and_safety',
    defaultWidth: 'half',
    minWidth: 'third',
    defaultSettings: {},
    requiresAccount: true
  },
  {
    type: 'network',
    component: 'WidgetNetworkStats',
    label: 'Network stats',
    description: 'Head block, HP supply, participation and HBD debt ratio.',
    category: 'network',
    icon: 'insights',
    defaultWidth: 'full',
    minWidth: 'half',
    defaultSettings: {},
    singleton: true,
    live: true,
    // No per-instance settings; the shell hides its Configure item.
    configurable: false
  },
  {
    type: 'notifications',
    component: 'WidgetNotifications',
    label: 'Notifications',
    description: 'Recent replies, votes and mentions with unread count.',
    category: 'account',
    icon: 'notifications',
    defaultWidth: 'third',
    minWidth: 'third',
    defaultSettings: { limit: 5 },
    requiresAccount: true
  }
]

export const WIDGET_CATEGORIES = [
  { id: 'network', label: 'Network' },
  { id: 'markets', label: 'Markets' },
  { id: 'governance', label: 'Governance' },
  { id: 'community', label: 'Community' },
  { id: 'account', label: 'Your account' }
]

/**
 * The built-in default layout. This intentionally reproduces the pre-dashboard
 * front page so an unconfigured visitor sees exactly what they saw before:
 *
 *   ┌──────────────────────┬───────────────┐
 *   │ block (half) │ market │ witnesses     │
 *   │ posts on Hive (full) │ account posts │
 *   └──────────────────────┴───────────────┘
 *
 * The two-column shell is provided by the page, not the grid: the grid's first
 * two widgets share a row and the last two do too.
 */
export const DEFAULT_LAYOUT = [
  { type: 'block', width: 'half', settings: {} },
  { type: 'market', width: 'half', settings: {} },
  { type: 'posts', width: 'full', settings: { source: 'trending' } },
  { type: 'witnesses', width: 'full', settings: { limit: 6 } },
  { type: 'accountPosts', width: 'full', settings: { account: 'ausbitbank' } }
]

/** Suggested layout offered once when a known account is logged in. */
export const LOGGED_IN_STARTER_LAYOUT = [
  { type: 'wallet', width: 'half', settings: {} },
  { type: 'myWitness', width: 'half', settings: {} },
  { type: 'witnessHealth', width: 'full', settings: {} },
  { type: 'posts', width: 'full', settings: { source: 'trending' } },
  { type: 'network', width: 'full', settings: {} },
  { type: 'block', width: 'half', settings: {} },
  { type: 'market', width: 'half', settings: {} }
]

function registryEntry (type) {
  return WIDGET_REGISTRY.find(entry => entry.type === type) || null
}

export function widgetMeta (type) {
  return registryEntry(type)
}

export function isKnownWidgetType (type) {
  return Boolean(registryEntry(type))
}

function widthColumns (value) {
  const match = WIDGET_WIDTHS.find(entry => entry.value === value)
  return match ? match.columns : GRID_COLUMNS
}

function closestWidth (columns, minWidth) {
  const floor = Math.max(widthColumns(minWidth), Math.min(GRID_COLUMNS, Number(columns) || GRID_COLUMNS))
  let best = WIDGET_WIDTHS[0]
  for (const entry of WIDGET_WIDTHS) {
    if (entry.columns <= floor) best = entry
  }
  return best.value
}

/** Copy of a registry widget's default settings. */
export function defaultSettingsFor (type) {
  const entry = registryEntry(type)
  return entry ? { ...entry.defaultSettings } : {}
}

/**
 * Stable-but-unique instance id. Widgets are identified by instance so two of
 * the same type keep independent settings and never swap on reorder.
 */
let instanceCounter = 0
export function createWidgetId (type = 'widget', now = Date.now()) {
  instanceCounter = (instanceCounter + 1) % 100000
  const random = Math.random().toString(36).slice(2, 6)
  return type + '_' + now.toString(36).slice(-6) + instanceCounter.toString(36) + random
}

/**
 * Normalise one stored instance into a renderable widget, or null when it
 * cannot be salvaged. Unknown types are dropped rather than crashing the page.
 */
export function normaliseWidget (input) {
  if (!input || typeof input !== 'object') return null
  const meta = registryEntry(String(input.type || ''))
  if (!meta) return null
  const settings = input.settings && typeof input.settings === 'object' ? { ...input.settings } : {}
  return {
    id: typeof input.id === 'string' && input.id ? input.id : createWidgetId(meta.type),
    type: meta.type,
    width: closestWidth(widthColumns(input.width), meta.minWidth),
    settings: { ...defaultSettingsFor(meta.type), ...settings }
  }
}

/** Bound a widget to its registry minimum width. */
export function clampWidth (type, width) {
  const meta = registryEntry(type)
  return closestWidth(widthColumns(width), meta?.minWidth || 'quarter')
}

/** Enforce unique ids and singleton rules, and drop unknown widget types. */
export function normaliseLayout (widgets) {
  if (!Array.isArray(widgets)) return []
  const seenIds = new Set()
  const seenSingletons = new Set()
  const result = []
  for (const raw of widgets) {
    const widget = normaliseWidget(raw)
    if (!widget) continue
    if (seenIds.has(widget.id)) widget.id = createWidgetId(widget.type)
    const meta = registryEntry(widget.type)
    if (meta?.singleton) {
      if (seenSingletons.has(widget.type)) continue
      seenSingletons.add(widget.type)
    }
    seenIds.add(widget.id)
    result.push(widget)
    if (result.length >= MAX_WIDGETS) break
  }
  return result
}

/** Turn a layout preset into fresh widget instances. */
export function buildLayout (preset = DEFAULT_LAYOUT, { now = Date.now() } = {}) {
  return normaliseLayout(
    preset.map((entry, index) => ({
      id: createWidgetId(entry.type, now + index),
      type: entry.type,
      width: entry.width,
      settings: entry.settings
    }))
  )
}

/** Can `type` be added given the current layout? */
export function canAddWidget (layout, type) {
  const meta = registryEntry(type)
  if (!meta) return { ok: false, reason: 'Unknown widget.' }
  if (layout.length >= MAX_WIDGETS) return { ok: false, reason: 'This dashboard is full.' }
  if (meta.singleton && layout.some(widget => widget.type === type)) {
    return { ok: false, reason: meta.label + ' is already on this dashboard.' }
  }
  return { ok: true }
}

/** Append a new widget instance; returns a new array. */
export function addWidget (layout, type, { settings = {}, width = '', now = Date.now() } = {}) {
  const check = canAddWidget(layout, type)
  if (!check.ok) return layout
  const meta = registryEntry(type)
  const widget = normaliseWidget({
    id: createWidgetId(type, now),
    type,
    width: width || meta.defaultWidth,
    settings
  })
  return layout.concat([widget])
}

/**
 * Insert a widget before/after another instance. Used by the add drawer so a
 * new widget lands next to the one the user pressed "+" on.
 */
export function insertWidget (layout, type, { afterId = null, settings = {}, now = Date.now() } = {}) {
  const check = canAddWidget(layout, type)
  if (!check.ok) return layout
  const meta = registryEntry(type)
  const widget = normaliseWidget({
    id: createWidgetId(type, now),
    type,
    width: meta.defaultWidth,
    settings
  })
  if (!afterId) return layout.concat([widget])
  const index = layout.findIndex(entry => entry.id === afterId)
  if (index === -1) return layout.concat([widget])
  return layout.slice(0, index + 1).concat([widget], layout.slice(index + 1))
}

export function removeWidget (layout, id) {
  return layout.filter(widget => widget.id !== id)
}

export function updateWidgetSettings (layout, id, settings) {
  return layout.map(widget => {
    if (widget.id !== id) return widget
    const normalised = normaliseWidget({ ...widget, settings: { ...widget.settings, ...settings } })
    return normalised || widget
  })
}

export function setWidgetWidth (layout, id, width) {
  return layout.map(widget => (
    widget.id === id ? { ...widget, width: clampWidth(widget.type, width) } : widget
  ))
}

/** Width tokens a widget may use, narrowest first. */export function widthChoicesFor (type) {
  const meta = registryEntry(type)
  if (!meta) return []
  const minimum = widthColumns(meta.minWidth || 'quarter')
  return WIDGET_WIDTHS.filter(entry => entry.columns >= minimum).map(entry => entry.value)
}

/**
 * Move a widget one width token narrower (`-1`) or wider (`+1`). Stops at the
 * widget's minimum and at full width, so a disabled +/- button and the helper
 * agree on the bounds.
 */
export function stepWidgetWidth (layout, id, direction) {
  return (Array.isArray(layout) ? layout : []).map(widget => {
    if (widget.id !== id) return widget
    const choices = widthChoicesFor(widget.type)
    const current = choices.indexOf(widget.width)
    const step = direction < 0 ? -1 : 1
    const next = choices[Math.max(0, Math.min(choices.length - 1, (current === -1 ? 0 : current) + step))]
    return next ? { ...widget, width: next } : widget
  })
}

/** Move a widget to a new index, keeping the others' relative order. */
export function moveWidget (layout, id, toIndex) {
  const from = layout.findIndex(widget => widget.id === id)
  if (from === -1) return layout
  const target = Math.max(0, Math.min(layout.length - 1, Math.round(Number(toIndex) || 0)))
  if (target === from) return layout
  const next = layout.slice()
  const [widget] = next.splice(from, 1)
  next.splice(target, 0, widget)
  return next
}

/** Swap a widget one position earlier (`-1`) or later (`+1`). */
export function nudgeWidget (layout, id, direction) {
  const from = layout.findIndex(widget => widget.id === id)
  if (from === -1) return layout
  return moveWidget(layout, id, from + (direction < 0 ? -1 : 1))
}

/**
 * Fill 12-column rows left-to-right. Returns arrays of widgets per row; a
 * widget wider than the remaining space starts a new row. Widgets are never
 * split, so the rendered page has no gaps caused by row breaking.
 */
export function packRows (widgets, columns = GRID_COLUMNS) {
  const rows = []
  let current = []
  let used = 0
  for (const widget of Array.isArray(widgets) ? widgets : []) {
    const span = Math.min(columns, widthColumns(widget.width))
    if (used + span > columns && current.length) {
      rows.push(current)
      current = []
      used = 0
    }
    current.push({ widget, columns: span })
    used += span
    if (used >= columns) {
      rows.push(current)
      current = []
      used = 0
    }
  }
  if (current.length) rows.push(current)
  return rows
}

/** True when the stored layout is the built-in default (nothing customised). */
export function isDefaultLayout (layout) {
  if (!Array.isArray(layout)) return false
  const shape = widget => widget.type + ':' + widget.width
  return layout.length === DEFAULT_LAYOUT.length &&
    layout.every((widget, index) => shape(widget) === shape({ ...DEFAULT_LAYOUT[index] }))
}

// -- Portable layouts --------------------------------------------------------

const SHARE_PREFIX = 'HIVE-DASH-1.'

function encodeBase64 (text) {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64')
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64 (text) {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'base64').toString('utf8')
  const binary = atob(text)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function toBase64Url (value) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url (value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return padded + '='.repeat((4 - (padded.length % 4)) % 4)
}

/** Compact, pasteable layout text. Widget ids are intentionally omitted. */
export function serialiseLayout (layout) {
  const widgets = (Array.isArray(layout) ? layout : []).map(widget => ({
    type: widget.type,
    width: clampWidth(widget.type, widget.width),
    settings: widget.settings && typeof widget.settings === 'object' ? widget.settings : {}
  }))
  return SHARE_PREFIX + toBase64Url(encodeBase64(JSON.stringify({ v: 1, widgets })))
}

/**
 * Read a shared layout string or a raw JSON layout. Returns
 * `{ layout, error }`; an invalid string never throws.
 */
export function parseLayoutText (text) {
  const value = String(text || '').trim()
  if (!value) return { layout: null, error: 'Paste a layout string to import.' }
  let json
  try {
    if (value.startsWith(SHARE_PREFIX)) {
      json = decodeBase64(fromBase64Url(value.slice(SHARE_PREFIX.length)))
    } else if (value.startsWith('{')) {
      json = value
    } else {
      return { layout: null, error: 'That does not look like a hive.ausbit.dev layout string.' }
    }
  } catch {
    return { layout: null, error: 'The layout string is damaged and could not be decoded.' }
  }

  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    return { layout: null, error: 'The layout string does not contain valid JSON.' }
  }
  const raw = Array.isArray(parsed) ? parsed : parsed?.widgets
  const layout = normaliseLayout(raw)
  if (!layout.length) return { layout: null, error: 'That layout contains no recognisable widgets.' }
  return { layout, error: '' }
}
