// Pure helpers for the customise bar and the add-widget drawer.
//
// Kept out of the components so the catalogue grouping, availability rules and
// draft/save semantics can be unit tested without mounting Quasar.

import {
  MAX_WIDGETS,
  WIDGET_CATEGORIES,
  WIDGET_REGISTRY,
  WIDGET_WIDTHS,
  canAddWidget,
  defaultSettingsFor,
  insertWidget,
  isDefaultLayout,
  moveWidget,
  removeWidget,
  setWidgetWidth,
  updateWidgetSettings,
  widgetMeta
} from './dashboardLayout'

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
  const meta = widgetMeta(type)
  if (!meta) return []
  const order = ['quarter', 'third', 'half', 'twoThirds', 'full']
  const minimum = WIDGET_WIDTHS.find(entry => entry.value === meta.minWidth)?.columns || 3
  return WIDGET_WIDTHS
    .filter(entry => entry.columns >= minimum)
    .sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value))
    .map(entry => entry.value)
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

/* Re-exported so the bar/drawer can do layout edits without importing the
 * layout module directly (keeps their imports small and obvious). */
export {
  MAX_WIDGETS,
  moveWidget,
  removeWidget,
  setWidgetWidth,
  updateWidgetSettings
}
