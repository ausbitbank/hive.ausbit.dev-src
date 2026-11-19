// Pure helpers for the customise bar and the add-widget drawer.
//
// Kept out of the components so the catalogue grouping, availability rules and
// draft/save semantics can be unit tested without mounting Quasar.

import {
  MAX_WIDGETS,
  WIDGET_CATEGORIES,
  WIDGET_REGISTRY,
  canAddWidget,
  defaultSettingsFor,
  insertWidget,
  isDefaultLayout,
  moveWidget,
  removeWidget,
  setWidgetWidth,
  updateWidgetSettings,
  widgetMeta,
  widthChoicesFor
} from './dashboardLayout'
import { HOME_MARKET_CURRENCIES, MAX_HOME_MARKET_COINS } from './homeMarket'
import { OPERATION_FILTER_CHOICES } from './operationsFeed'
import { ACCOUNT_FEED_SORTS, FEED_REFERENCE_PLACEHOLDER } from './feedReference'

/**
 * Catalogue for the drawer: one group per category, in the registry's declared
 * category order, with each entry annotated for the current layout.
 *
 * `requiresAccount` widgets stay addable for guests — the registry keeps them
 * in the layout and the widget shows a log-in prompt (`note`) instead of data.
 *
 * Returns `[{ id, label, widgets: [{ type, label, description, icon, added,
 * limitReached, disabled, reason, note }] }]`.
 */
export function widgetCatalogue (layout = [], { signedIn = true } = {}) {
  const widgets = Array.isArray(layout) ? layout : []
  const groups = WIDGET_CATEGORIES.map(category => ({ id: category.id, label: category.label, widgets: [] }))
  const byId = new Map(groups.map(group => [group.id, group]))

  for (const entry of WIDGET_REGISTRY) {
    const group = byId.get(entry.category)
    if (!group) continue
    const check = canAddWidget(widgets, entry.type)
    const needsAccount = Boolean(entry.requiresAccount) && !signedIn
    group.widgets.push({
      type: entry.type,
      label: entry.label,
      description: entry.description,
      icon: entry.icon,
      added: widgets.some(widget => widget.type === entry.type),
      singleton: Boolean(entry.singleton),
      limitReached: widgets.length >= MAX_WIDGETS,
      disabled: !check.ok,
      reason: check.ok ? '' : check.reason,
      note: needsAccount ? 'Log in to see your own numbers in this widget.' : ''
    })
  }

  return groups.filter(group => group.widgets.length)
}

/**
 * The widgets a drawer action can add right now, for a count badge ("Add
 * widget" shows "3 widgets available") and to disable an empty add button.
 */
export function availableWidgetCount (layout = [], options = {}) {
  return widgetCatalogue(layout, options)
    .reduce((total, group) => total + group.widgets.filter(entry => !entry.disabled).length, 0)
}

/** Insert a widget type after `afterId`, merging it with the instance settings. */
export function addWidgetToLayout (layout, type, { afterId = null, settings = {}, now = Date.now() } = {}) {
  if (!widgetMeta(type)) return layout
  const merged = { ...defaultSettingsFor(type), ...settings }
  return insertWidget(layout, type, { afterId, settings: merged, now })
}

/** Width tokens a widget type may use, in WIDGET_WIDTHS order. */
export function widthChoices (type) {
  return widthChoicesFor(type)
}

/**
 * Draft semantics for the bar: edit mode works on a copy of the layout so the
 * user can cancel. These helpers keep the copy honest.
 */
export function draftWidgets (layout) {
  // Shallow copies: widget settings objects are replaced, never mutated, by
  // the layout helpers, so a shared settings object is safe to keep.
  return (Array.isArray(layout) ? layout : []).map(widget => ({ ...widget, settings: { ...widget.settings } }))
}

export function isDirtyDraft (draft, original) {
  const shape = list => (Array.isArray(list) ? list : []).map(widget => JSON.stringify({
    id: widget.id,
    type: widget.type,
    width: widget.width,
    settings: widget.settings
  }))
  const a = shape(draft)
  const b = shape(original)
  return a.length !== b.length || a.some((entry, index) => entry !== b[index])
}

/**
 * Whether saving the draft means "customised" or "back to the built-in
 * default". Resetting to the default is not a customisation, so the page can
 * keep showing the setup prompt and use the original shell.
 */
