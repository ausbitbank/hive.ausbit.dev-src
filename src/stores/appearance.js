// Viewer appearance preferences (site theme, profile skins, motion, contrast).
//
// This store is intentionally separate from `hive.user.settings`: appearance is
// a device preference that works signed out and must not be overwritten when the
// settings dialog saves voting or node settings.

import { defineStore } from 'pinia'
import { getTheme, DEFAULT_THEME_ID } from 'src/themes/registry'
import { quasarVarsFor, themeModeOf, tokensFor } from 'src/themes/tokens'

export const APPEARANCE_STORAGE_KEY = 'ausbit:appearance'
export const APPEARANCE_BOOT_KEY = 'ausbit:appearance:boot'
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

export const DEFAULT_APPEARANCE = {
  themeId: DEFAULT_THEME_ID,
  followSystem: false,
  profileSkins: 'on',
  motion: 'system',
  highContrast: false,
  ignoredSkinAuthors: []
}

function normalizeAuthor (value) {
  return String(value || '').trim().toLowerCase().slice(0, 16)
}

function normalizeIgnoredAuthors (value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(normalizeAuthor).filter(Boolean))].slice(0, 200)
}

let quasarRef = null
let systemMedia = null
let systemListener = null

function storage () {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode or blocked storage.
  }
  return null
}

