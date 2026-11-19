import { beforeEach, describe, expect, it } from 'vitest'
import {
  DASHBOARD_STORAGE_PREFIX,
  GUEST_SCOPE,
  LEGACY_MARKET_PREFS_KEY,
  buildDashboardFromPreset,
  clearDashboard,
  dashboardStorageKey,
  defaultDashboard,
  dismissSetupPrompt,
  hasSavedDashboard,
  isUntouched,
  legacyMarketSettings,
  normaliseScope,
  readDashboard,
  resolveDashboard,
  saveDashboard,
  setupPromptKey,
  shouldShowSetupPrompt
} from '../../src/services/dashboardPrefs'
import { buildLayout, widgetMeta } from '../../src/services/dashboardLayout'

function memoryStorage (initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: key => { data.delete(key) },
    keys: () => [...data.keys()]
  }
}

function layoutOf (...types) {
  return buildDashboardFromPreset(types.map(type => ({ type, width: widgetMeta(type).defaultWidth, settings: {} })))
}

describe('dashboard scopes', () => {
  it('normalises account names and the guest scope', () => {
    expect(normaliseScope('@Alice')).toBe('alice')
    expect(normaliseScope(' alice ')).toBe('alice')
    expect(normaliseScope('')).toBe(GUEST_SCOPE)
    expect(normaliseScope(null)).toBe(GUEST_SCOPE)
  })

  it('keys storage per scope with one prefix', () => {
    expect(dashboardStorageKey('alice')).toBe(DASHBOARD_STORAGE_PREFIX + 'alice')
    expect(dashboardStorageKey('')).toBe(DASHBOARD_STORAGE_PREFIX + GUEST_SCOPE)
    expect(setupPromptKey('@alice')).toBe(DASHBOARD_STORAGE_PREFIX + 'setupPromptDismissed:alice')
  })
})

describe('saving and reading dashboards', () => {
  let storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('returns the built-in default when nothing is stored', () => {
    const resolved = resolveDashboard(null, storage)
    expect(resolved.source).toBe('builtin')
    expect(resolved.widgets.map(widget => widget.type)).toEqual(
      defaultDashboard().map(widget => widget.type)
    )
  })

  it('round-trips a saved account layout', () => {
    const layout = layoutOf('wallet', 'myWitness')
    expect(saveDashboard('@alice', layout, { storage }).ok).toBe(true)
    const resolved = resolveDashboard('alice', storage)
    expect(resolved.source).toBe('account')
    expect(resolved.widgets.map(widget => widget.type)).toEqual(['wallet', 'myWitness'])
  })

  it('keeps accounts and the guest layout isolated from each other', () => {
    saveDashboard('alice', layoutOf('wallet'), { storage })
    saveDashboard('bob', layoutOf('posts', 'network'), { storage })
    saveDashboard(GUEST_SCOPE, layoutOf('block'), { storage })

    expect(resolveDashboard('alice', storage).widgets.map(widget => widget.type)).toEqual(['wallet'])
    expect(resolveDashboard('bob', storage).widgets.map(widget => widget.type)).toEqual(['posts', 'network'])
    expect(resolveDashboard(null, storage).widgets.map(widget => widget.type)).toEqual(['block'])
  })

  it('falls back to the guest layout for an account with no saved dashboard', () => {
    saveDashboard(GUEST_SCOPE, layoutOf('market'), { storage })
    const resolved = resolveDashboard('carol', storage)
    expect(resolved.source).toBe('guest')
    expect(resolved.widgets.map(widget => widget.type)).toEqual(['market'])
  })

  it('does not leak an account layout into the guest layout', () => {
    saveDashboard('alice', layoutOf('wallet'), { storage })
    expect(resolveDashboard(null, storage).source).toBe('builtin')
  })

  it('treats corrupt JSON as absent instead of throwing', () => {
    storage.setItem(dashboardStorageKey('alice'), '{not json')
    expect(readDashboard('alice', storage)).toBeNull()
    expect(resolveDashboard('alice', storage).source).toBe('builtin')
  })

  it('treats a document without widgets as corrupt and falls back', () => {
    storage.setItem(dashboardStorageKey('alice'), JSON.stringify({ savedAt: 1 }))
    const doc = readDashboard('alice', storage)
    expect(doc.corrupt).toBe(true)
    expect(resolveDashboard('alice', storage).source).toBe('builtin')
  })

  it('normalises unknown widgets out of stored documents', () => {
    storage.setItem(dashboardStorageKey('alice'), JSON.stringify({
      version: 1,
      widgets: [{ type: 'wallet' }, { type: 'gone' }]
    }))
    const doc = readDashboard('alice', storage)
    expect(doc.widgets.map(widget => widget.type)).toEqual(['wallet'])
  })

  it('reports whether a scope has a saved dashboard', () => {
    expect(hasSavedDashboard('alice', storage)).toBe(false)
    saveDashboard('alice', layoutOf('wallet'), { storage })
    expect(hasSavedDashboard('alice', storage)).toBe(true)
  })

  it('clears one scope without touching the others', () => {
    saveDashboard('alice', layoutOf('wallet'), { storage })
    saveDashboard('bob', layoutOf('posts'), { storage })
    expect(clearDashboard('alice', storage)).toBe(true)
    expect(hasSavedDashboard('alice', storage)).toBe(false)
    expect(hasSavedDashboard('bob', storage)).toBe(true)
  })

  it('ignores storage failures', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('blocked') }
    }
    expect(saveDashboard('alice', layoutOf('wallet'), { storage: broken })).toEqual({ ok: false, savedAt: null })
    expect(resolveDashboard('alice', broken).source).toBe('builtin')
    expect(clearDashboard('alice', broken)).toBe(false)
    expect(shouldShowSetupPrompt('alice', broken)).toBe(false)
    expect(dismissSetupPrompt('alice', broken)).toBe(false)
  })
})

