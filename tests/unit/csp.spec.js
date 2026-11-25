import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file) => readFileSync(root + '/' + file, 'utf8')

describe('CSP and inline-script discipline', () => {
  it('keeps executable inline scripts out of index.html', () => {
    const html = read('index.html')
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs))
      // JSON data blocks are not executable and are not governed by script-src.
      .filter(([, attrs]) => !/\btype\s*=\s*["']?application\/(?:ld\+)?json/i.test(attrs))

    expect(inline.map(([, , body]) => body.trim().slice(0, 40))).toEqual([])
  })

  it('ships the pre-paint theme bootstrap as an external file', () => {
    const html = read('index.html')

    expect(html).toContain('src="/statics/boot-theme.js"')
    expect(existsSync(root + '/public/statics/boot-theme.js')).toBe(true)
  })

  it.each([
    'deploy/nginx/hive.ausbit.dev.conf',
    'docs/SECURITY.md'
  ])('forbids inline script in %s', (file) => {
    const text = read(file)
    const directive = text.match(/script-src\s+([^;"]+)/)

    expect(directive).not.toBeNull()
    expect(directive[1]).not.toContain("'unsafe-inline'")
    expect(text).toContain("script-src-attr 'none'")
  })
})
