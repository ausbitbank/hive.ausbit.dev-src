#!/usr/bin/env node
// Create or update the proxied wildcard A record for account blogs.
//
// The Wrangler OAuth token can deploy Workers and routes but cannot edit DNS,
// so this script takes a Cloudflare API token with Zone.DNS Edit:
//
//   CLOUDFLARE_API_TOKEN=... ORIGIN_IP=203.0.113.10 \
//     bun run cf:blog-dns --dry-run
//
// Required environment:
//   CLOUDFLARE_API_TOKEN  API token with Zone:Read + DNS:Edit
//   ORIGIN_IP             the nginx origin's public IPv4 address
//
// Optional:
//   CLOUDFLARE_ZONE_ID    skip the zone lookup
//   CLOUDFLARE_ZONE_NAME  defaults to banksia.io
//   DRY_RUN=1             same as --dry-run
//
// Get the origin address over SSH:
//   ssh hurgenburgen 'curl -s -4 https://ifconfig.me'
//
// Do not add this record before the origin presents a certificate valid for
// *.banksia.io and the vhost is applied: Cloudflare would return a TLS error
// for every blog host.

import { isValidIpv4, planRecordChange, wildcardRecord } from './lib/cloudflare-dns.mjs'

const API = 'https://api.cloudflare.com/client/v4'
const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || ''
const zoneName = process.env.CLOUDFLARE_ZONE_NAME || 'banksia.io'
const zoneIdEnv = process.env.CLOUDFLARE_ZONE_ID || ''
const originIp = process.env.ORIGIN_IP || ''
const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')

function fail (message) {
  console.error(message)
  process.exitCode = 1
}

async function api (path, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.success === false) {
    const detail = (body.errors || []).map(error => error.message).filter(Boolean).join('; ')
    throw new Error('Cloudflare API ' + response.status + ': ' + (detail || response.statusText))
  }
  return body.result
}

async function resolveZone () {
  if (zoneIdEnv) return zoneIdEnv
  const zones = await api('/zones?name=' + encodeURIComponent(zoneName))
  const zone = Array.isArray(zones) ? zones.find(item => item.name === zoneName) : null
  if (!zone) throw new Error('Zone not found: ' + zoneName)
  return zone.id
}

async function main () {
  if (!token) {
    return fail('Set CLOUDFLARE_API_TOKEN (Zone:Read + DNS:Edit) before running this script.')
  }
  if (!isValidIpv4(originIp)) {
    return fail('Set ORIGIN_IP to the nginx origin IPv4 address. Example:\n  ssh hurgenburgen \'curl -s -4 https://ifconfig.me\'')
  }

  const desired = wildcardRecord(originIp, zoneName)
  const zoneId = await resolveZone()
  const records = await api('/zones/' + zoneId + '/dns_records?name=' + encodeURIComponent(desired.name))
  const existing = Array.isArray(records) ? records.find(record => record.type === 'A') : null
  const plan = planRecordChange(existing, desired)

  if (plan.action === 'none') {
    console.log(JSON.stringify({ action: 'none', name: desired.name, content: desired.content, proxied: true }))
    return
  }

  if (dryRun) {
    console.log(JSON.stringify({ action: plan.action, name: desired.name, content: desired.content, proxied: true, dryRun: true }))
    return
  }

  const payload = JSON.stringify(plan.record)
  const result = plan.action === 'create'
    ? await api('/zones/' + zoneId + '/dns_records', { method: 'POST', body: payload })
    : await api('/zones/' + zoneId + '/dns_records/' + plan.id, { method: 'PATCH', body: payload })

  console.log(JSON.stringify({
    action: plan.action,
    id: result && result.id,
    name: result && result.name,
    type: result && result.type,
    content: result && result.content,
    proxied: result && result.proxied
  }))
}

main().catch(error => fail(error.message))
