// Per-account persistence for the customisable home dashboard.
//
// Layouts live in their own localStorage entries, one per account, so two
// users signed in on the same browser never overwrite each other and a guest
// layout stays separate from every account:
//
//   hive:dashboard:v1:default   -> guest layout
//   hive:dashboard:v1:@alice    -> alice's layout
//   hive:dashboard:v1:@bob      -> bob's layout
//
// The resolved layout falls back account -> guest -> built-in default, and a
// failed read/write (private mode, quota, corrupt JSON) degrades to the default
// layout instead of breaking the page. Pure and storage-injected so it can be
// unit tested like `homeMarket.js`.

import {
  DEFAULT_LAYOUT,
  buildLayout,
  createWidgetId,
  isDefaultLayout,
  isLegacyDefaultLayout,
  normaliseLayout
} from './dashboardLayout'

export const DASHBOARD_STORAGE_PREFIX = 'hive:dashboard:v1:'
export const DASHBOARD_SCHEMA_VERSION = 1
export const GUEST_SCOPE = 'default'
export const LEGACY_MARKET_PREFS_KEY = 'homeMarketPrefs'
export const MAX_SAVED_LAYOUTS = 20
export const MAX_LAYOUT_LABEL_LENGTH = 40

/** Key of the per-account "you can make this yours" prompt flag. */
export function setupPromptKey (scope) {
  return DASHBOARD_STORAGE_PREFIX + 'setupPromptDismissed:' + normaliseScope(scope)
}

/** Normalise an account name or guest scope into a storage-safe suffix. */
export function normaliseScope (scope) {
  const value = String(scope || '').trim().toLowerCase().replace(/^@/, '')
  return value || GUEST_SCOPE
}

export function dashboardStorageKey (scope) {
  return DASHBOARD_STORAGE_PREFIX + normaliseScope(scope)
}

function getStorage (storage) {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or a blocked storage implementation.
  }
  return null
}