export function isDefaultDraft (draft) {
  return isDefaultLayout(draft)
}

/**
 * Count of changes for the bar's summary line:
 * `{ added, removed, moved, resized, configured }`.
 */
export function draftChanges (draft, original) {
  const before = Array.isArray(original) ? original : []
  const after = Array.isArray(draft) ? draft : []
  const beforeById = new Map(before.map(widget => [widget.id, widget]))
  const afterIds = new Set(after.map(widget => widget.id))

  let added = 0
  let removed = 0
  let moved = 0
  let resized = 0
  let configured = 0

  for (const widget of after) {
    const previous = beforeById.get(widget.id)
    if (!previous) {
      added += 1
      continue
    }
    if (previous.width !== widget.width) resized += 1
    if (JSON.stringify(previous.settings) !== JSON.stringify(widget.settings)) configured += 1
  }
  for (const widget of before) {
    if (!afterIds.has(widget.id)) removed += 1
  }
  const shared = after.filter(widget => beforeById.has(widget.id)).map(widget => widget.id)
  const beforeOrder = before.filter(widget => afterIds.has(widget.id)).map(widget => widget.id)
  if (shared.join('|') !== beforeOrder.join('|')) moved += 1

  return { added, removed, moved, resized, configured, total: added + removed + moved + resized + configured }
}

/* --- widget settings ------------------------------------------------------ */

export const POST_SOURCE_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'created', label: 'New' },
  { value: 'hot', label: 'Hot' }
]

const ACCOUNT_FIELD = {
  key: 'account',
  kind: 'text',
  label: 'Account',
  hint: 'Leave blank to use the signed-in user.',
  placeholder: 'ausbitbank',
  stripAt: true
}

const LIMIT_FIELD = (max, label = 'Items to show') => ({
  key: 'limit',
  kind: 'number',
  label,
  min: 1,
  max
})

const REFERENCE_FIELD = {
  key: 'reference',
  kind: 'text',
  label: 'Feed reference',
  placeholder: FEED_REFERENCE_PLACEHOLDER,
  hint: 'Paste a Hive path: an account feed, a community, a short-form timeline, a sort or a tag.'
}

const referenceField = hint => ({ ...REFERENCE_FIELD, hint })

/**
 * The settings a widget instance exposes in the Configure dialog. The order is
 * the visual order. An empty list means the widget has nothing to configure
 * (network stats), which also hides its Configure item.
 */
