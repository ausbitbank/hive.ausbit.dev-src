import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRERENDER_ROUTES } from '../../scripts/lib/prerender-meta.mjs'

const CONFIG = readFileSync(
  resolve(import.meta.dirname, '../../deploy/nginx/hive.ausbit.dev.conf'),
  'utf8'
)

function locationBlocks (config) {
  const pattern = /location\s+(?:(?:=|~\*?|\^~)\s*)?([^\s{]+)\s*\{([^}]*)\}/g
  return [...config.matchAll(pattern)].map(match => ({
    pattern: match[1],
    body: match[2]
  }))
}

describe('nginx prerender coverage', () => {
  it('serves every prerendered route with its own metadata shell', () => {
    const blocks = locationBlocks(CONFIG)
    // `/` is served by the explicit `location = /` shell; `/404` is meant to
    // return a real 404 status.
    const exempt = new Set(['/', '/404'])
    const missing = PRERENDER_ROUTES
      .filter(route => !exempt.has(route))
      .filter(route => {
        const segment = route.split('/').filter(Boolean)[0]
        return !blocks.some(({ pattern, body }) => {
          if (!pattern.includes(segment)) return false
          return body.includes('$uri.html') || body.includes('/' + segment + '.html')
        })
      })

    expect(missing).toEqual([])
  })
})

describe('nginx cache policy', () => {
  it('revalidates the HTML shell so a deploy is picked up immediately', () => {
    expect(CONFIG).toContain('add_header Cache-Control $hive_cache_control always;')
    expect(CONFIG).toMatch(/map \$uri \$hive_cache_control \{/)
    expect(CONFIG).toMatch(/default\s+"no-cache"/)
  })

  it('marks content-hashed assets immutable', () => {
    expect(CONFIG).toMatch(/"~\^\/assets\/"\s+"public, max-age=31536000, immutable"/)
  })

  it('does not let expires directives emit a competing Cache-Control header', () => {
    expect(CONFIG).not.toMatch(/^\s*expires\s/m)
  })
})
