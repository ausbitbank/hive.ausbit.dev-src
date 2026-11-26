import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkCspHeader } from '../../scripts/verify-deploy.mjs'

const policy = readFileSync('deploy/nginx/banksia.io.conf', 'utf8')
  .match(/Content-Security-Policy "([^"]+)"/)[1]

describe('deploy CSP check', () => {
  it('accepts the canonical policy', () => {
    expect(checkCspHeader(policy)).toEqual([])
  })

  it('flags a missing header', () => {
    expect(checkCspHeader(null)).toEqual(['missing Content-Security-Policy header'])
    expect(checkCspHeader('')).not.toHaveLength(0)
  })

  it('flags a policy that allows inline event handlers', () => {
    const withoutAttr = policy.replace(/\s*;\s*script-src-attr 'none'/, '')

    expect(withoutAttr).not.toContain("script-src-attr")
    expect(checkCspHeader(withoutAttr)).toContain("missing script-src-attr 'none'")
  })

  it('flags a policy that allows framing or plugins', () => {
    const weak = policy
      .replace(/frame-ancestors\s+'none'/, "frame-ancestors *")
      .replace(/object-src\s+'none'/, "object-src *")

    expect(checkCspHeader(weak)).toEqual(
      expect.arrayContaining(["missing object-src 'none'", "missing frame-ancestors 'none'"])
    )
  })
})
