// Colour helpers for the theme system.
//
// Themes are stored as plain hex values. Everything else (alpha, hover,
// borders, glass, shadows) is derived here so a theme author cannot smuggle a
// CSS declaration into a colour slot.

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function parseHex (value) {
  if (typeof value !== 'string') return null
  const match = HEX_RE.exec(value.trim())
  if (!match) return null
  const raw = match[1]
  const full = raw.length === 3
    ? raw.split('').map(char => char + char).join('')
    : raw
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  }
}

export function isHexColor (value) {
  return parseHex(value) !== null
}

function channel (value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function toHex (rgb) {
  if (!rgb) return '#000000'
  return '#' + [rgb.r, rgb.g, rgb.b]
    .map(value => channel(value).toString(16).padStart(2, '0'))
    .join('')
}

/** Mix `b` into `a`; weight is the share of `b` (0..1). */
export function mix (a, b, weight = 0.5) {
  const left = parseHex(a)
  const right = parseHex(b)
  if (!left || !right) return a || b || '#000000'
  const share = Math.max(0, Math.min(1, Number(weight) || 0))
  return toHex({
    r: left.r + (right.r - left.r) * share,
    g: left.g + (right.g - left.g) * share,
    b: left.b + (right.b - left.b) * share
  })
}

export function withAlpha (value, alpha) {
  const rgb = parseHex(value)
  if (!rgb) return value
  const a = Math.max(0, Math.min(1, Number(alpha) || 0))
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(a.toFixed(3))})`
}

export function luminance (value) {
  const rgb = parseHex(value)
  if (!rgb) return 0
  const convert = component => {
    const channelValue = component / 255
    return channelValue <= 0.03928
      ? channelValue / 12.92
      : Math.pow((channelValue + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * convert(rgb.r) + 0.7152 * convert(rgb.g) + 0.0722 * convert(rgb.b)
}

export function contrast (a, b) {
  const first = luminance(a)
  const second = luminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Black or white text for a surface, whichever has more contrast. */
export function readableOn (background) {
  return contrast(background, '#ffffff') >= contrast(background, '#000000')
    ? '#ffffff'
    : '#000000'
}

/**
 * Nudge `foreground` toward black or white until it reaches `target` contrast
 * against `background`. Returns the original value when it already passes.
 */
export function ensureContrast (foreground, background, target = 4.5) {
  if (contrast(foreground, background) >= target) return foreground
  let best = foreground
  let bestRatio = contrast(foreground, background)
  // Try both extremes. A mid-grey can be impossible to push to 4.5:1 toward
  // white but reach it toward black, so picking one extreme is not enough.
  for (const extreme of ['#ffffff', '#000000']) {
    for (let step = 1; step <= 40; step += 1) {
      const candidate = mix(foreground, extreme, step / 40)
      const ratio = contrast(candidate, background)
      if (ratio > bestRatio) {
        best = candidate
        bestRatio = ratio
      }
      if (ratio >= target) return candidate
    }
  }
  return best
}

/** Count-driven deterministic hue for avatar palettes and fallbacks. */
export function hueFor (value) {
  const text = String(value || 'hive')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % 360
}

export function rgbToHsl (value) {
  const rgb = parseHex(value)
  if (!rgb) return { h: 0, s: 0, l: 0 }
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex (h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360
  const saturation = Math.max(0, Math.min(100, Number(s))) / 100
  const lightness = Math.max(0, Math.min(100, Number(l))) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = lightness - chroma / 2
  let rgb
  if (hue < 60) rgb = [chroma, x, 0]
  else if (hue < 120) rgb = [x, chroma, 0]
  else if (hue < 180) rgb = [0, chroma, x]
  else if (hue < 240) rgb = [0, x, chroma]
  else if (hue < 300) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]
  return toHex({
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255
  })
}