export function settingsFieldsFor (type) {
  switch (type) {
    case 'block':
      return [
        { key: 'compact', kind: 'toggle', label: 'Compact layout', hint: 'Hide the operation mix to keep the card short.' }
      ]
    case 'market':
      return [
        { key: 'coinIds', kind: 'coins', label: 'Coins' },
        { key: 'currency', kind: 'currency', label: 'Quote currency' },
        { key: 'compact', kind: 'toggle', label: 'Compact layout', hint: 'Show at most four coins.' }
      ]
    case 'witnesses':
      return [
        { key: 'limit', kind: 'number', label: 'Witnesses to show', min: 1, max: 20 },
        { key: 'pinMine', kind: 'toggle', label: 'Keep my witness on top', hint: 'Added to the limit rather than replacing a row.' },
        { key: 'highlight', kind: 'text', label: 'Highlight account', placeholder: 'ausbitbank', stripAt: true },
        { key: 'showHealth', kind: 'toggle', label: 'Show signing and price-feed health' }
      ]
    case 'posts':
      return [
        referenceField('Paste a Hive path. When set, it overrides the sort and tag below.'),
        { key: 'source', kind: 'select', label: 'Feed', options: POST_SOURCE_OPTIONS },
        { key: 'tag', kind: 'text', label: 'Community or tag', placeholder: 'hive-dev', stripHash: true },
        { key: 'limit', kind: 'number', label: 'Posts to show', min: 1, max: 20 },
        { key: 'showSortToggle', kind: 'toggle', label: 'Show the Trending/New/Hot switcher' }
      ]
    case 'accountPosts':
      return [
        ACCOUNT_FIELD,
        { key: 'sort', kind: 'select', label: 'Feed type', options: ACCOUNT_FEED_SORTS },
        referenceField('Paste a Hive path. When set, it overrides the account and feed type above.'),
        LIMIT_FIELD(20, 'Posts to show')
      ]
    case 'wallet':
      return [
        ACCOUNT_FIELD,
        {
          key: 'currency',
          kind: 'select',
          label: 'Fiat currency',
          options: [
            { value: 'usd', label: 'US Dollar ($)' },
            { value: 'aud', label: 'Australian Dollar (A$)' },
            { value: 'eur', label: 'Euro (€)' },
            { value: 'gbp', label: 'British Pound (£)' }
          ]
        },
        {
          key: 'includeHiveEngine',
          kind: 'toggle',
          label: 'Include Hive-Engine tokens',
          hint: 'Prices come from the Hive-Engine market and are shown in HIVE terms.'
        }
      ]
    case 'myWitness':
    case 'witnessHealth':
      return [ACCOUNT_FIELD]
    case 'notifications':
      return [LIMIT_FIELD(10, 'Notifications to show'), ACCOUNT_FIELD]
    case 'operations':
      return [
        ACCOUNT_FIELD,
        { key: 'filters', kind: 'multi', label: 'Operation types', options: OPERATION_FILTER_CHOICES },
        { key: 'jsonIds', kind: 'text', label: 'custom_json ids', placeholder: 'follow, vote, reblog', hint: 'Only used for App actions. Blank means every custom_json id.' },
        LIMIT_FIELD(20, 'Operations to show'),
        {
          key: 'pollSeconds',
          kind: 'select',
          label: 'Refresh interval',
          options: [
            { value: 0, label: 'Manual only' },
            { value: 10, label: 'Every 10 seconds' },
            { value: 15, label: 'Every 15 seconds' },
            { value: 30, label: 'Every 30 seconds' },
            { value: 60, label: 'Every minute' },
            { value: 120, label: 'Every 2 minutes' }
          ]
        }
      ]
    default:
      return []
  }
}

export function isConfigurableWidget (type) {
  return settingsFieldsFor(type).length > 0
}

const CURRENCY_IDS = HOME_MARKET_CURRENCIES.map(entry => entry.id)
const COIN_ID = /^[a-z0-9][a-z0-9-]*$/

/**
 * Clamp and cast values coming from the Configure dialog. Only keys the widget
 * declares are kept, so a stale setting from an older layout cannot leak into
 * a card that no longer accepts it.
 */
export function sanitiseWidgetSettings (type, settings = {}) {
  const input = settings && typeof settings === 'object' ? settings : {}
  const result = {}
  for (const field of settingsFieldsFor(type)) {
    if (!(field.key in input)) continue
    const raw = input[field.key]
    switch (field.kind) {
      case 'toggle':
        result[field.key] = Boolean(raw)
        break
      case 'number': {
        const number = Number(raw)
        if (!Number.isFinite(number)) break
        result[field.key] = Math.min(field.max, Math.max(field.min, Math.round(number)))
        break
      }
      case 'select':
        if (field.options.some(option => option.value === raw)) result[field.key] = raw
        break
      case 'multi': {
        const allowed = new Set(field.options.map(option => option.value))
        const values = (Array.isArray(raw) ? raw : [raw])
          .filter(value => allowed.has(value))
        result[field.key] = [...new Set(values)]
        break
      }
      case 'currency': {
        const currency = String(raw ?? '').trim().toLowerCase()
        if (CURRENCY_IDS.includes(currency)) result[field.key] = currency
        break
      }
      case 'coins': {
        const list = (Array.isArray(raw) ? raw : [])
          .map(value => String(value || '').trim().toLowerCase())
          .filter(value => COIN_ID.test(value))
        result[field.key] = [...new Set(list)].slice(0, MAX_HOME_MARKET_COINS)
        break
      }
      case 'text': {
        let value = String(raw ?? '').trim()
        if (field.stripAt) value = value.replace(/^@/, '')
        if (field.stripHash) value = value.replace(/^#/, '')
        result[field.key] = value.slice(0, 80)
        break
      }
      default:
        break
    }
  }
  return result
}

/* Re-exported so the bar/drawer can do layout edits without importing the
 * layout module directly (keeps their imports small and obvious). */
export {
  MAX_WIDGETS,
  moveWidget,
  removeWidget,
  setWidgetWidth,
  updateWidgetSettings
}
