#!/usr/bin/env node
// Regenerate the subsetted Material Icons font.
//
// The app only needs the ligatures it actually references. The full Quasar
// font is ~128 KB; the subset is ~21 KB. Run this after adding a new icon:
//
//   bun run icons:subset
//
// Requires fonttools (`pip install fonttools brotli`) on PATH.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import quasarIcons from 'quasar/icon-set/material-icons.js'
import { extractIconNames } from './lib/icons.mjs'

function collectStrings (value, out) {
  if (typeof value === 'string') {
    out.add(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
}

const ROOT = process.cwd()
// Vendored from @quasar/extras so the app no longer depends on the 36 MB
// package at runtime or build time. See material-icons-LICENSE.txt.
const SOURCE_FONT = join(ROOT, 'scripts/assets/material-icons-full.woff2')
const OUTPUT_FONT = join(ROOT, 'public/statics/material-icons-subset.woff2')
const MANIFEST = join(ROOT, 'src/data/material-icons.json')

const work = mkdtempSync(join(tmpdir(), 'hive-icons-'))
try {
  const namesFile = join(work, 'names.txt')
  const mapFile = join(work, 'glyphs.json')
  const allFile = join(work, 'all.json')

  // Read the ligature table (name -> glyph). fonttools is the only reliable
  // way to do this without shipping a font parser.
  const python = `
import json, sys
from fontTools.ttLib import TTFont
font_path, names_path, map_path, all_path = sys.argv[1:5]
font = TTFont(font_path)
reverse = {}
for cp, glyph in font.getBestCmap().items():
    reverse.setdefault(glyph, cp)
ligatures = {}
for lookup in font['GSUB'].table.LookupList.Lookup:
    if lookup.LookupType != 4:
        continue
    for subtable in lookup.SubTable:
        for first, items in subtable.ligatures.items():
            for ligature in items:
                parts = [first] + list(ligature.Component)
                name = ''.join(chr(reverse.get(g, 0xfffd)) for g in parts)
                ligatures[name] = ligature.LigGlyph
names = [line.strip() for line in open(names_path) if line.strip()]
json.dump({name: ligatures.get(name) for name in names}, open(map_path, 'w'))
json.dump(sorted(ligatures), open(all_path, 'w'))
`
  // First pass: discover the full name list, then extract what source uses.
  writeFileSync(namesFile, '')
  execFileSync('python3', ['-c', python, SOURCE_FONT, namesFile, mapFile, allFile])
  const all = JSON.parse(readFileSync(allFile, 'utf8'))
  const allSet = new Set(all)
  const quasar = new Set()
  collectStrings(quasarIcons, quasar)
  const quasarNames = [...quasar].filter(name => allSet.has(name)).sort()
  const used = extractIconNames(allSet, quasarNames)
  writeFileSync(namesFile, used.join('\n') + '\n')
  execFileSync('python3', ['-c', python, SOURCE_FONT, namesFile, mapFile, allFile])
  const glyphs = JSON.parse(readFileSync(mapFile, 'utf8'))
  const missing = used.filter(name => !glyphs[name])
  if (missing.length) throw new Error('No glyph for: ' + missing.join(', '))

  execFileSync('pyftsubset', [
    SOURCE_FONT,
    '--output-file=' + OUTPUT_FONT,
    '--flavor=woff2',
    '--text-file=' + namesFile,
    '--glyphs=' + used.map(name => glyphs[name]).join(','),
    '--layout-features=*',
    '--no-layout-closure',
    '--notdef-outline',
    '--name-IDs=*',
    '--name-languages=*'
  ], { stdio: 'inherit' })

  writeFileSync(MANIFEST, JSON.stringify({ all, quasar: quasarNames, included: used }, null, 2) + '\n')

  const before = readFileSync(SOURCE_FONT).length
  const after = readFileSync(OUTPUT_FONT).length
  console.log(`Subset ${used.length} icons: ${before} -> ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller)`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
