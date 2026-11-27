// Built-in reading themes for account blogs.
//
// Blog themes are deliberately editorial rather than a second site builder:
// a warm paper column, a neutral studio, a terminal, a quiet journal and an
// image-first gallery. Each theme carries the opposite mode as a variant so the
// reader's Light/Dark/System choice works without turning the author's design
// into a different site.

import { isHexColor } from './color'

const SCHEMA = 'banksia.io/theme@1'

function manifest (data) {
  return {
    schema: SCHEMA,
    scope: 'site',
    author: 'banksia.io',
    remixedFrom: null,
    shape: { radius: 'soft', border: 'hairline', shadow: 'soft' },
    effects: { texture: 'none', motion: 'none', ambient: 'none' },
    ...data
  }
}

const PAPER_DARK = {
  bg: '#171412',
  surface: '#201b18',
  surfaceAlt: '#2a231f',
  text: '#f2ece2',
  muted: '#b8ada0',
  border: '#3a322b',
  primary: '#e0a06a',
  secondary: '#8fb3a3',
  accent: '#c79ae0',
  positive: '#8fd19e',
  negative: '#f08a8a',
  warning: '#e0b45a',
  info: '#8fc7e0'
}

const STUDIO_LIGHT = {
  bg: '#f6f8fa',
  surface: '#ffffff',
  surfaceAlt: '#eef2f5',
  text: '#1f2328',
  muted: '#59636e',
  border: '#d0d7de',
  primary: '#9a6700',
  secondary: '#0969da',
  accent: '#8250df',
  positive: '#1a7f37',
  negative: '#cf222e',
  warning: '#9a6700',
  info: '#0969da'
}

const TERMINAL_LIGHT = {
  bg: '#f2fbf4',
  surface: '#ffffff',
  surfaceAlt: '#e6f5e9',
  text: '#10281a',
  muted: '#4f6b58',
  border: '#c8dccd',
  primary: '#137a3a',
  secondary: '#0b6f8a',
  accent: '#8a5a00',
  positive: '#137a3a',
  negative: '#a32a2a',
  warning: '#8a5a00',
  info: '#0b6f8a'
}

const JOURNAL_DARK = {
  bg: '#181512',
  surface: '#221d18',
  surfaceAlt: '#2b241e',
  text: '#f3ede2',
  muted: '#b9ad9b',
  border: '#3d342b',
  primary: '#d9a36d',
  secondary: '#9dbfae',
  accent: '#c9a0e0',
  positive: '#9bd3a8',
  negative: '#ec9a9a',
  warning: '#dfb45f',
  info: '#9ac9df'
}

const GALLERY_LIGHT = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  surfaceAlt: '#eef0f3',
  text: '#1a1d21',
  muted: '#5c6470',
  border: '#d7dce2',
  primary: '#d6336c',
  secondary: '#1c7ed6',
  accent: '#6741d9',
  positive: '#2f9e44',
  negative: '#c92a2a',
  warning: '#a97400',
  info: '#1c7ed6'
}

