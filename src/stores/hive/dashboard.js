import {
  GUEST_SCOPE,
  buildDashboardFromPreset,
  dashboardStorageKey,
  defaultDashboard,
  dismissSetupPrompt as dismissStoredPrompt,
  findSavedLayout,
  removeSavedLayout,
  renameSavedLayout,
  resolveDashboard,
  saveDashboard as saveStoredDashboard,
  saveNamedLayout,
  shouldShowSetupPrompt
} from '../../services/dashboardPrefs'
import {
  createWidgetId,
  defaultSettingsFor,
  isDefaultLayout,
  normaliseLayout,
  widgetMeta
} from '../../services/dashboardLayout'

function getStorage () {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or a blocked storage implementation.
  }
  return null
}

function dashboardState (username = null) {
  const resolved = resolveDashboard(username)
  return {
    dashboard: {
      // The layout currently being shown. Guests always edit the shared guest
      // layout; signing in swaps this for the account's own layout.
      widgets: resolved.widgets,
      // Which stored layout `widgets` came from: 'account' | 'guest' | 'builtin'.
      source: resolved.source,
      // The storage scope being edited (`alice` or `default`).
      scope: resolved.scope,
      // True while the user has not saved any customisation for this scope.
      customised: resolved.customised,
      savedAt: resolved.savedAt,
      // 'rows' packs widgets into horizontal rows; 'masonry' fills gaps.
      tiling: resolved.tiling || 'rows',
      // Named snapshots stored beside the active layout, plus which one (if
      // any) the current widgets came from.
      layouts: resolved.layouts || [],
      activeLayoutId: resolved.activeLayoutId || '',
      // Editor state lives in the store so widgets and the toolbar agree.
      editing: false,
      // Set when localStorage refused a write; the layout still works in memory.
      storageFailed: false,
      // The one-time "make it yours" prompt for a known account with no
      // customised layout. Resolved at boot as well as on login, because a
      // restored session never calls `loadDashboard`.
      setupPromptVisible: shouldShowSetupPrompt(username),
      setupPromptDismissed: false
    }
  }
}

/** Load the layout for `username` (or the guest layout when empty). */
export function loadDashboard (username) {
  const resolved = resolveDashboard(username)
  this.dashboard.widgets = resolved.widgets
  this.dashboard.source = resolved.source
  this.dashboard.scope = resolved.scope
  this.dashboard.customised = resolved.customised
  this.dashboard.savedAt = resolved.savedAt
  this.dashboard.tiling = resolved.tiling || 'rows'
  this.dashboard.layouts = resolved.layouts || []
  this.dashboard.activeLayoutId = resolved.activeLayoutId || ''
  this.dashboard.editing = false
  this.dashboard.storageFailed = false
  this.dashboard.setupPromptDismissed = false
  this.refreshSetupPrompt(username)
}

/** Persist the current widgets to the active scope. */
export function persistDashboard ({ customised = true } = {}) {
  const result = saveStoredDashboard(this.dashboard.scope, this.dashboard.widgets, {
    storage: getStorage(),
    customised,
    tiling: this.dashboard.tiling,
    layouts: this.dashboard.layouts,
    activeLayoutId: this.dashboard.activeLayoutId
  })
  this.dashboard.storageFailed = !result.ok
  if (result.ok) {
    this.dashboard.savedAt = result.savedAt
    this.dashboard.customised = customised
  }
  return result
}

/**
 * Apply a pure layout operation (from `dashboardLayout.js`) and save it.
 * Every reorder/resize/add/remove goes through here so persistence and the
 * visible layout can never drift apart.
 *
 * `customised` defaults to "the result differs from the built-in default", so
 * saving a layout that happens to be the default keeps the setup prompt and
 * the original page shell in play.
 */
