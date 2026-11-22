// Strict validator for theme manifests.
//
// This is the security boundary for user-published skins. It accepts values,
// never CSS. Unknown keys are errors rather than silently ignored, so a typo
// is visible in the Skin Studio and a future field cannot sneak through.

import { contrast, isHexColor } from './color'

export const THEME_SCHEMA = 'hive.ausbit.dev/theme@1'
export const MAX_THEME_BYTES = 6000
export const MAX_DEPTH = 6

export const COLOR_KEYS = [
  'bg', 'surface', 'surfaceAlt', 'text', 'muted', 'border',
  'primary', 'secondary', 'accent', 'positive', 'negative', 'warning', 'info'
]

export const TYPE_VALUES = {
  body: ['sans', 'serif', 'mono', 'rounded'],
  display: ['sans', 'serif', 'grotesk', 'mono'],
  mono: ['mono']
}

export const SHAPE_VALUES = {
  radius: ['sharp', 'soft', 'round', 'pill'],
  border: ['none', 'hairline', '2px', 'double'],
  shadow: ['none', 'soft', 'crisp', 'glow']
}

export const EFFECT_VALUES = {
  texture: ['none', 'hex', 'grid', 'scanlines', 'grain', 'paper', 'leaves', 'aurora', 'stars'],
  motion: ['none', 'subtle', 'lively'],
  ambient: ['none', 'drift', 'shimmer', 'pulse']
}

export const PROFILE_VALUES = {
  background: ['solid', 'mesh', 'aurora', 'horizon', 'starfield', 'hex', 'grid', 'scanlines', 'grain', 'paper', 'leaves'],
  avatarFrame: ['none', 'ring', 'hex', 'halo', 'orbit', 'pixel', 'ticket'],
  nameplate: ['plain', 'gradient', 'neon', 'emboss', 'stamp'],
  card: ['flat', 'glass', 'paper', 'terminal', 'ticket']
}

export const STICKERS = ['hex', 'bee', 'star', 'spark', 'cassette', 'pixel-heart', 'coffee', 'rocket', 'flower', 'lightning']

const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const BIDI_RE = /[\u202a-\u202e\u2066-\u2069]/

function isPlainObject (value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function checkKeys (value, allowed, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`)
    return false
  }
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      errors.push(`${path} contains a forbidden key`)
      continue
    }
    if (!allowed.includes(key)) errors.push(`${path}.${key} is not a recognised theme field`)
  }
  return true
}

function plainString (value, path, errors, { max = 80, min = 0 } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${path} must be a string`)
    return ''
  }
  const text = value.trim()
  if (text.length < min) errors.push(`${path} is too short`)
  if (text.length > max) errors.push(`${path} must be ${max} characters or fewer`)
  if (CONTROL_RE.test(text)) errors.push(`${path} contains control characters`)
  if (BIDI_RE.test(text)) errors.push(`${path} contains bidirectional control characters`)
  return text
}

function enumValue (value, allowed, path, errors, fallback) {
  if (value === undefined) return fallback
  if (!allowed.includes(value)) {
    errors.push(`${path} must be one of: ${allowed.join(', ')}`)
    return fallback
  }
  return value
}

