import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getTheme } from '../../src/themes/registry'
import { useAppearanceStore, APPEARANCE_STORAGE_KEY } from '../../src/stores/appearance'

function stored () {
  return JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || '{}')
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('viewer skin controls', () => {
  it('persists calm effects, hidden status and hidden extras', () => {
    const store = useAppearanceStore()
    store.setSkinEffects('calm')
    store.setShowSkinStatus(false)
    store.setShowSkinExtras(false)

    const value = stored()
    expect(value.skinEffects).toBe('calm')
    expect(value.showSkinStatus).toBe(false)
    expect(value.showSkinExtras).toBe(false)
    expect(store.skinCalm).toBe(true)

    setActivePinia(createPinia())
    const restored = useAppearanceStore()
    restored.hydrate()
    expect(restored.skinEffects).toBe('calm')
    expect(restored.showSkinStatus).toBe(false)
    expect(restored.showSkinExtras).toBe(false)
  })

  it('reverses ignore and hide-all preferences', () => {
    const store = useAppearanceStore()
    store.setProfileSkins('off')
    store.ignoreSkinAuthor('alice')
    expect(stored().profileSkins).toBe('off')
    expect(stored().ignoredSkinAuthors).toContain('alice')

    store.setProfileSkins('on')
    store.unignoreSkinAuthor('alice')
    expect(stored().profileSkins).toBe('on')
    expect(stored().ignoredSkinAuthors).toEqual([])
  })
})

describe('adopted palette', () => {
  it('stores a validated palette locally and clears it', () => {
    const store = useAppearanceStore()
    const result = store.adoptCustomTheme(getTheme('neon-tide'), 'alice')
    expect(result.ok).toBe(true)
    expect(store.theme.id).toBe('custom')
    expect(store.customThemeActive).toBe(true)
    expect(stored().customTheme.name).toBe('Neon Tide')
    expect(stored().customTheme.mood).toContain('@alice')

    store.clearCustomTheme()
    expect(store.theme.id).toBe('hive-dark')
    expect(store.customTheme).toBeNull()
  })

  it('rejects an invalid adopted palette', () => {
    const store = useAppearanceStore()
    const broken = { ...getTheme('hive-dark'), tokens: { ...getTheme('hive-dark').tokens, text: '#000000' } }
    const result = store.adoptCustomTheme(broken, 'alice')
    expect(result.ok).toBe(false)
    expect(store.customThemeActive).toBe(false)
  })
})
