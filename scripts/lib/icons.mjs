// Shared icon-name extraction for the Material Icons subset tooling.
//
// The app uses Material Icons ligatures (`<q-icon name="home">`). A subset
// font must contain every ligature the app can ask for, so both the generator
// and its guard test use this one extractor.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk (dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(vue|js)$/.test(name)) out.push(path)
  }
  return out
}

/**
 * Names in `known` that the app can reference as a Material icon.
 *
 * Covers literal icon names in source plus any extra names (Quasar's own
 * component icons) the caller supplies. Dynamic names built by concatenation
 * are intentionally unsupported; add an explicit literal if one is introduced.
 */
export function extractIconNames (known, extraNames = []) {
  const used = new Set()
  const literal = /(['"`])([a-zA-Z0-9_]+)\1/g
  for (const file of walk('src')) {
    const text = readFileSync(file, 'utf8')
    let match
    while ((match = literal.exec(text))) {
      if (known.has(match[2])) used.add(match[2])
    }
  }
  for (const name of extraNames) {
    if (known.has(name)) used.add(name)
  }
  return [...used].sort()
}
