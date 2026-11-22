// One-off codemod: replace the hard-coded dark palette in style blocks with
// semantic theme variables. Run with `node scripts/theme-codemod.mjs`.
//
// Only <style> blocks and plain CSS/SCSS files are touched. Templates, scripts
// and inline JS colours are handled by hand.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const SKIP_DIRS = new Set(['themes', 'statics', 'assets'])
const SKIP_FILES = new Set([
  'src/css/tokens.scss',
  'src/css/quasar.variables.scss',
])

const HEX = new Map(Object.entries({
  '#78909c': 'var(--c-text-faint)',
  '#90a4ae': 'var(--c-text-subtle)',
  '#e4eaed': 'var(--c-text)',
  '#b0bec5': 'var(--c-text-muted)',
  '#4fc3f7': 'var(--c-link)',
  '#81d4fa': 'var(--c-link-hover)',
  '#cfd8dc': 'var(--c-text-soft)',
  '#ffcc80': 'var(--c-warning-soft)',
  '#ffb74d': 'var(--c-warning)',
  '#81c784': 'var(--c-positive)',
  '#a5d6a7': 'var(--c-positive)',
  '#ef9a9a': 'var(--c-negative)',
  '#e57373': 'var(--c-negative)',
  '#ffe082': 'var(--c-warning-soft)',
  '#607d8b': 'var(--c-text-faint)',
  '#e1f5fe': 'var(--c-link-soft)',
  '#b0a06a': 'var(--c-warning)',
  '#66bb6a': 'var(--c-positive)',
  '#ce93d8': 'var(--c-link-visited)',
  '#ef5350': 'var(--c-negative)',
  '#0b1d2a': 'var(--c-text-inverse)',
  '#ff8a80': 'var(--c-negative)',
  '#ffd54f': 'var(--c-focus)',
  '#e31337': 'var(--c-secondary)',
  '#c8e6c9': 'var(--c-positive-soft)',
  '#90caf9': 'var(--c-link)',
  '#54a5ff': 'var(--c-link)',
  '#546e7a': 'var(--c-text-faint)',
  '#3e92cc': 'var(--c-primary)',
  '#1d8ce0': 'var(--c-link)',
  '#ececec': 'var(--c-text)',
  '#9c27b0': 'var(--c-accent)',
  '#64b5f6': 'var(--c-link)',
  '#1a272d': 'var(--c-code-bg)',
  '#151c21': 'var(--c-surface)',
  '#131e23': 'var(--c-code-border)',
  '#0d1114': 'var(--c-bg)',
  '#121212': 'var(--c-bg)',
  '#10181d': 'var(--c-surface-2)',
  '#0d1419': 'var(--c-drawer)',
  '#0b1014': 'var(--c-bg-deep)',
  '#080d11': 'var(--c-bg-deep)',
  '#141a1f': 'var(--c-surface-3)',
  '#10161b': 'var(--c-bg-deep)',
  '#0f171c': 'var(--c-bg-deep)',
  '#0b1116': 'var(--c-bg-deep)',
  '#1d1d1d': 'var(--c-surface-1)',
  '#07131b': 'var(--c-bg-deep)',
  '#11181e': 'var(--c-surface-2)',
  '#131722': 'var(--c-bg-deep)',
  '#111': 'var(--c-bg-deep)',
  '#2e4558': 'var(--c-code-border)',
  '#ffab91': 'var(--c-warning-soft)',
  '#ffcdd2': 'var(--c-negative-soft)',
  '#fff3cd': 'var(--c-warning-soft)',
  '#f5f0e1': 'var(--c-warning-soft)',
  '#f1e7c8': 'var(--c-warning-soft)',
  '#f2c037': 'var(--c-warning)',
  '#ffc107': 'var(--c-warning)',
  '#e8f5e9': 'var(--c-positive-soft)',
  '#e3f2fd': 'var(--c-link-soft)',
  '#e1bee7': 'var(--c-accent-soft)',
  '#dfe6ea': 'var(--c-text-soft)',
  '#dde5e9': 'var(--c-text-soft)',
  '#dbe3e8': 'var(--c-text-soft)',
  '#c10015': 'var(--c-negative)',
  '#ba68c8': 'var(--c-accent)',
  '#b3e5fc': 'var(--c-link-soft)',
  '#a1887f': 'var(--c-warning)',
  '#9ecbe9': 'var(--c-link-soft)',
  '#884488': 'var(--c-accent)',
  '#80cbc4': 'var(--c-info)',
  '#4dd0e1': 'var(--c-info)',
  '#31ccec': 'var(--c-info)',
  '#2e7d32': 'var(--c-positive)',
  '#2a3942': 'var(--c-border)',
  '#26a69a': 'var(--c-positive)',
  '#21ba45': 'var(--c-positive)',
  '#1a2329': 'var(--c-surface-1)',
  '#0288d1': 'var(--c-info)'
}))

const unmappedHex = new Map()
const unmappedRgba = new Map()

function pct (alpha) {
  return Math.round(Number(alpha) * 100)
}