export function applyDashboardWidgets (widgets, { customised, tiling, activeLayoutId } = {}) {
  this.dashboard.widgets = normaliseLayout(widgets)
  if (tiling !== undefined) this.dashboard.tiling = tiling === 'masonry' ? 'masonry' : 'rows'
  if (activeLayoutId !== undefined) this.dashboard.activeLayoutId = String(activeLayoutId || '')
  return this.persistDashboard({
    customised: customised === undefined ? !isDefaultLayout(this.dashboard.widgets) : customised
  })
}

export function setDashboardEditing (editing) {
  this.dashboard.editing = Boolean(editing)
}

export function setDashboardTiling (tiling) {
  this.dashboard.tiling = tiling === 'masonry' ? 'masonry' : 'rows'
  return this.persistDashboard({ customised: this.dashboard.customised })
}

/** Replace the layout with a preset (`LOGGED_IN_STARTER_LAYOUT` etc). */
export function applyDashboardPreset (preset) {
  this.dashboard.widgets = buildDashboardFromPreset(preset)
  this.dashboard.activeLayoutId = ''
  return this.persistDashboard({ customised: true })
}

export function resetDashboard () {
  this.dashboard.widgets = defaultDashboard()
  this.dashboard.tiling = 'rows'
  this.dashboard.activeLayoutId = ''
  return this.persistDashboard({ customised: false })
}

/* --- named layout library ------------------------------------------------ */

/**
 * Save widgets under a label. Passing `id` updates that snapshot in place;
 * otherwise a new one is created. The active id is left alone: the caller
 * commits it with `applyDashboardWidgets()` when the draft is saved.
 */
export function saveDashboardLayout (label, { widgets = this.dashboard.widgets, tiling = this.dashboard.tiling, id = '' } = {}) {
  const layoutId = id || createWidgetId('layout')
  this.dashboard.layouts = saveNamedLayout(this.dashboard.layouts, {
    id: layoutId,
    label,
    widgets,
    tiling
  })
  this.persistDashboard({ customised: this.dashboard.customised })
  return layoutId
}

/** Refresh an existing snapshot from the current (or supplied) widgets. */
export function updateDashboardLayout (id, { widgets, tiling } = {}) {
  const current = findSavedLayout(this.dashboard.layouts, id)
  if (!current) return false
  return this.saveDashboardLayout(current.label, {
    id,
    widgets: widgets === undefined ? this.dashboard.widgets : widgets,
    tiling: tiling === undefined ? this.dashboard.tiling : tiling
  })
}

export function renameDashboardLayout (id, label) {
  this.dashboard.layouts = renameSavedLayout(this.dashboard.layouts, id, label)
  return this.persistDashboard({ customised: this.dashboard.customised })
}

export function deleteDashboardLayout (id) {
  this.dashboard.layouts = removeSavedLayout(this.dashboard.layouts, id)
  if (this.dashboard.activeLayoutId === id) this.dashboard.activeLayoutId = ''
  return this.persistDashboard({ customised: this.dashboard.customised })
}

/** Snapshot record for a named layout, or null. */
export function dashboardLayoutById (id) {
  return findSavedLayout(this.dashboard.layouts, id)
}

export function refreshSetupPrompt (username) {
  this.dashboard.setupPromptVisible = shouldShowSetupPrompt(username)
}

export function dismissDashboardSetupPrompt (username) {
  dismissStoredPrompt(username)
  this.dashboard.setupPromptVisible = false
  this.dashboard.setupPromptDismissed = true
}

/** Storage key of the active scope, exposed for diagnostics/tests. */
export function dashboardStorageKeyForScope (scope = this.dashboard.scope) {
  return dashboardStorageKey(scope)
}

/** Metadata for a widget type, with sane fallbacks for unknown types. */
export function widgetMetaFor (type) {
  return widgetMeta(type) || { label: type, component: '', defaultWidth: 'full', defaultSettings: {} }
}

export function widgetDefaultSettings (type) {
  return defaultSettingsFor(type)
}

export { createWidgetId, GUEST_SCOPE }

export default dashboardState
