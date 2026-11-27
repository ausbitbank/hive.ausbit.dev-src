// Pure helpers for the Cloudflare blog DNS setup script.

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

export function isValidIpv4 (value) {
  return typeof value === 'string' && IPV4_RE.test(value.trim())
}

/** The proxied wildcard A record that makes `<account>.banksia.io` resolve. */
export function wildcardRecord (originIp, zoneName = 'banksia.io') {
  const ip = String(originIp || '').trim()
  if (!isValidIpv4(ip)) throw new Error('A valid IPv4 origin address is required')
  const zone = String(zoneName || 'banksia.io').trim().toLowerCase().replace(/\.$/, '')
  return {
    type: 'A',
    name: '*.' + zone,
    content: ip,
    proxied: true,
    ttl: 1,
    comment: 'Banksia account blogs'
  }
}

export function recordMatches (existing, desired) {
  if (!existing || !desired) return false
  return existing.type === desired.type &&
    String(existing.name || '').toLowerCase() === String(desired.name || '').toLowerCase() &&
    existing.content === desired.content &&
    existing.proxied === desired.proxied
}

/**
 * Decide whether to create, update or leave the wildcard record alone.
 * Cloudflare returns `ttl: 1` for "Auto", so TTL is deliberately not compared.
 */
export function planRecordChange (existing, desired) {
  if (!existing) return { action: 'create', record: desired }
  if (recordMatches(existing, desired)) return { action: 'none', record: desired, id: existing.id }
  return { action: 'update', id: existing.id, record: desired }
}
