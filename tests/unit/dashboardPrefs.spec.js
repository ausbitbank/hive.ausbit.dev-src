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
  normaliseSavedLayouts,
  readDashboard,
  removeSavedLayout,
  renameSavedLayout,
  resolveDashboard,
  saveDashboard,
  saveNamedLayout,
  setupPromptKey,
  shouldShowSetupPrompt
} from '../../src/services/dashboardPrefs'
import { buildLayout, normaliseWidget, widgetMeta } from '../../src/services/dashboardLayout'

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

  it('migrates the old account-posts widget into the content browser', () => {
    const widget = normaliseWidget({
      type: 'accountPosts',
      width: 'full',
      settings: { account: 'alice', sort: 'feed', limit: 4 }
    })
    expect(widget.type).toBe('posts')
    expect(widget.settings.account).toBe('alice')
    expect(widget.settings.feedSort).toBe('feed')
    expect(widget.settings.limit).toBe(4)
  })

  it('round-trips a saved account layout', () => {
    const layout = layoutOf('wallet', 'myWitness')
    expect(saveDashboard('@alice', layout, { storage }).ok).toBe(true)
    const resolved = resolveDashboard('alice', storage)
    expect(resolved.source).toBe('account')
    expect(resolved.widgets.map(widget => widget.type)).toEqual(['wallet', 'myWitness'])
  })

  it('persists the chosen tiling mode', () => {
    const layout = layoutOf('wallet')
    saveDashboard('alice', layout, { storage, tiling: 'masonry' })
    expect(resolveDashboard('alice', storage).tiling).toBe('masonry')

    saveDashboard('alice', layout, { storage, tiling: 'rows' })
    expect(resolveDashboard('alice', storage).tiling).toBe('rows')
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

describe('named layouts', () => {
  let storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('round-trips named layouts and the active id', () => {
    const widgets = layoutOf('wallet', 'posts')
    const layouts = saveNamedLayout([], { label: 'Focus', widgets, tiling: 'masonry', now: 10 })
    expect(layouts).toHaveLength(1)
    expect(layouts[0]).toMatchObject({ label: 'Focus', tiling: 'masonry', savedAt: 10 })

    saveDashboard('alice', widgets, {
      storage,
      layouts,
      activeLayoutId: layouts[0].id
    })
    const resolved = resolveDashboard('alice', storage)
    expect(resolved.layouts).toHaveLength(1)
    expect(resolved.layouts[0].label).toBe('Focus')
    expect(resolved.layouts[0].widgets.map(widget => widget.type)).toEqual(['wallet', 'posts'])
    expect(resolved.activeLayoutId).toBe(layouts[0].id)
  })

  it('updates, renames and deletes a snapshot without touching the others', () => {
    const first = saveNamedLayout([], { label: 'One', widgets: layoutOf('wallet') })
    const second = saveNamedLayout(first, { label: 'Two', widgets: layoutOf('posts') })
    expect(second.map(entry => entry.label)).toEqual(['One', 'Two'])

    const updated = saveNamedLayout(second, {
      id: first[0].id,
      label: 'One updated',
      widgets: layoutOf('network'),
      tiling: 'rows'
    })
    expect(updated).toHaveLength(2)
    expect(updated.find(entry => entry.id === first[0].id).widgets[0].type).toBe('network')

    const renamed = renameSavedLayout(updated, second[1].id, 'Second')
    expect(renamed.find(entry => entry.id === second[1].id).label).toBe('Second')
    expect(removeSavedLayout(renamed, first[0].id).map(entry => entry.label)).toEqual(['Second'])
  })

  it('keeps existing named layouts when only the current dashboard is saved', () => {
    const layouts = saveNamedLayout([], { label: 'Keep', widgets: layoutOf('wallet') })
    saveDashboard('alice', layoutOf('wallet'), { storage, layouts, activeLayoutId: layouts[0].id })
    saveDashboard('alice', layoutOf('posts'), { storage })

    const resolved = resolveDashboard('alice', storage)
    expect(resolved.widgets[0].type).toBe('posts')
    expect(resolved.layouts.map(entry => entry.label)).toEqual(['Keep'])
    expect(resolved.activeLayoutId).toBe(layouts[0].id)
  })

  it('drops corrupt snapshots and an active id that is no longer present', () => {
    storage.setItem(dashboardStorageKey('alice'), JSON.stringify({
      widgets: [{ type: 'wallet' }],
      layouts: [
        { label: 'Broken', widgets: [] },
        { label: 'Good', widgets: [{ type: 'posts' }] }
      ],
      activeLayoutId: 'missing'
    }))
    const doc = readDashboard('alice', storage)
    expect(doc.layouts.map(entry => entry.label)).toEqual(['Good'])
    expect(doc.activeLayoutId).toBe('')
    expect(normaliseSavedLayouts(null)).toEqual([])
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
