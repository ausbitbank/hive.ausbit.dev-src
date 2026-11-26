// Turn a theme manifest into the CSS custom properties the app consumes.
//
// Primitive tokens are author-controlled. Everything else is derived so a
// half-finished palette cannot produce invisible borders, unreadable hover
// states or a missing focus ring. Built-in themes may pin derived values via
// `overrides` to preserve a signature look.

import { mix, readableOn, withAlpha } from './color'

const FONT_STACKS = {
  sans: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  rounded: '"SF Pro Rounded", "Hiragino Maru Gothic ProN", "Nunito", "Varela Round", sans-serif',
  grotesk: '"Helvetica Neue", "Arial Narrow", "Roboto Condensed", Arial, sans-serif'
}

function fontStack (value) {
  return FONT_STACKS[value] || FONT_STACKS.sans
}

function themeMode (theme) {
  return theme && theme.mode === 'light' ? 'light' : 'dark'
}

/** The viewer's mode selects a variant when the skin provides one. */
export function resolveThemeTokens (theme, mode = '') {
  const variant = mode && theme?.variants?.[mode]
  if (variant?.tokens) return { mode, tokens: variant.tokens }
  return { mode: themeMode(theme), tokens: theme?.tokens || {} }
}

export function highContrastTokens (mode = 'dark') {
  const dark = mode !== 'light'
  if (dark) {
    return {
      '--c-bg': '#000000',
      '--c-bg-deep': '#000000',
      '--c-surface': '#000000',
      '--c-surface-1': '#0a0a0a',
      '--c-surface-2': '#000000',
      '--c-surface-3': '#111111',
      '--c-surface-glass': 'rgba(0, 0, 0, 0.92)',
      '--c-header': '#000000',
      '--c-drawer': '#000000',
      '--c-footer': '#000000',
      '--c-dialog': '#000000',
      '--c-text': '#ffffff',
      '--c-text-strong': '#ffffff',
      '--c-text-soft': '#ffffff',
      '--c-text-muted': '#ffffff',
      '--c-text-subtle': '#f0f0f0',
      '--c-text-faint': '#e0e0e0',
      '--c-link': '#ffcc00',
      '--c-link-hover': '#ffffff',
      '--c-link-visited': '#66b3ff',
      '--c-primary': '#ffcc00',
      '--c-primary-soft': '#ffcc00',
      '--c-secondary': '#ff8a8a',
      '--c-positive': '#7dff9b',
      '--c-negative': '#ff8a8a',
      '--c-warning': '#ffcc00',
      '--c-info': '#8fd6ff',
      '--c-border': '#ffffff',
      '--c-border-subtle': '#ffffff',
      '--c-border-strong': '#ffffff',
      '--c-focus': '#ffffff',
      '--c-on-primary': '#000000',
      '--c-on-accent': '#000000',
      '--c-overlay-weak': 'rgba(255, 255, 255, 0.08)',
      '--c-overlay': 'rgba(255, 255, 255, 0.14)',
      '--c-overlay-strong': 'rgba(255, 255, 255, 0.22)',
      '--c-scrim': 'rgba(0, 0, 0, 0.9)',
      '--c-shadow': '#000000',
      '--c-code-bg': '#000000',
      '--c-code-border': '#ffffff',
      '--c-code-text': '#ffffff'
    }
  }
  return {
    '--c-bg': '#ffffff',
    '--c-bg-deep': '#f2f2f2',
    '--c-surface': '#ffffff',
    '--c-surface-1': '#ffffff',
    '--c-surface-2': '#f2f2f2',
    '--c-surface-3': '#e6e6e6',
    '--c-surface-glass': 'rgba(255, 255, 255, 0.95)',
    '--c-header': '#ffffff',
    '--c-drawer': '#ffffff',
    '--c-footer': '#ffffff',
    '--c-dialog': '#ffffff',
    '--c-text': '#000000',
    '--c-text-strong': '#000000',
    '--c-text-soft': '#000000',
    '--c-text-muted': '#000000',
    '--c-text-subtle': '#111111',
    '--c-text-faint': '#222222',
    '--c-link': '#0033cc',
    '--c-link-hover': '#000000',
    '--c-link-visited': '#6b1f9a',
    '--c-primary': '#0033cc',
    '--c-primary-soft': '#0033cc',
    '--c-secondary': '#a00000',
    '--c-positive': '#006622',
    '--c-negative': '#a00000',
    '--c-warning': '#6b3d00',
    '--c-info': '#005f80',
    '--c-border': '#000000',
    '--c-border-subtle': '#000000',
    '--c-border-strong': '#000000',
    '--c-focus': '#000000',
    '--c-on-primary': '#ffffff',
    '--c-on-accent': '#ffffff',
    '--c-overlay-weak': 'rgba(0, 0, 0, 0.06)',
    '--c-overlay': 'rgba(0, 0, 0, 0.12)',
    '--c-overlay-strong': 'rgba(0, 0, 0, 0.2)',
    '--c-scrim': 'rgba(255, 255, 255, 0.9)',
    '--c-shadow': '#000000',
    '--c-code-bg': '#ffffff',
    '--c-code-border': '#000000',
    '--c-code-text': '#000000'
  }
}

