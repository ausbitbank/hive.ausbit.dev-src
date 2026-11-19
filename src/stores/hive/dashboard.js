import {
  GUEST_SCOPE,
  buildDashboardFromPreset,
  dashboardStorageKey,
  defaultDashboard,
  dismissSetupPrompt as dismissStoredPrompt,
  resolveDashboard,
  saveDashboard as saveStoredDashboard,
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
      // Editor state lives in the store so widgets and the toolbar agree.
      editing: false,
      // Set when localStorage refused a write; the layout still works in memory.
      storageFailed: false,
      setupPromptVisible: false,
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
  this.dashboard.storageFailed = false
  this.dashboard.setupPromptDismissed = false
  this.refreshSetupPrompt(username)
}

/** Persist the current widgets to the active scope. */
export function persistDashboard ({ customised = true } = {}) {
  const result = saveStoredDashboard(this.dashboard.scope, this.dashboard.widgets, {
    storage: getStorage(),
    customised
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
export function applyDashboardWidgets (widgets, { customised } = {}) {
  this.dashboard.widgets = normaliseLayout(widgets)
  return this.persistDashboard({
    customised: customised === undefined ? !isDefaultLayout(this.dashboard.widgets) : customised
  })
}

export function setDashboardEditing (editing) {
  this.dashboard.editing = Boolean(editing)
}

/** Replace the layout with a preset (`LOGGED_IN_STARTER_LAYOUT` etc). */
export function applyDashboardPreset (preset) {
  this.dashboard.widgets = buildDashboardFromPreset(preset)
  return this.persistDashboard({ customised: true })
}

export function resetDashboard () {
  this.dashboard.widgets = defaultDashboard()
  return this.persistDashboard({ customised: false })
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
