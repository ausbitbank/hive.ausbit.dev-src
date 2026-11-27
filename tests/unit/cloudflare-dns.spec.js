import { describe, expect, it } from 'vitest'
import { isValidIpv4, planRecordChange, recordMatches, wildcardRecord } from '../../scripts/lib/cloudflare-dns.mjs'

describe('Cloudflare blog DNS helpers', () => {
  it('accepts only a valid IPv4 address', () => {
    expect(isValidIpv4('185.130.44.77')).toBe(true)
    expect(isValidIpv4('0.0.0.0')).toBe(true)
    expect(isValidIpv4('255.255.255.255')).toBe(true)
    expect(isValidIpv4('256.1.1.1')).toBe(false)
    expect(isValidIpv4('1.2.3')).toBe(false)
    expect(isValidIpv4('2001:db8::1')).toBe(false)
    expect(isValidIpv4('')).toBe(false)
  })

  it('builds a proxied wildcard A record', () => {
    expect(wildcardRecord('185.130.44.77', 'banksia.io')).toMatchObject({
      type: 'A',
      name: '*.banksia.io',
      content: '185.130.44.77',
      proxied: true,
      ttl: 1
    })
    expect(() => wildcardRecord('not-an-ip')).toThrow(/IPv4/)
  })

  it('compares the fields that matter, not the TTL representation', () => {
    const desired = wildcardRecord('185.130.44.77')
    expect(recordMatches({ ...desired, id: 'x', ttl: 300 }, desired)).toBe(true)
    expect(recordMatches({ ...desired, proxied: false }, desired)).toBe(false)
    expect(recordMatches({ ...desired, content: '203.0.113.10' }, desired)).toBe(false)
    expect(recordMatches({ ...desired, name: '*.example.com' }, desired)).toBe(false)
    expect(recordMatches(null, desired)).toBe(false)
  })

  it('plans create, no-op and update', () => {
    const desired = wildcardRecord('185.130.44.77')
    expect(planRecordChange(null, desired)).toEqual({ action: 'create', record: desired })
    expect(planRecordChange({ ...desired, id: 'abc' }, desired)).toMatchObject({ action: 'none', id: 'abc' })
    expect(planRecordChange({ ...desired, id: 'abc', content: '203.0.113.10' }, desired))
      .toMatchObject({ action: 'update', id: 'abc' })
  })
})
