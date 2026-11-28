#!/usr/bin/env node
// Read-only contract check for the v4v.app Hive <-> Lightning bridge.
//
// This is the regression alarm for the integration constraints that live
// outside our control: the CORS allowlist for https://banksia.io, the
// shape of GET /v1, and the public quote/address endpoints. It never creates an
// invoice, authenticates, or writes anything.
//
// Run manually with `node scripts/v4vapp-contract-check.mjs`. CI runs it daily.
// A red run usually means the production origin fell off v4v.app's allowlist or
// the single-maintainer API drifted.

const API = (process.env.V4VAPP_API || 'https://api.v4v.app').replace(/\/+$/, '')
import { BRAND } from '../src/config/brand.js'

const ORIGIN = process.env.V4VAPP_ORIGIN || BRAND.url
const TIMEOUT_MS = 15000

const failures = []
let checks = 0

function pass (name, detail = '') {
  checks += 1
  console.log('  ok   ' + name + (detail ? ' — ' + detail : ''))
}

function fail (name, detail) {
  checks += 1
  failures.push({ name, detail })
  console.log('  FAIL ' + name + ' — ' + detail)
}

function assert (name, condition, detail) {
  if (condition) pass(name, typeof detail === 'string' ? detail : '')
  else fail(name, detail || 'assertion failed')
}

async function call (path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(API + path, {
    method,
    headers: {
      origin: ORIGIN,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // Keep the raw body for the failure message.
  }
  return { response, text, json }
}

function checkCors (name, response) {
  const allowOrigin = response.headers.get('access-control-allow-origin')
  const allowCredentials = response.headers.get('access-control-allow-credentials')
  assert(name + ': CORS origin', allowOrigin === ORIGIN, allowOrigin
    ? 'got ' + allowOrigin
    : 'no access-control-allow-origin header')
  assert(name + ': credentials flag', allowCredentials === 'true', allowCredentials || 'missing')
  if (allowOrigin === '*') fail(name + ': wildcard origin', 'credentials plus * is rejected by browsers')
}

function isFinitePositive (value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

async function main () {
  console.log('v4vapp contract check')
  console.log('  api     ' + API)
  console.log('  origin  ' + ORIGIN)

  // A POST preflight is the one thing that silently breaks when an allowlist
  // entry is removed: simple GETs can still work while invoice creation fails.
  {
    const { response } = await call('/v1/check_invoice', {
      method: 'OPTIONS',
      headers: {
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    })
    const allowMethods = response.headers.get('access-control-allow-methods') || ''
    const allowHeaders = (response.headers.get('access-control-allow-headers') || '').toLowerCase()
    assert('preflight status', response.status >= 200 && response.status < 300, String(response.status))
    checkCors('preflight', response)
    assert('preflight allows POST', /post/i.test(allowMethods), allowMethods || 'missing')
    assert('preflight allows content-type', allowHeaders.includes('content-type'), allowHeaders || 'missing')
  }

  // Authenticated keepsats endpoints need Authorization in the preflight.
  {
    const { response } = await call('/v2/v4vapp/keepsats', {
      method: 'OPTIONS',
      headers: {
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization'
      }
    })
    const allowHeaders = (response.headers.get('access-control-allow-headers') || '').toLowerCase()
    assert('keepsats preflight status', response.status >= 200 && response.status < 300, String(response.status))
    assert('keepsats preflight allows Authorization', allowHeaders.includes('authorization'), allowHeaders || 'missing')
  }

  // Status and live fee/limit config.
  {
    const { response, json } = await call('/v1')
    assert('GET /v1 status', response.status === 200, String(response.status))
    checkCors('GET /v1', response)
    assert('GET /v1 is JSON', Boolean(json && typeof json === 'object'), json ? '' : 'unreadable body')
    assert('bridge is alive', json?.message === 'alive', String(json?.message || 'missing message'))
    assert('API version is semver', /^\d+\.\d+\.\d+$/.test(String(json?.version || '')), String(json?.version || 'missing'))

    const config = json?.config || {}
    assert('config.conv_fee_percent sane',
      Number(config.conv_fee_percent) > 0 && Number(config.conv_fee_percent) <= 1,
      String(config.conv_fee_percent))
    assert('config.conv_fee_sats sane', Number(config.conv_fee_sats) >= 0, String(config.conv_fee_sats))
    assert('invoice maximum sane', isFinitePositive(config.maximum_invoice_payment_sats),
      String(config.maximum_invoice_payment_sats))
    assert('rate limits present', Array.isArray(config.lightning_rate_limits) && config.lightning_rate_limits.length > 0,
      String(config.lightning_rate_limits?.length ?? 'missing'))
  }

  // Quote feed used by the pay dialog.
  {
    const { response, json } = await call('/v1/cryptoprices/')
    assert('GET /v1/cryptoprices/ status', response.status === 200, String(response.status))
    checkCors('GET /v1/cryptoprices/', response)
    assert('bitcoin price present', isFinitePositive(json?.bitcoin?.usd), String(json?.bitcoin?.usd))
    assert('hive price present', isFinitePositive(json?.hive?.btc) || isFinitePositive(json?.hive?.usd),
      JSON.stringify(json?.hive || null))
  }

  // Address derivation used by every profile and tip card.
  {
    const { response, json } = await call('/v1/lnurlp/bech32/ausbitbank')
    assert('GET /v1/lnurlp/bech32 status', response.status === 200, String(response.status))
    checkCors('GET /v1/lnurlp/bech32', response)
    assert('LNURL payload present', /^lnurl1/i.test(String(json?.bech32 || '')),
      String(json?.bech32 || 'missing bech32'))
  }

  // Address -> invoice resolution used before queuing a Lightning address.
  // Only the read-only info call: the callback proxy would create an invoice.
  {
    const { response, json } = await call('/v1/lnurlp/proxy/', {
      method: 'POST',
      body: { anything: 'brianoflondon@v4v.app' }
    })
    assert('POST /v1/lnurlp/proxy status', response.status === 200, String(response.status))
    checkCors('POST /v1/lnurlp/proxy', response)
    assert('LNURL proxy is a payRequest', json?.tag === 'payRequest',
      String(json?.tag || 'missing tag'))
    assert('LNURL proxy amount range',
      isFinitePositive(json?.minSendable) && isFinitePositive(json?.maxSendable),
      JSON.stringify({ minSendable: json?.minSendable, maxSendable: json?.maxSendable }))
  }

  // Status polling uses POST because the r_hash is base64. Use an unknown hash
  // of the right size: this proves POST works without creating anything.
  {
    const unknownHash = Buffer.alloc(32).toString('base64')
    const { response, json } = await call('/v1/check_invoice', {
      method: 'POST',
      body: { r_hash: unknownHash }
    })
    assert('POST /v1/check_invoice status', response.status === 200, String(response.status))
    checkCors('POST /v1/check_invoice', response)
    assert('invoice status shape', json &&
      typeof json.paid === 'boolean' &&
      typeof json.settled === 'boolean' &&
      typeof json.expired === 'boolean',
    json ? JSON.stringify(json).slice(0, 120) : 'unreadable body')
  }

  console.log('')
  console.log(checks + ' checks, ' + failures.length + ' failure' + (failures.length === 1 ? '' : 's'))
  if (failures.length) {
    console.log('')
    console.log('If the CORS checks failed, ' + ORIGIN + ' may have fallen off the v4v.app allowlist.')
    console.log('Keep the degraded UI in place and ask the bridge operator to re-check the entry.')
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error('')
  console.error('Contract check crashed: ' + (error?.message || error))
  process.exitCode = 1
})
