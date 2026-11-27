// Built-in reading themes for account blogs.
//
// Blog themes are deliberately few and editorial: a warm paper column, a
// neutral studio, and a terminal. An author can also use their published
// profile skin (`theme: "auto"`), which makes the blog and the profile feel
// like the same place without a second design system.

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
    }
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
    }
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
    }
  })
]

export const DEFAULT_BLOG_THEME_ID = 'paper'

const BY_ID = new Map(BLOG_THEMES.map(theme => [theme.id, theme]))

export function getBlogTheme (id) {
  return BY_ID.get(String(id || '').toLowerCase()) || null
}

export function blogThemeOptions () {
  return BLOG_THEMES.map(theme => ({ label: theme.name, value: theme.id, caption: theme.mood }))
}

/** Apply an author-chosen accent without accepting arbitrary CSS. */
export function withBlogAccent (theme, accent) {
  if (!theme || !isHexColor(accent)) return theme
  return {
    ...theme,
    tokens: {
      ...theme.tokens,
      primary: String(accent).toLowerCase()
    }
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
