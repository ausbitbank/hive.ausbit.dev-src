// Built-in theme manifests.
//
// A manifest is deliberately small: primitives plus a handful of enums. The
// full token set, Quasar bridge and chart palette are derived in tokens.js.
// `overrides` lets a built-in theme pin a derived value when its signature
// depends on an exact shade (Hive Dark preserves the pre-theme look).

const BASE_PROFILE = {
  background: 'solid',
  avatarFrame: 'none',
  nameplate: 'plain',
  card: 'flat',
  ticker: '',
  stickers: [],
  banner: null
}

function manifest (data) {
  return {
    schema: 'hive.ausbit.dev/theme@1',
    scope: 'site',
    author: 'hive.ausbit.dev',
    remixedFrom: null,
    type: { body: 'sans', display: 'sans', mono: 'mono' },
    shape: { radius: 'soft', border: 'hairline', shadow: 'soft' },
    effects: { texture: 'none', motion: 'subtle', ambient: 'none' },
    profile: { ...BASE_PROFILE },
    ...data
  }
}

export const THEMES = [
  manifest({
    id: 'hive-dark',
    name: 'Hive Dark',
    mood: 'The familiar midnight explorer',
    tags: ['dark', 'calm', 'default'],
    mode: 'dark',
    description: 'Cool slate, soft cards and cyan links. The original hive.ausbit.dev look.',
    tokens: {
      bg: '#0d1114',
      surface: '#151c21',
      surfaceAlt: '#1d1d1d',
      text: '#e4eaed',
      muted: '#90a4ae',
      border: '#2a3942',
      primary: '#3e92cc',
      secondary: '#e31337',
      accent: '#9c27b0',
      positive: '#81c784',
      negative: '#e57373',
      warning: '#ffb74d',
      info: '#81d4fa'
    },
    overrides: {
      '--c-bg-deep': '#080d11',
      '--c-card': '#141a1e',
      '--c-surface-1': '#1a2329',
      '--c-surface-2': '#10181d',
      '--c-surface-3': '#141a1f',
      '--c-surface-glass': 'rgba(8, 13, 17, 0.72)',
      '--c-header': 'rgba(13, 17, 20, 0.94)',
      '--c-drawer': '#0d1419',
      '--c-footer': 'rgba(8, 13, 17, 0.5)',
      '--c-text-strong': '#ffffff',
      '--c-text-soft': '#cfd8dc',
      '--c-text-muted': '#b0bec5',
      '--c-text-subtle': '#90a4ae',
      '--c-text-faint': '#78909c',
      '--c-text-inverse': '#0b1d2a',
      '--c-link': '#4fc3f7',
      '--c-link-hover': '#81d4fa',
      '--c-link-visited': '#ce93d8',
      '--c-link-soft': '#e1f5fe',
      '--c-primary-soft': '#4fc3f7',
      '--c-accent-soft': '#e1bee7',
      '--c-border-subtle': 'rgba(255, 255, 255, 0.09)',
      '--c-border-strong': 'rgba(255, 255, 255, 0.18)',
      '--c-code-bg': '#1a272d',
      '--c-code-border': '#131e23',
      '--c-code-text': '#ececec',
      '--c-focus': '#ffd54f',
      '--c-overlay-weak': 'rgba(255, 255, 255, 0.04)',
      '--c-overlay': 'rgba(255, 255, 255, 0.08)',
      '--c-overlay-strong': 'rgba(255, 255, 255, 0.14)',
      '--c-scrim': 'rgba(4, 8, 12, 0.72)',
      '--c-shadow': '#000000',
      '--c-warning-soft': '#ffcc80',
      '--c-positive-soft': '#a5d6a7',
      '--c-negative-soft': '#ef9a9a'
    }
  }),
  manifest({
    id: 'hive-light',
    name: 'Hive Light',
    mood: 'Daylight, blue ink and clean paper',
    tags: ['light', 'calm', 'default'],
    mode: 'light',
    description: 'Bright surfaces, deep blue links and crisp but soft elevation.',
    tokens: {
      bg: '#f5f7fa',
      surface: '#ffffff',
      surfaceAlt: '#eef3f8',
      text: '#132029',
      muted: '#52646f',
      border: '#c9d6e0',
      primary: '#0b63b6',
      secondary: '#c8102e',
      accent: '#6d3bbf',
      positive: '#19753a',
      negative: '#b42318',
      warning: '#9a5b00',
      info: '#0b6f8a'
    },
    overrides: {
      '--c-header': 'rgba(255, 255, 255, 0.94)',
      '--c-footer': 'rgba(238, 243, 248, 0.8)',
      '--c-text-strong': '#08141b',
      '--c-text-inverse': '#ffffff',
      '--c-focus': '#8a4b00',
      '--c-code-bg': '#eef3f8',
      '--c-code-border': '#c9d6e0',
      '--c-code-text': '#132029',
      '--c-shadow': '#203547',
      '--c-shadow-sm': '0 1px 2px rgba(32, 53, 71, 0.08)',
      '--c-shadow-card': '0 6px 18px rgba(32, 53, 71, 0.1)',
      '--c-shadow-pop': '0 14px 40px rgba(32, 53, 71, 0.18)'
    }
  }),
  manifest({
    id: 'honeycomb',
    name: 'Honeycomb',
    mood: 'Warm amber, gold hairlines, hive geometry',
    tags: ['dark', 'warm', 'hive'],
    mode: 'dark',
    description: 'Dark honey and toasted amber with a hexagon texture and a soft gold glow.',
    tokens: {
      bg: '#171007',
      surface: '#241a0d',
      surfaceAlt: '#2f2211',
      text: '#f6e7c8',
      muted: '#c9a86a',
      border: '#5a4321',
      primary: '#f2b544',
      secondary: '#e07a1f',
      accent: '#ffd166',
      positive: '#a3c76d',
      negative: '#e07a72',
      warning: '#ffd166',
      info: '#e8c98a'
    },
    type: { body: 'sans', display: 'serif', mono: 'mono' },
    shape: { radius: 'round', border: 'hairline', shadow: 'glow' },
    effects: { texture: 'hex', motion: 'subtle', ambient: 'shimmer' },
    overrides: {
      '--c-link': '#ffd166',
      '--c-link-hover': '#ffe6a3',
      '--c-border-subtle': 'rgba(242, 181, 68, 0.16)',
      '--c-focus': '#ffe6a3'
    }
  }),
  manifest({
    id: 'solarpunk',
    name: 'Solarpunk',
    mood: 'Cream paper, leaf green, sun gold',
    tags: ['light', 'organic', 'warm'],
    mode: 'light',
    description: 'An optimistic daylight palette with botanical linework and a serif display face.',
    tokens: {
      bg: '#f3f0e2',
      surface: '#fbf8ec',
      surfaceAlt: '#ecebdc',
      text: '#1f2b1a',
      muted: '#5b6b4f',
      border: '#c8c9b2',
      primary: '#2f7d4f',
      secondary: '#b45f06',
      accent: '#6f8f2f',
      positive: '#2f7d4f',
      negative: '#a63d2f',
      warning: '#9a5b00',
      info: '#2b6f7a'
    },
    type: { body: 'sans', display: 'serif', mono: 'mono' },
    shape: { radius: 'round', border: 'hairline', shadow: 'soft' },
    effects: { texture: 'leaves', motion: 'subtle', ambient: 'none' },
    overrides: {
      '--c-link': '#2f7d4f',
      '--c-link-hover': '#1f5c38',
      '--c-focus': '#8a4b00'
    }
  }),
  manifest({
    id: 'cyberdeck',
    name: 'Cyberdeck',
    mood: 'Phosphor terminal, scanlines, square corners',
    tags: ['dark', 'neon', 'terminal'],
    mode: 'dark',
    description: 'Near-black glass and phosphor green. Mono numerals, square edges, no softness.',
    tokens: {
      bg: '#050806',
      surface: '#0a120c',
      surfaceAlt: '#0e1a11',
      text: '#c8ffd4',
      muted: '#6f9e7a',
      border: '#1e4a2b',
      primary: '#39ff88',
      secondary: '#ffb000',
      accent: '#00e5ff',
      positive: '#39ff88',
      negative: '#ff6b6b',
      warning: '#ffb000',
      info: '#00e5ff'
    },
    type: { body: 'sans', display: 'mono', mono: 'mono' },
    shape: { radius: 'sharp', border: '2px', shadow: 'none' },
    effects: { texture: 'scanlines', motion: 'subtle', ambient: 'pulse' },
    overrides: {
      '--c-link': '#39ff88',
      '--c-link-hover': '#9dffbe',
      '--c-text-strong': '#eaffef',
      '--c-border-subtle': 'rgba(57, 255, 136, 0.16)',
      '--c-focus': '#ffb000'
    }
  }),
  manifest({
    id: 'neon-tide',
    name: 'Neon Tide',
    mood: 'Synthwave ocean, glass and horizon glow',
    tags: ['dark', 'neon', 'glass'],
    mode: 'dark',
    description: 'Deep indigo with cyan and magenta glow, glass cards and a horizon grid.',
    tokens: {
      bg: '#070a18',
      surface: '#10152b',
      surfaceAlt: '#161d38',
      text: '#eef2ff',
      muted: '#9aa8d6',
      border: '#2a3560',
      primary: '#5ce1e6',
      secondary: '#ff5cc8',
      accent: '#a78bfa',
      positive: '#4ade80',
      negative: '#fb7185',
      warning: '#fbbf24',
      info: '#60a5fa'
    },
    shape: { radius: 'soft', border: 'hairline', shadow: 'glow' },
    effects: { texture: 'grid', motion: 'subtle', ambient: 'drift' },
    overrides: {
      '--c-link': '#5ce1e6',
      '--c-link-hover': '#a5f6f8',
      '--c-link-visited': '#c4b5fd',
      '--c-border-subtle': 'rgba(92, 225, 230, 0.14)',
      '--c-focus': '#ff5cc8'
    }
  }),
  manifest({
    id: 'paper-ink',
    name: 'Paper & Ink',
    mood: 'Editorial print, serif headlines, red folio',
    tags: ['light', 'print', 'calm'],
    mode: 'light',
    description: 'Warm paper, black ink and a red accent. Hairline rules and no decorative depth.',
    tokens: {
      bg: '#f4efe4',
      surface: '#fbf7ee',
      surfaceAlt: '#ebe4d6',
      text: '#1c1a17',
      muted: '#5d574c',
      border: '#c9c1b2',
      primary: '#9b1c1c',
      secondary: '#1f4e79',
      accent: '#b45309',
      positive: '#2f6b3a',
      negative: '#9b1c1c',
      warning: '#8a4b00',
      info: '#1f4e79'
    },
    type: { body: 'sans', display: 'serif', mono: 'mono' },
    shape: { radius: 'sharp', border: 'hairline', shadow: 'none' },
    effects: { texture: 'paper', motion: 'none', ambient: 'none' },
    overrides: {
      '--c-link': '#9b1c1c',
      '--c-link-hover': '#6f1111',
      '--c-focus': '#1f4e79',
      '--c-shadow-sm': 'none',
      '--c-shadow-card': 'none',
      '--c-shadow-pop': 'none'
    }
  }),
  manifest({
    id: 'aurora',
    name: 'Aurora',
    mood: 'Boreal night, green-violet drift, frosted glass',
    tags: ['dark', 'calm', 'glow'],
    mode: 'dark',
    description: 'Deep polar night with an aurora mesh, frosted surfaces and slow ambient drift.',
    tokens: {
      bg: '#071019',
      surface: '#0d1b21',
      surfaceAlt: '#12252b',
      text: '#e6f6f2',
      muted: '#8fb3ad',
      border: '#234039',
      primary: '#5eead4',
      secondary: '#a78bfa',
      accent: '#38bdf8',
      positive: '#5eead4',
      negative: '#f08a8a',
      warning: '#f4c76b',
      info: '#38bdf8'
    },
    shape: { radius: 'round', border: 'hairline', shadow: 'glow' },
    effects: { texture: 'aurora', motion: 'subtle', ambient: 'drift' },
    overrides: {
      '--c-link': '#5eead4',
      '--c-link-hover': '#a7f3e8',
      '--c-link-visited': '#c4b5fd',
      '--c-border-subtle': 'rgba(94, 234, 212, 0.14)',
      '--c-focus': '#f4c76b'
    }
  }),
  manifest({
    id: 'retro-relay',
    name: 'Retro Relay',
    mood: '80s sunset, grain and chunky glow',
    tags: ['dark', 'retro', 'warm'],
    mode: 'dark',
    description: 'Plum dusk with coral and gold, chunky borders, grain and a playful display face.',
    tokens: {
      bg: '#1a0f1f',
      surface: '#261628',
      surfaceAlt: '#302035',
      text: '#ffe8d6',
      muted: '#c9a3a8',
      border: '#55344f',
      primary: '#ff7a59',
      secondary: '#ffd166',
      accent: '#c084fc',
      positive: '#8fd694',
      negative: '#ff8a8a',
      warning: '#ffd166',
      info: '#8fd6e8'
    },
    type: { body: 'sans', display: 'serif', mono: 'mono' },
    shape: { radius: 'soft', border: '2px', shadow: 'glow' },
    effects: { texture: 'grain', motion: 'subtle', ambient: 'shimmer' },
    overrides: {
      '--c-link': '#ffd166',
      '--c-link-hover': '#ffe6a3',
      '--c-link-visited': '#e0b0ff',
      '--c-border-subtle': 'rgba(255, 209, 102, 0.14)',
      '--c-focus': '#ffd166'
    }
  }),
  manifest({
    id: 'graphite',
    name: 'Graphite',
    mood: 'Maximum contrast, no decoration',
    tags: ['dark', 'high-contrast', 'calm'],
    mode: 'dark',
    description: 'Black and white with a single warm accent. Two-pixel borders and no texture.',
    tokens: {
      bg: '#000000',
      surface: '#0b0b0b',
      surfaceAlt: '#151515',
      text: '#ffffff',
      muted: '#d0d0d0',
      border: '#8a8a8a',
      primary: '#ffcc00',
      secondary: '#66b3ff',
      accent: '#ffcc00',
      positive: '#7dff9b',
      negative: '#ff8a8a',
      warning: '#ffcc00',
      info: '#8fd6ff'
    },
    shape: { radius: 'sharp', border: '2px', shadow: 'none' },
    effects: { texture: 'none', motion: 'none', ambient: 'none' },
    overrides: {
      '--c-bg-deep': '#000000',
      '--c-surface-1': '#111111',
      '--c-surface-2': '#0b0b0b',
      '--c-text-soft': '#ffffff',
      '--c-text-muted': '#ffffff',
      '--c-text-subtle': '#eaeaea',
      '--c-text-faint': '#d0d0d0',
      '--c-link': '#ffcc00',
      '--c-link-hover': '#ffffff',
      '--c-link-visited': '#66b3ff',
      '--c-border-subtle': '#8a8a8a',
      '--c-border-strong': '#ffffff',
      '--c-focus': '#ffffff',
      '--c-code-bg': '#000000',
      '--c-code-border': '#8a8a8a',
      '--c-code-text': '#ffffff',
      '--c-shadow-sm': 'none',
      '--c-shadow-card': 'none',
      '--c-shadow-pop': 'none'
    }
  })
]

export const DEFAULT_THEME_ID = 'hive-dark'

export const THEME_BY_ID = new Map(THEMES.map(theme => [theme.id, theme]))

export function getTheme (id) {
  return THEME_BY_ID.get(String(id || '')) || THEME_BY_ID.get(DEFAULT_THEME_ID)
}

export function themeOptions () {
  return THEMES.map(theme => ({
    label: theme.name,
    value: theme.id,
    caption: theme.mood,
    mode: theme.mode,
    tags: theme.tags
  }))
}