export const BLOG_THEMES = [
  manifest({
    id: 'paper',
    name: 'Paper',
    mood: 'Warm, quiet long-form reading',
    tags: ['light', 'serif', 'editorial'],
    mode: 'light',
    description: 'Cream page, serif body and a rust accent. The default blog look.',
    type: { body: 'serif', display: 'serif', mono: 'mono' },
    tokens: {
      bg: '#fbf8f1',
      surface: '#ffffff',
      surfaceAlt: '#f3ede2',
      text: '#1c1917',
      muted: '#5b5450',
      border: '#ded5c4',
      primary: '#8a3b12',
      secondary: '#2f5d50',
      accent: '#6b3f8c',
      positive: '#256b3a',
      negative: '#a32a2a',
      warning: '#8a5a00',
      info: '#1f5f7a'
    },
    variants: { dark: { tokens: PAPER_DARK } }
  }),
  manifest({
    id: 'studio',
    name: 'Studio',
    mood: 'Neutral dark, product and project updates',
    tags: ['dark', 'sans', 'modern'],
    mode: 'dark',
    description: 'Slate surfaces, amber accent and a clean sans body.',
    type: { body: 'sans', display: 'sans', mono: 'mono' },
    shape: { radius: 'soft', border: 'hairline', shadow: 'crisp' },
    tokens: {
      bg: '#0d1117',
      surface: '#161b22',
      surfaceAlt: '#1c2430',
      text: '#e6edf3',
      muted: '#9aa7b4',
      border: '#2d333b',
      primary: '#e3b341',
      secondary: '#58a6ff',
      accent: '#bc8cff',
      positive: '#3fb950',
      negative: '#f85149',
      warning: '#d29922',
      info: '#58a6ff'
    },
    variants: { light: { tokens: STUDIO_LIGHT } }
  }),
  manifest({
    id: 'terminal',
    name: 'Terminal',
    mood: 'Green phosphor, developer notes',
    tags: ['dark', 'mono', 'technical'],
    mode: 'dark',
    description: 'Monospace type on near-black with a phosphor-green accent.',
    type: { body: 'mono', display: 'mono', mono: 'mono' },
    shape: { radius: 'sharp', border: 'hairline', shadow: 'none' },
    tokens: {
      bg: '#050806',
      surface: '#0a120d',
      surfaceAlt: '#0f1a14',
      text: '#c9f7d0',
      muted: '#86b58f',
      border: '#1b3324',
      primary: '#39ff88',
      secondary: '#6ee7ff',
      accent: '#ffd166',
      positive: '#39ff88',
      negative: '#ff6b6b',
      warning: '#ffd166',
      info: '#6ee7ff'
    },
    variants: { light: { tokens: TERMINAL_LIGHT } }
  }),
  manifest({
    id: 'journal',
    name: 'Journal',
    mood: 'Quiet, narrow, long-form notes',
    tags: ['light', 'serif', 'calm'],
    mode: 'light',
    description: 'A warm off-white column with a muted brown accent.',
    type: { body: 'serif', display: 'serif', mono: 'mono' },
    shape: { radius: 'soft', border: 'hairline', shadow: 'soft' },
    tokens: {
      bg: '#f7f4ee',
      surface: '#fffdf8',
      surfaceAlt: '#f0ebe1',
      text: '#26221d',
      muted: '#625a50',
      border: '#ddd3c4',
      primary: '#6b4f2a',
      secondary: '#3f6654',
      accent: '#7a3d8f',
      positive: '#2f6b3a',
      negative: '#a32a2a',
      warning: '#8a5a00',
      info: '#1f5f7a'
    },
    variants: { dark: { tokens: JOURNAL_DARK } }
  }),
  manifest({
    id: 'gallery',
    name: 'Gallery',
    mood: 'Image-first, dark and visual',
    tags: ['dark', 'sans', 'visual'],
    mode: 'dark',
    description: 'Deep charcoal, crisp type and a vivid rose accent.',
    type: { body: 'sans', display: 'sans', mono: 'mono' },
    shape: { radius: 'round', border: 'none', shadow: 'crisp' },
    tokens: {
      bg: '#0b0c0f',
      surface: '#14161b',
      surfaceAlt: '#1c2027',
      text: '#f1f3f5',
      muted: '#a0a8b3',
      border: '#2a2f37',
      primary: '#ff6b6b',
      secondary: '#4dabf7',
      accent: '#d0bfff',
      positive: '#51cf66',
      negative: '#ff6b6b',
      warning: '#fcc419',
      info: '#4dabf7'
    },
    variants: { light: { tokens: GALLERY_LIGHT } }
  })
]

export const DEFAULT_BLOG_THEME_ID = 'paper'

const OG_IMAGES = {
  paper: '/statics/og-blog-paper.png',
  studio: '/statics/og-blog-studio.png',
  terminal: '/statics/og-blog-terminal.png',
  journal: '/statics/og-blog-journal.png',
  gallery: '/statics/og-blog-gallery.png'
}

/** A deterministic 1200×630 social card for a blog without a cover image. */
export function blogOgImagePath (themeId) {
  const id = String(themeId || '').toLowerCase()
  return OG_IMAGES[id] || OG_IMAGES[DEFAULT_BLOG_THEME_ID]
}

const BY_ID = new Map(BLOG_THEMES.map(theme => [theme.id, theme]))

export function getBlogTheme (id) {
  return BY_ID.get(String(id || '').toLowerCase()) || null
}

export function blogThemeOptions () {
  return BLOG_THEMES.map(theme => ({ label: theme.name, value: theme.id, caption: theme.mood }))
}

/** Apply an author-chosen accent to every variant without accepting CSS. */
export function withBlogAccent (theme, accent) {
  if (!theme || !isHexColor(accent)) return theme
  const primary = String(accent).toLowerCase()
  const variants = {}
  for (const [mode, variant] of Object.entries(theme.variants || {})) {
    variants[mode] = {
      ...variant,
      tokens: {
        ...variant.tokens,
        primary
      }
    }
  }
  return {
    ...theme,
    tokens: {
      ...theme.tokens,
      primary
    },
    ...(Object.keys(variants).length ? { variants } : {})
  }
}

/**
 * Resolve the theme a blog should render.
 *
 * `auto` prefers the author's published profile skin and falls back to Paper.
 * An unknown id also falls back rather than rendering an unstyled page.
 */
export function resolveBlogTheme (settings, accountTheme = null) {
  const id = settings && settings.theme ? String(settings.theme) : 'auto'
  let theme
  if (id === 'auto') theme = accountTheme || getBlogTheme(DEFAULT_BLOG_THEME_ID)
  else theme = getBlogTheme(id) || accountTheme || getBlogTheme(DEFAULT_BLOG_THEME_ID)
  return withBlogAccent(theme, settings && settings.accent)
}
