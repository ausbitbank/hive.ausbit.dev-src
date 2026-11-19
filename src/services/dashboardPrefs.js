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
  isDefaultLayout,
  normaliseLayout
} from './dashboardLayout'

export const DASHBOARD_STORAGE_PREFIX = 'hive:dashboard:v1:'
export const DASHBOARD_SCHEMA_VERSION = 1
export const GUEST_SCOPE = 'default'
export const LEGACY_MARKET_PREFS_KEY = 'homeMarketPrefs'

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
  return {
    widgets,
    savedAt: Number.isFinite(Number(raw.savedAt)) ? Number(raw.savedAt) : null,
    version: Number(raw.version) || 0,
    customised: raw.customised !== false,
    corrupt: false,
    scope: normaliseScope(scope)
  }
}

/**
 * Resolve the layout to render for `username`:
 *   account document -> guest document -> built-in default.
 * `source` says where the layout came from so the page can show the right
 * empty state or "customise" affordances.
 */
export function resolveDashboard (username, storage) {
  const account = username ? normaliseScope(username) : ''
  if (account && account !== GUEST_SCOPE) {
    const own = readDashboard(account, storage)
    if (own && !own.corrupt && own.widgets.length) {
      return { widgets: own.widgets, source: 'account', scope: account, savedAt: own.savedAt, customised: own.customised }
    }
  }
  const guest = readDashboard(GUEST_SCOPE, storage)
  if (guest && !guest.corrupt && guest.widgets.length) {
    return { widgets: guest.widgets, source: 'guest', scope: GUEST_SCOPE, savedAt: guest.savedAt, customised: guest.customised }
  }
  return {
    widgets: defaultDashboard(),
    source: 'builtin',
    scope: account && account !== GUEST_SCOPE ? account : GUEST_SCOPE,
    savedAt: null,
    customised: false
  }
}

/**
 * Persist a layout for one scope. Saving the account scope never touches the
 * guest scope, and vice versa. Returns `{ ok, savedAt }`.
 */
export function saveDashboard (scope, widgets, { storage, now = Date.now(), customised = true } = {}) {
  const target = getStorage(storage)
  const list = normaliseLayout(widgets)
  if (!target) return { ok: false, savedAt: null }
  const payload = {
    version: DASHBOARD_SCHEMA_VERSION,
    scope: normaliseScope(scope),
    savedAt: now,
    customised: Boolean(customised),
    widgets: list
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