export function tokensFor (theme, { highContrast = false, mode = '' } = {}) {
  const resolved = resolveThemeTokens(theme, mode)
  const tokens = resolved.tokens
  const dark = resolved.mode === 'dark'
  const bg = tokens.bg || (dark ? '#0d1114' : '#f5f7fa')
  const surface = tokens.surface || (dark ? '#151c21' : '#ffffff')
  const text = tokens.text || (dark ? '#e4eaed' : '#132029')
  const muted = tokens.muted || (dark ? '#90a4ae' : '#52646f')
  const border = tokens.border || (dark ? '#2a3942' : '#c9d6e0')
  const primary = tokens.primary || (dark ? '#3e92cc' : '#0b63b6')
  const secondary = tokens.secondary || (dark ? '#e31337' : '#c8102e')
  const accent = tokens.accent || (dark ? '#9c27b0' : '#6d3bbf')
  const positive = tokens.positive || (dark ? '#81c784' : '#19753a')
  const negative = tokens.negative || (dark ? '#e57373' : '#b42318')
  const warning = tokens.warning || (dark ? '#ffb74d' : '#9a5b00')
  const info = tokens.info || (dark ? '#81d4fa' : '#0b6f8a')
  const shadow = dark ? '#000000' : '#203547'
  const codeBg = dark ? mix(surface, '#000000', 0.3) : mix(surface, '#000000', 0.06)
  // A filled toggle needs to contrast with the page as well as its own fill.
  // Keeping both in the same lightness band lets the label pass against both.
  const modeToggleBg = dark ? mix(primary, '#000000', 0.34) : mix(primary, '#ffffff', 0.86)

  const derived = {
    '--font-body': fontStack(theme?.type?.body),
    '--font-display': fontStack(theme?.type?.display || theme?.type?.body),
    '--font-mono': FONT_STACKS.mono,
    '--c-bg': bg,
    '--c-bg-deep': dark ? mix(bg, '#000000', 0.35) : mix(bg, '#000000', 0.04),
    '--c-surface': surface,
    '--c-card': dark ? mix(bg, text, 0.035) : mix(bg, text, 0.025),
    '--c-surface-1': dark ? mix(surface, text, 0.03) : mix(surface, text, 0.018),
    '--c-surface-2': dark ? mix(surface, text, 0.065) : mix(surface, text, 0.04),
    '--c-surface-3': dark ? mix(surface, text, 0.11) : mix(surface, text, 0.07),
    '--c-surface-glass': withAlpha(surface, dark ? 0.72 : 0.86),
    '--c-header': withAlpha(bg, 0.94),
    '--c-drawer': mix(bg, surface, 0.45),
    '--c-footer': withAlpha(surface, dark ? 0.5 : 0.8),
    '--c-dialog': surface,
    '--c-code-bg': codeBg,
    '--c-code-border': mix(codeBg, text, 0.12),
    '--c-code-text': dark ? mix(text, '#ffffff', 0.1) : mix(text, '#000000', 0.1),

    '--c-text': text,
    '--c-text-strong': dark ? '#ffffff' : '#08141b',
    '--c-text-soft': dark ? mix(text, bg, 0.16) : mix(text, bg, 0.03),
    '--c-text-muted': muted,
    '--c-text-subtle': dark ? mix(muted, bg, 0.18) : mix(muted, bg, 0.03),
    '--c-text-faint': dark ? mix(muted, bg, 0.34) : mix(muted, bg, 0.06),
    '--c-text-inverse': readableOn(primary),

    '--c-link': primary,
    '--c-link-hover': dark ? mix(primary, '#ffffff', 0.25) : mix(primary, '#000000', 0.15),
    '--c-link-visited': accent,
    '--c-link-soft': mix(primary, text, 0.45),
    '--c-primary': primary,
    '--c-primary-soft': mix(primary, text, 0.35),
    '--c-secondary': secondary,
    '--c-accent': accent,
    '--c-accent-soft': mix(accent, text, 0.4),
    '--c-positive': positive,
    '--c-negative': negative,
    '--c-warning': warning,
    '--c-info': info,
    '--c-positive-soft': mix(positive, bg, 0.3),
    '--c-negative-soft': mix(negative, bg, 0.3),
    '--c-warning-soft': mix(warning, bg, 0.3),

    '--c-border': border,
    '--c-border-subtle': withAlpha(border, 0.55),
    '--c-border-strong': mix(border, text, 0.25),
    '--c-focus': warning,
    '--c-on-primary': readableOn(primary),
    '--c-on-accent': readableOn(accent),
    '--c-mode-toggle-bg': modeToggleBg,
    '--c-mode-toggle-text': readableOn(modeToggleBg),

    '--c-overlay-weak': withAlpha(text, 0.04),
    '--c-overlay': withAlpha(text, 0.08),
    '--c-overlay-strong': withAlpha(text, 0.14),
    '--c-scrim': withAlpha(bg, 0.72),
    '--c-shadow': shadow,
    '--c-shadow-sm': `0 1px 2px ${withAlpha(shadow, dark ? 0.28 : 0.08)}`,
    '--c-shadow-card': `0 6px 18px ${withAlpha(shadow, dark ? 0.26 : 0.1)}`,
    '--c-shadow-pop': `0 14px 40px ${withAlpha(shadow, dark ? 0.45 : 0.18)}`,

    '--c-qr-bg': '#ffffff',
    '--c-qr-ink': '#000000'
  }

  const merged = { ...derived, ...(theme?.overrides || {}) }
  return highContrast ? { ...merged, ...highContrastTokens(dark ? 'dark' : 'light') } : merged
}