describe('default detection', () => {
  it('knows an untouched layout', () => {
    const storage = memoryStorage()
    saveDashboard('alice', defaultDashboard(), { storage, customised: false })
    expect(isUntouched('alice', storage)).toBe(true)
    saveDashboard('alice', buildLayout([{ type: 'wallet' }]), { storage })
    expect(isUntouched('alice', storage)).toBe(false)
  })
})

describe('first-login setup prompt', () => {
  let storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('only prompts signed-in accounts, once', () => {
    expect(shouldShowSetupPrompt(null, storage)).toBe(false)
    expect(shouldShowSetupPrompt('alice', storage)).toBe(true)
    expect(dismissSetupPrompt('alice', storage)).toBe(true)
    expect(shouldShowSetupPrompt('alice', storage)).toBe(false)
    expect(shouldShowSetupPrompt('bob', storage)).toBe(true)
  })
})

describe('legacy coin preferences', () => {
  let storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('imports the old coin widget preferences', () => {
    storage.setItem(LEGACY_MARKET_PREFS_KEY, JSON.stringify({ coinIds: ['hive', 'bitcoin'], currency: 'aud' }))
    expect(legacyMarketSettings(storage)).toEqual({ coinIds: ['hive', 'bitcoin'], currency: 'aud' })
  })

  it('returns null when there is nothing worth importing', () => {
    expect(legacyMarketSettings(storage)).toBeNull()
    storage.setItem(LEGACY_MARKET_PREFS_KEY, '[]')
    expect(legacyMarketSettings(storage)).toBeNull()
    storage.setItem(LEGACY_MARKET_PREFS_KEY, JSON.stringify({ coinIds: [] }))
    expect(legacyMarketSettings(storage)).toBeNull()
  })

  it('never deletes the legacy key, so an older tab still works', () => {
    storage.setItem(LEGACY_MARKET_PREFS_KEY, JSON.stringify({ coinIds: ['hive'] }))
    legacyMarketSettings(storage)
    expect(storage.getItem(LEGACY_MARKET_PREFS_KEY)).toBeTruthy()
  })
})
