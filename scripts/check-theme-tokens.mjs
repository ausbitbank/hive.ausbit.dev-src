// Fail CI when a component style block introduces a raw hard-coded colour.
//
// Themes and the token fallback files are allowed to define colours. The

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

const SKIP_FILES = new Set([
  'src/css/tokens.scss',
  'src/css/quasar.variables.scss',
])
const SKIP_DIRS = new Set(['themes', 'statics', 'assets'])

// White is used deliberately for QR plinths and text over dark media scrims.
// It is a fixed visual constant, not a theme colour.
const ALLOWED = new Set(['#fff', '#ffffff'])

function styleBlocks (text) {
  return [...text.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n')
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

const violations = []
for (const file of await walk(SRC)) {
  const rel = relative(ROOT, file)
  if (SKIP_FILES.has(rel)) continue
  const raw = await readFile(file, 'utf8')
  const css = file.endsWith('.vue') ? styleBlocks(raw) : raw
  const lines = css.split('\n')
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
    for (const match of line.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
      const value = match[0].toLowerCase()
      if (ALLOWED.has(value)) continue
      violations.push({ file: rel, line: index + 1, value })
    }
  })
}

if (violations.length) {
  console.error('Raw colours found outside the theme token layer:')
  for (const item of violations) {
    console.error(`  ${item.file}:${item.line}  ${item.value}`)
  }
  console.error('\nUse a --c-* token. Add new primitives to src/themes and src/css/tokens.scss.')
  process.exit(1)
}

console.log('Theme token check: clean')