function validImageUrl (value) {
  if (typeof value !== 'string' || value.length > 500) return false
  if (!/^https:\/\//i.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

function depthOf (value, depth = 0) {
  if (value === null || typeof value !== 'object') return depth
  if (depth > MAX_DEPTH) return depth
  const values = Array.isArray(value) ? value : Object.values(value)
  return values.reduce((max, item) => Math.max(max, depthOf(item, depth + 1)), depth)
}

function normalizeProfile (input, errors) {
  const profile = input === undefined ? {} : input
  checkKeys(profile, ['background', 'avatarFrame', 'nameplate', 'card', 'ticker', 'stickers', 'banner'], 'profile', errors)
  const ticker = profile.ticker === undefined
    ? ''
    : plainString(profile.ticker, 'profile.ticker', errors, { max: 140 })
  if (/[<>]/.test(ticker)) errors.push('profile.ticker must be plain text, not HTML')
  const stickers = profile.stickers === undefined ? [] : profile.stickers
  const stickerList = []
  if (!Array.isArray(stickers)) {
    errors.push('profile.stickers must be an array')
  } else {
    if (stickers.length > 6) errors.push('profile.stickers supports at most 6 stickers')
    for (const sticker of stickers.slice(0, 6)) {
      if (typeof sticker !== 'string' || !STICKERS.includes(sticker)) {
        errors.push('profile.stickers contains an unknown sticker')
      } else if (!stickerList.includes(sticker)) {
        stickerList.push(sticker)
      }
    }
  }

  let banner = null
  if (profile.banner !== null && profile.banner !== undefined) {
    if (checkKeys(profile.banner, ['layout', 'images'], 'profile.banner', errors)) {
      banner = {
        layout: enumValue(profile.banner.layout, ['mosaic'], 'profile.banner.layout', errors, 'mosaic'),
        images: []
      }
      const images = profile.banner.images
      if (!Array.isArray(images)) {
        errors.push('profile.banner.images must be an array')
      } else {
        if (images.length > 3) errors.push('profile.banner.images supports at most 3 images')
        for (const image of images.slice(0, 3)) {
          if (!validImageUrl(image)) errors.push('profile.banner.images must contain https image URLs')
          else banner.images.push(image)
        }
      }
    }
  }

  return {
    background: enumValue(profile.background, PROFILE_VALUES.background, 'profile.background', errors, 'solid'),
    avatarFrame: enumValue(profile.avatarFrame, PROFILE_VALUES.avatarFrame, 'profile.avatarFrame', errors, 'none'),
    nameplate: enumValue(profile.nameplate, PROFILE_VALUES.nameplate, 'profile.nameplate', errors, 'plain'),
    card: enumValue(profile.card, PROFILE_VALUES.card, 'profile.card', errors, 'flat'),
    ticker,
    stickers: stickerList,
    banner
  }
}

/**
 * Validate and normalise an untrusted theme.
 *
 * @returns {{ ok: boolean, theme: object|null, errors: string[], warnings: string[] }}
 */
export function validateTheme (input, { requireProfile = false } = {}) {
  const errors = []
  const warnings = []
  if (!isPlainObject(input)) {
    return { ok: false, theme: null, errors: ['Theme must be a JSON object'], warnings }
  }

  if (depthOf(input) > MAX_DEPTH) {
    return { ok: false, theme: null, errors: ['Theme is nested too deeply'], warnings }
  }

  let serialised
  try {
    serialised = JSON.stringify(input)
  } catch {
    return { ok: false, theme: null, errors: ['Theme is not serialisable'], warnings }
  }
  if (!serialised) {
    return { ok: false, theme: null, errors: ['Theme is not serialisable'], warnings }
  }
  if (serialised.length > MAX_THEME_BYTES) {
    errors.push(`Theme must be ${MAX_THEME_BYTES} bytes or fewer`)
  }

  checkKeys(input, [
    'schema', 'scope', 'id', 'name', 'mood', 'tags', 'mode', 'author',
    'remixedFrom', 'description', 'tokens', 'type', 'shape', 'effects', 'profile'
  ], 'theme', errors)

  if (input.schema !== THEME_SCHEMA) errors.push(`schema must be "${THEME_SCHEMA}"`)
  const scope = enumValue(input.scope, ['site', 'profile'], 'scope', errors, 'profile')
  if (requireProfile && scope !== 'profile') errors.push('scope must be "profile" for an account skin')

  const id = plainString(input.id, 'id', errors, { max: 40, min: 1 })
  if (id && !ID_RE.test(id)) errors.push('id must use lowercase letters, numbers and hyphens')
  const name = plainString(input.name, 'name', errors, { max: 40, min: 1 })
  const mood = plainString(input.mood || '', 'mood', errors, { max: 80 })
  const description = plainString(input.description || '', 'description', errors, { max: 240 })
  const author = input.author === undefined ? '' : plainString(input.author, 'author', errors, { max: 32 })
  const remixedFrom = input.remixedFrom === undefined || input.remixedFrom === null
    ? null
    : plainString(input.remixedFrom, 'remixedFrom', errors, { max: 32 })
  const mode = enumValue(input.mode, ['dark', 'light'], 'mode', errors, 'dark')

  const tags = []
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      errors.push('tags must be an array')
    } else {
      if (input.tags.length > 8) errors.push('tags supports at most 8 values')
      for (const tag of input.tags.slice(0, 8)) {
        const text = plainString(tag, 'tags[]', errors, { max: 20 })
        if (text && !tags.includes(text)) tags.push(text)
      }
    }
  }

  if (!checkKeys(input.tokens, COLOR_KEYS, 'tokens', errors)) {
    // checkKeys already recorded the error.
  }
  const tokens = {}
  for (const key of COLOR_KEYS) {
    const value = input.tokens && input.tokens[key]
    if (typeof value !== 'string' || !isHexColor(value)) {
      errors.push(`tokens.${key} must be a #rrggbb or #rgb colour`)
    } else {
      tokens[key] = value.toLowerCase()
    }
  }

  checkKeys(input.type, ['body', 'display', 'mono'], 'type', errors)
  checkKeys(input.shape, ['radius', 'border', 'shadow'], 'shape', errors)
  checkKeys(input.effects, ['texture', 'motion', 'ambient'], 'effects', errors)

  const type = {
    body: enumValue(input.type?.body, TYPE_VALUES.body, 'type.body', errors, 'sans'),
    display: enumValue(input.type?.display, TYPE_VALUES.display, 'type.display', errors, 'sans'),
    mono: enumValue(input.type?.mono, TYPE_VALUES.mono, 'type.mono', errors, 'mono')
  }
  const shape = {
    radius: enumValue(input.shape?.radius, SHAPE_VALUES.radius, 'shape.radius', errors, 'soft'),
    border: enumValue(input.shape?.border, SHAPE_VALUES.border, 'shape.border', errors, 'hairline'),
    shadow: enumValue(input.shape?.shadow, SHAPE_VALUES.shadow, 'shape.shadow', errors, 'soft')
  }
  const effects = {
    texture: enumValue(input.effects?.texture, EFFECT_VALUES.texture, 'effects.texture', errors, 'none'),
    motion: enumValue(input.effects?.motion, EFFECT_VALUES.motion, 'effects.motion', errors, 'subtle'),
    ambient: enumValue(input.effects?.ambient, EFFECT_VALUES.ambient, 'effects.ambient', errors, 'none')
  }

  const profile = normalizeProfile(input.profile, errors)

  if (errors.length === 0) {
    // Contrast gates. These are warnings in the studio but errors at publish.
    const textRatio = contrast(tokens.text, tokens.surface)
    if (textRatio < 4.5) errors.push(`text on surface is ${textRatio.toFixed(2)}:1; at least 4.5:1 is required`)
    const mutedRatio = contrast(tokens.muted, tokens.surface)
    if (mutedRatio < 4.5) errors.push(`muted text on surface is ${mutedRatio.toFixed(2)}:1; at least 4.5:1 is required`)
    if (contrast(tokens.primary, tokens.bg) < 3) warnings.push('primary is below 3:1 against the page background')
    if (contrast(tokens.border, tokens.surface) < 1.3) warnings.push('border is very close to the surface colour')
    if (contrast(tokens.primary, tokens.bg) >= 3 && contrast(tokens.text, tokens.bg) < 4.5) {
      warnings.push('text on the page background is below 4.5:1')
    }
  }

  if (errors.length) return { ok: false, theme: null, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }

  return {
    ok: true,
    errors: [],
    warnings: [...new Set(warnings)],
    theme: {
      schema: THEME_SCHEMA,
      scope,
      id,
      name,
      mood,
      description,
      author,
      remixedFrom,
      tags,
      mode,
      tokens,
      type,
      shape,
      effects,
      profile
    }
  }
}

/** Parse a theme JSON string without ever throwing at the caller. */
export function parseTheme (value, options) {
  if (typeof value !== 'string') return { ok: false, theme: null, errors: ['Theme must be a JSON string'], warnings: [] }
  if (value.length > MAX_THEME_BYTES) return { ok: false, theme: null, errors: ['Theme is too large'], warnings: [] }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ok: false, theme: null, errors: ['Theme is not valid JSON'], warnings: [] }
  }
  return validateTheme(parsed, options)
}

/** A short human summary for the studio and the theme wall. */
export function themeSummary (theme) {
  if (!theme) return ''
  const light = theme.mode === 'light' ? 'Light' : 'Dark'
  return `${theme.name} · ${light}`
}