function near (r, g, b, target, tolerance = 12) {
  return Math.abs(r - target[0]) <= tolerance &&
    Math.abs(g - target[1]) <= tolerance &&
    Math.abs(b - target[2]) <= tolerance
}

function mapRgba (match, rRaw, gRaw, bRaw, aRaw) {
  const r = Number(rRaw)
  const g = Number(gRaw)
  const b = Number(bRaw)
  const alpha = Math.max(0, Math.min(1, Number(aRaw)))
  const p = pct(alpha)
  if (near(r, g, b, [255, 255, 255])) return `color-mix(in srgb, var(--c-text) ${p}%, transparent)`
  if (near(r, g, b, [0, 0, 0], 6)) return `color-mix(in srgb, var(--c-shadow) ${p}%, transparent)`
  if (near(r, g, b, [8, 13, 17]) || near(r, g, b, [4, 8, 12]) || near(r, g, b, [10, 10, 10]) || near(r, g, b, [18, 18, 18]) || near(r, g, b, [13, 17, 20])) {
    return `color-mix(in srgb, var(--c-bg-deep) ${p}%, transparent)`
  }
  if (near(r, g, b, [79, 195, 247]) || near(r, g, b, [129, 212, 250])) return `color-mix(in srgb, var(--c-link) ${p}%, transparent)`
  if (near(r, g, b, [227, 19, 55])) return `color-mix(in srgb, var(--c-secondary) ${p}%, transparent)`
  if (near(r, g, b, [129, 199, 132]) || near(r, g, b, [76, 175, 80]) || near(r, g, b, [102, 187, 106]) || near(r, g, b, [38, 166, 154])) {
    return `color-mix(in srgb, var(--c-positive) ${p}%, transparent)`
  }
  if (near(r, g, b, [239, 83, 80]) || near(r, g, b, [229, 115, 115]) || near(r, g, b, [244, 67, 54]) || near(r, g, b, [255, 138, 128])) {
    return `color-mix(in srgb, var(--c-negative) ${p}%, transparent)`
  }
  if (near(r, g, b, [255, 183, 77]) || near(r, g, b, [255, 213, 79]) || near(r, g, b, [255, 193, 7]) || near(r, g, b, [255, 152, 0]) || near(r, g, b, [255, 112, 67])) {
    return `color-mix(in srgb, var(--c-warning) ${p}%, transparent)`
  }
  if (near(r, g, b, [62, 146, 204])) return `color-mix(in srgb, var(--c-primary) ${p}%, transparent)`
  if (near(r, g, b, [186, 104, 200]) || near(r, g, b, [156, 39, 176])) return `color-mix(in srgb, var(--c-accent) ${p}%, transparent)`
  if (near(r, g, b, [0, 188, 212]) || near(r, g, b, [49, 204, 236])) return `color-mix(in srgb, var(--c-info) ${p}%, transparent)`
  if (near(r, g, b, [144, 164, 174])) return `color-mix(in srgb, var(--c-text-subtle) ${p}%, transparent)`
  return match
}

function transformCss (css) {
  return css.split('\n').map(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return line
    let next = line
    next = next.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/gi, (match, r, g, b, a) => {
      const mapped = mapRgba(match, r, g, b, a)
      if (mapped === match) {
        const key = `${r},${g},${b},${a}`
        unmappedRgba.set(key, (unmappedRgba.get(key) || 0) + 1)
      }
      return mapped
    })
    next = next.replace(/#[0-9a-f]{3,8}\b/gi, hex => {
      const lower = hex.toLowerCase()
      if (lower === '#fff' || lower === '#ffffff' || lower === '#000' || lower === '#000000' || lower === '#ffa') {
        unmappedHex.set(lower, (unmappedHex.get(lower) || 0) + 1)
        return hex
      }
      const mapped = HEX.get(lower)
      if (!mapped) {
        unmappedHex.set(lower, (unmappedHex.get(lower) || 0) + 1)
        return hex
      }
      return mapped
    })
    return next
  }).join('\n')
}

async function walk (dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      files.push(...await walk(join(dir, entry.name)))
    } else if (entry.isFile() && /\.(vue|scss|css)$/.test(entry.name)) {
      files.push(join(dir, entry.name))
    }
  }
  return files
}

let changed = 0
for (const file of await walk(SRC)) {
  const rel = relative(ROOT, file)
  if (SKIP_FILES.has(rel)) continue
  const original = await readFile(file, 'utf8')
  const next = file.endsWith('.vue')
    ? original.replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi, (match, attrs, body) => {
        return `<style${attrs || ''}>${transformCss(body)}</style>`
      })
    : transformCss(original)
  if (next !== original) {
    await writeFile(file, next)
    changed += 1
  }
}

console.log(`Updated ${changed} files`)
console.log('Unmapped hex:', [...unmappedHex.entries()].sort((a, b) => b[1] - a[1]))
console.log('Unmapped rgba:', [...unmappedRgba.entries()].sort((a, b) => b[1] - a[1]))
