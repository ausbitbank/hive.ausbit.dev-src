#!/usr/bin/env node
// Keep deploy/nginx/cloudflare-realip.conf in sync with Cloudflare's published
// edge ranges. Stale ranges mean either lost visitor IPs or, worse, trusting a
// forwarding header from an address Cloudflare no longer owns.

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SOURCES = [
  ['IPv4', 'https://www.cloudflare.com/ips-v4'],
  ['IPv6', 'https://www.cloudflare.com/ips-v6']
]
const target = resolve(process.cwd(), 'deploy/nginx/cloudflare-realip.conf')

const fetchRanges = async (family, url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  const ranges = (await res.text())
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (!ranges.length) throw new Error(`${url} returned no ranges`)
  for (const range of ranges) {
    if (!/^[0-9a-f:.]+\/\d+$/i.test(range)) throw new Error(`Unexpected ${family} range: ${range}`)
  }
  return ranges
}

const [ipv4, ipv6] = await Promise.all(SOURCES.map(([family, url]) => fetchRanges(family, url)))
const block = (family, ranges) => `# ${family}\n` + ranges.map(range => `set_real_ip_from ${range};`).join('\n')

const conf = `# Cloudflare edge ranges.
#
# Trust CF-Connecting-IP only when the connection itself comes from one of
# these addresses, so a client hitting the origin directly cannot spoof its
# IP. Included by deploy/nginx/hive.ausbit.dev.conf.
#
# Source: https://www.cloudflare.com/ips-v4 and /ips-v6
# Regenerate with: node scripts/refresh-cloudflare-ips.mjs
# Generated: ${new Date().toISOString().slice(0, 10)}

${block('IPv4', ipv4)}

${block('IPv6', ipv6)}

real_ip_header CF-Connecting-IP;
real_ip_recursive on;
`

await writeFile(target, conf, 'utf8')
console.log(`Wrote ${ipv4.length} IPv4 and ${ipv6.length} IPv6 ranges to deploy/nginx/cloudflare-realip.conf.`)
console.log('Copy it to /etc/nginx/cloudflare-realip.conf and run `nginx -t && systemctl reload nginx`.')