function readStored () {
  const store = storage()
  if (!store) return { ...DEFAULT_APPEARANCE }
  try {
    const parsed = JSON.parse(store.getItem(APPEARANCE_STORAGE_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_APPEARANCE }
    return {
      themeId: typeof parsed.themeId === 'string' ? parsed.themeId : DEFAULT_THEME_ID,
      followSystem: parsed.followSystem === true,
      profileSkins: ['on', 'profile', 'off'].includes(parsed.profileSkins) ? parsed.profileSkins : 'on',
      motion: ['system', 'reduced', 'full'].includes(parsed.motion) ? parsed.motion : 'system',
      highContrast: parsed.highContrast === true,
      ignoredSkinAuthors: normalizeIgnoredAuthors(parsed.ignoredSkinAuthors)
    }
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

function persist (state) {
  const store = storage()
  if (!store) return
  try {
    store.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({
      themeId: state.themeId,
      followSystem: state.followSystem,
      profileSkins: state.profileSkins,
      motion: state.motion,
      highContrast: state.highContrast,
      ignoredSkinAuthors: normalizeIgnoredAuthors(state.ignoredSkinAuthors)
    }))
  } catch {
    // Quota or private mode. The in-memory state still works.
  }
}

function writeBootCache (theme) {
  const store = storage()
  if (!store) return
  try {
    store.setItem(APPEARANCE_BOOT_KEY, JSON.stringify({
      id: theme.id,
      mode: theme.mode,
      bg: theme.tokens.bg,
      text: theme.tokens.text,
      primary: theme.tokens.primary
    }))
  } catch {
    // Ignore.
  }
}

function setDocumentVar (name, value) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(name, value)
}

function setMetaThemeColor (color) {
  if (typeof document === 'undefined') return
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}

function systemPrefersDark () {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(SYSTEM_DARK_QUERY).matches
}

export function applyThemeToDocument (theme, { highContrast = false, motion = 'system', q = null } = {}) {
  const quasar = q || quasarRef
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const tokens = tokensFor(theme, { highContrast })
  const quasarVars = quasarVarsFor(theme)
  if (highContrast) {
    quasarVars['--q-primary'] = tokens['--c-primary']
    quasarVars['--q-secondary'] = tokens['--c-secondary']
    quasarVars['--q-positive'] = tokens['--c-positive']
    quasarVars['--q-negative'] = tokens['--c-negative']
    quasarVars['--q-warning'] = tokens['--c-warning']
    quasarVars['--q-info'] = tokens['--c-info']
    quasarVars['--q-dark'] = tokens['--c-surface']
    quasarVars['--q-dark-page'] = tokens['--c-bg']
  }
  for (const [name, value] of Object.entries(tokens)) setDocumentVar(name, value)
  for (const [name, value] of Object.entries(quasarVars)) setDocumentVar(name, value)

  const mode = themeModeOf(theme)
  root.dataset.theme = theme.id
  root.dataset.mode = mode
  root.dataset.texture = theme.effects?.texture || 'none'
  root.dataset.motion = motion === 'reduced' ? 'reduced' : 'full'
  root.dataset.contrast = highContrast ? 'high' : 'normal'
  root.style.colorScheme = mode

  if (quasar) quasar.dark.set(mode === 'dark')
  setMetaThemeColor(theme.tokens.bg)
  writeBootCache(theme)
}

export const useAppearanceStore = defineStore('appearance', {
  state: () => ({
    ...DEFAULT_APPEARANCE,
    hydrated: false,
    systemDark: systemPrefersDark()
  }),
  getters: {
    effectiveThemeId (state) {
      if (state.followSystem) return state.systemDark ? 'hive-dark' : 'hive-light'
      return state.themeId
    },
    theme () {
      return getTheme(this.effectiveThemeId)
    },
    isDark () {
      return this.theme.mode === 'dark'
    },
    effectiveMotion (state) {
      if (state.motion === 'reduced') return 'reduced'
      if (state.motion === 'full') return 'full'
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
      }
      return 'full'
    },
    skinsEnabled (state) {
      return state.profileSkins !== 'off'
    }
  },
  actions: {
    attachQuasar (q) {
      quasarRef = q || null
    },
    hydrate (q) {
      if (q) this.attachQuasar(q)
      const stored = readStored()
      Object.assign(this, stored)
      this.themeId = getTheme(this.themeId).id
      this.systemDark = systemPrefersDark()
      this.hydrated = true
      this.setupSystemListener()
      this.apply()
    },
    setupSystemListener () {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
      if (systemListener) return
      systemMedia = window.matchMedia(SYSTEM_DARK_QUERY)
      systemListener = event => {
        this.systemDark = event.matches
        if (this.followSystem) this.apply()
      }
      if (typeof systemMedia.addEventListener === 'function') {
        systemMedia.addEventListener('change', systemListener)
      } else if (typeof systemMedia.addListener === 'function') {
        systemMedia.addListener(systemListener)
      }
    },
    apply (q = null) {
      if (q) this.attachQuasar(q)
      applyThemeToDocument(this.theme, {
        highContrast: this.highContrast,
        motion: this.effectiveMotion,
        q: q || quasarRef
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hive:theme-change', {
          detail: { theme: this.theme, isDark: this.isDark, motion: this.effectiveMotion }
        }))
      }
    },
    commit () {
      persist(this)
      this.apply()
    },
    setTheme (id) {
      this.themeId = getTheme(id).id
      this.followSystem = false
      this.commit()
    },
    setFollowSystem (value) {
      this.followSystem = Boolean(value)
      this.commit()
    },
    setProfileSkins (value) {
      this.profileSkins = ['on', 'profile', 'off'].includes(value) ? value : 'on'
      this.commit()
    },
    setMotion (value) {
      this.motion = ['system', 'reduced', 'full'].includes(value) ? value : 'system'
      this.commit()
    },
    setHighContrast (value) {
      this.highContrast = Boolean(value)
      this.commit()
    },
    ignoreSkinAuthor (author) {
      const name = normalizeAuthor(author)
      if (!name) return
      if (!this.ignoredSkinAuthors.includes(name)) {
        this.ignoredSkinAuthors = [...this.ignoredSkinAuthors, name]
      }
      this.commit()
    },
    unignoreSkinAuthor (author) {
      const name = normalizeAuthor(author)
      this.ignoredSkinAuthors = this.ignoredSkinAuthors.filter(item => item !== name)
      this.commit()
    },
    reset () {
      Object.assign(this, DEFAULT_APPEARANCE)
      this.commit()
    }
  }
})