function readJson (target, key) {
  if (!target) return null
  try {
    const raw = target.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson (target, key, value) {
  if (!target) return false
  try {
    target.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Trim and bound a user-entered layout name. */
export function normaliseLayoutLabel (label, fallback = 'Layout') {
  const text = String(label ?? '').replace(/\s+/g, ' ').trim()
  return (text || fallback).slice(0, MAX_LAYOUT_LABEL_LENGTH)
}

/**
 * Normalise named layouts stored beside the active dashboard. Entries with no
 * usable widgets are dropped; ids are made unique so the UI can address every
 * row. This is deliberately tolerant of older/hand-edited documents.
 */
export function normaliseSavedLayouts (raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const result = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const widgets = normaliseLayout(entry.widgets)
    if (!widgets.length) continue
    let id = typeof entry.id === 'string' && entry.id ? entry.id : createWidgetId('layout')
    if (seen.has(id)) id = createWidgetId('layout')
    seen.add(id)
    result.push({
      id,
      label: normaliseLayoutLabel(entry.label, 'Layout ' + (result.length + 1)),
      widgets,
      tiling: entry.tiling === 'masonry' ? 'masonry' : 'rows',
      savedAt: Number.isFinite(Number(entry.savedAt)) ? Number(entry.savedAt) : null
    })
    if (result.length >= MAX_SAVED_LAYOUTS) break
  }
  return result
}

export function findSavedLayout (layouts, id) {
  return (Array.isArray(layouts) ? layouts : []).find(entry => entry.id === id) || null
}

/**
 * Add a named snapshot, or replace an existing one when `id` matches. Returns
 * a new list; the caller persists it with the dashboard.
 */
export function saveNamedLayout (layouts, { id = '', label = '', widgets = [], tiling = 'rows', now = Date.now() } = {}) {
  const list = normaliseSavedLayouts(layouts)
  const entry = {
    id: id || createWidgetId('layout'),
    label: normaliseLayoutLabel(label, 'Layout ' + (list.length + 1)),
    widgets: normaliseLayout(widgets),
    tiling: tiling === 'masonry' ? 'masonry' : 'rows',
    savedAt: now
  }
  if (!entry.widgets.length) return list
  const index = list.findIndex(item => item.id === entry.id)
  if (index !== -1) {
    const next = list.slice()
    next[index] = entry
    return next
  }
  return list.concat([entry]).slice(-MAX_SAVED_LAYOUTS)
}

export function renameSavedLayout (layouts, id, label) {
  const list = normaliseSavedLayouts(layouts)
  return list.map(entry => (
    entry.id === id ? { ...entry, label: normaliseLayoutLabel(label, entry.label) } : entry
  ))
}

export function removeSavedLayout (layouts, id) {
  return (Array.isArray(layouts) ? layouts : []).filter(entry => entry.id !== id)
}

export function defaultDashboard () {
  return buildLayout(DEFAULT_LAYOUT)
}

/** True when a stored document exists for this scope (customised or not). */
export function hasSavedDashboard (scope, storage) {
  const target = getStorage(storage)
  return Boolean(readJson(target, dashboardStorageKey(scope)))
}

/**
 * Read one scope's dashboard. Returns `{ widgets, savedAt, customised, corrupt }`.
 * A missing entry is not an error — it just means "use the next fallback".
 */
export function readDashboard (scope, storage) {
  const target = getStorage(storage)
  const key = dashboardStorageKey(scope)
  const raw = readJson(target, key)
  if (!raw) return null
  if (!raw || !Array.isArray(raw.widgets)) {
    return { widgets: null, savedAt: null, customised: false, corrupt: true, scope: normaliseScope(scope) }
  }
  const widgets = normaliseLayout(raw.widgets)
  const layouts = normaliseSavedLayouts(raw.layouts)
  const activeLayoutId = layouts.some(entry => entry.id === raw.activeLayoutId)
    ? raw.activeLayoutId
    : ''
  return {
    widgets,
    savedAt: Number.isFinite(Number(raw.savedAt)) ? Number(raw.savedAt) : null,
    version: Number(raw.version) || 0,
    customised: raw.customised !== false,
    tiling: raw.tiling === 'masonry' ? 'masonry' : 'rows',
    layouts,
    activeLayoutId,
    corrupt: false,
    scope: normaliseScope(scope)
  }
}

/** The current built-in default, carrying over a stored layout library. */
function builtinDashboard (scope, stored = null) {
  return {
    widgets: defaultDashboard(),
    source: 'builtin',
    scope,
    savedAt: stored?.savedAt ?? null,
    customised: false,
    tiling: 'rows',
    // Named layouts are independent of the active widgets; keep them even when
    // the stored layout itself was never customised.
    layouts: stored?.layouts || [],
    activeLayoutId: ''
  }
}

/**
 * Resolve the layout to render for `username`:
 *   account document -> guest document -> built-in default.
 * A stored document that was never customised resolves to the current
 * built-in default, so changing the default also reaches users who never
 * arranged their own dashboard (including anyone who pressed "Reset to
 * default" before the change).
 *
 * `source` says where the layout came from so the page can show the right
 * empty state or "customise" affordances.
 */
export function resolveDashboard (username, storage) {
  const account = username ? normaliseScope(username) : ''
  if (account && account !== GUEST_SCOPE) {
    const own = readDashboard(account, storage)
    if (own && !own.corrupt && own.widgets.length) {
      // Only an untouched default (current or an older release) follows the new
      // default; a settings-only customisation stored with a stale flag stays.
      if (!own.customised && (isDefaultLayout(own.widgets) || isLegacyDefaultLayout(own.widgets))) {
        return builtinDashboard(account, own)
      }
      return {
        widgets: own.widgets,
        source: 'account',
        scope: account,
        savedAt: own.savedAt,
        customised: true,
        tiling: own.tiling,
        layouts: own.layouts,
        activeLayoutId: own.activeLayoutId
      }
    }
  }
  const guest = readDashboard(GUEST_SCOPE, storage)
  if (guest && !guest.corrupt && guest.widgets.length) {
    if (!guest.customised && (isDefaultLayout(guest.widgets) || isLegacyDefaultLayout(guest.widgets))) {
      return builtinDashboard(GUEST_SCOPE, guest)
    }
    return {
      widgets: guest.widgets,
      source: 'guest',
      scope: GUEST_SCOPE,
      savedAt: guest.savedAt,
      customised: true,
      tiling: guest.tiling,
      layouts: guest.layouts,
      activeLayoutId: guest.activeLayoutId
    }
  }
  return builtinDashboard(account && account !== GUEST_SCOPE ? account : GUEST_SCOPE)
}

/**
 * Persist a layout for one scope. Saving the account scope never touches the
 * guest scope, and vice versa. Returns `{ ok, savedAt }`.
 */
export function saveDashboard (scope, widgets, { storage, now = Date.now(), customised = true, tiling = 'rows', layouts, activeLayoutId } = {}) {
  const target = getStorage(storage)
  const list = normaliseLayout(widgets)
  if (!target) return { ok: false, savedAt: null }
  // Callers that only update the current layout keep the named-layout library
  // that is already stored next to it.
  const previous = layouts === undefined || activeLayoutId === undefined
    ? readDashboard(scope, target)
    : null
  const savedLayouts = layouts === undefined ? (previous?.layouts || []) : normaliseSavedLayouts(layouts)
  const active = activeLayoutId === undefined ? (previous?.activeLayoutId || '') : String(activeLayoutId || '')
  const payload = {
    version: DASHBOARD_SCHEMA_VERSION,
    scope: normaliseScope(scope),
    savedAt: now,
    customised: Boolean(customised),
    tiling: tiling === 'masonry' ? 'masonry' : 'rows',
    widgets: list,
    layouts: savedLayouts,
    activeLayoutId: savedLayouts.some(entry => entry.id === active) ? active : ''
  }
  const key = dashboardStorageKey(scope)
  if (!writeJson(target, key, payload)) return { ok: false, savedAt: null }
  return { ok: true, savedAt: now }
}

export function clearDashboard (scope, storage) {
  const target = getStorage(storage)
  if (!target) return false
  try {
    target.removeItem(dashboardStorageKey(scope))
    return true
  } catch {
    return false
  }
}

/** True when this scope's stored layout is the untouched default. */
export function isUntouched (scope, storage) {
  const doc = readDashboard(scope, storage)
  if (!doc || doc.corrupt) return true
  return isDefaultLayout(doc.widgets)
}

export function shouldShowSetupPrompt (username, storage) {
  const account = normaliseScope(username)
  if (!account || account === GUEST_SCOPE) return false
  const target = getStorage(storage)
  if (!target) return false
  try {
    return !target.getItem(setupPromptKey(account))
  } catch {
    return false
  }
}

export function dismissSetupPrompt (username, storage) {
  const target = getStorage(storage)
  if (!target) return false
  try {
    target.setItem(setupPromptKey(username), String(Date.now()))
    return true
  } catch {
    return false
  }
}

/** Build a fresh dashboard from a preset (default or logged-in starter). */
export function buildDashboardFromPreset (preset, options = {}) {
  return buildLayout(preset, options)
}

/**
 * One-time import of the pre-dashboard coin widget preferences into a coin
 * widget's settings. Returns the settings to merge, or null when there is
 * nothing to import. Never deletes the legacy key.
 */
export function legacyMarketSettings (storage) {
  const target = getStorage(storage)
  const raw = readJson(target, LEGACY_MARKET_PREFS_KEY)
  if (!raw || !Array.isArray(raw.coinIds) || !raw.coinIds.length) return null
  const settings = { coinIds: raw.coinIds }
  if (typeof raw.currency === 'string' && raw.currency) settings.currency = raw.currency
  return settings
}