/** Shape enums become scoped geometry tokens. The app owns the geometry. */
const RADIUS_SHAPES = {
  sharp: { card: '0px', pill: '2px' },
  soft: { card: '12px', pill: '999px' },
  round: { card: '22px', pill: '999px' },
  pill: { card: '999px', pill: '999px' }
}

const BORDER_SHAPES = {
  none: { width: '0px', style: 'solid' },
  hairline: { width: '1px', style: 'solid' },
  '2px': { width: '2px', style: 'solid' },
  double: { width: '3px', style: 'double' }
}

const SHADOW_SHAPES = {
  none: 'none',
  soft: '0 6px 18px color-mix(in srgb, var(--c-shadow) 24%, transparent)',
  crisp: '0 2px 0 color-mix(in srgb, var(--c-shadow) 46%, transparent)',
  glow: '0 0 24px color-mix(in srgb, var(--skin-primary, var(--c-primary)) 34%, transparent)'
}

export function shapeVarsFor (theme) {
  const shape = theme?.shape || {}
  const radius = RADIUS_SHAPES[shape.radius] || RADIUS_SHAPES.soft
  const border = BORDER_SHAPES[shape.border] || BORDER_SHAPES.hairline
  const shadow = SHADOW_SHAPES[shape.shadow] || SHADOW_SHAPES.soft
  return {
    '--skin-radius-card': radius.card,
    '--skin-radius-pill': radius.pill,
    '--skin-border-width': border.width,
    '--skin-border-style': border.style,
    '--skin-card-shadow': shadow
  }
}

/** Quasar's own CSS variables. Keep these separate from the app tokens. */
export function quasarVarsFor (theme, { mode = '' } = {}) {
  const resolved = resolveThemeTokens(theme, mode)
  const tokens = resolved.tokens
  const dark = resolved.mode === 'dark'
  return {
    '--q-primary': tokens.primary || '#3e92cc',
    '--q-secondary': tokens.secondary || '#e31337',
    '--q-accent': tokens.accent || '#9c27b0',
    '--q-positive': tokens.positive || '#21ba45',
    '--q-negative': tokens.negative || '#c10015',
    '--q-info': tokens.info || '#31ccec',
    '--q-warning': tokens.warning || '#f2c037',
    '--q-dark': tokens.surface || '#1d1d1d',
    '--q-dark-page': tokens.bg || '#121212',
    '--q-shadow-color': dark ? '#000000' : '#203547',
    '--q-dark-shadow-color': '#000000'
  }
}

/**
 * Chart libraries cannot read CSS variables. Derive a small explicit palette
 * for TradingView and the app's own SVG/canvas surfaces.
 */
export function chartPaletteFor (theme) {
  const tokens = theme?.tokens || {}
  const dark = themeMode(theme) === 'dark'
  return {
    mode: dark ? 'dark' : 'light',
    background: tokens.surface || (dark ? '#151c21' : '#ffffff'),
    toolbar: tokens.surface || (dark ? '#151c21' : '#ffffff'),
    grid: withAlpha(tokens.border || (dark ? '#2a3942' : '#c9d6e0'), 0.45),
    text: tokens.text || (dark ? '#e4eaed' : '#132029'),
    line: tokens.primary || (dark ? '#3e92cc' : '#0b63b6'),
    up: tokens.positive || (dark ? '#81c784' : '#19753a'),
    down: tokens.negative || (dark ? '#e57373' : '#b42318')
  }
}

export function themeStyleObject (theme) {
  return { ...tokensFor(theme), ...quasarVarsFor(theme) }
}

export function themeModeOf (theme, mode = '') {
  return resolveThemeTokens(theme, mode).mode
}
