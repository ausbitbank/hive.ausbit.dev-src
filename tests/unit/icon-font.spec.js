import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { extractIconNames } from '../../scripts/lib/icons.mjs'

const manifest = JSON.parse(readFileSync('src/data/material-icons.json', 'utf8'))

describe('Material Icons subset', () => {
  it('contains every icon name the app references', () => {
    const included = new Set(manifest.included)
    const used = extractIconNames(new Set(manifest.all), manifest.quasar)
    const missing = used.filter(name => !included.has(name))
    expect(missing, 'run `bun run icons:subset` to add new icons').toEqual([])
  })

  it('keeps the generated font small', () => {
    const bytes = statSync('public/statics/material-icons-subset.woff2').size
    expect(bytes).toBeLessThan(40 * 1024)
  })
})
