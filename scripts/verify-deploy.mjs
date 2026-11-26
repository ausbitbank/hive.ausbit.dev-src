#!/usr/bin/env node
//
// Post-deploy gate: assert the security headers are live and that a memo-style
// inline event handler cannot run. Runs against the edge, then falls back to
// the origin when Cloudflare challenges the headless browser.
//
//   node scripts/verify-deploy.mjs
//   VERIFY_URL=... VERIFY_ORIGIN_IP=... node scripts/verify-deploy.mjs
//   VERIFY_SKIP=1 node scripts/verify-deploy.mjs
//
import { pathToFileURL } from 'node:url'

import { BRAND } from '../src/config/brand.js'
import { PRERENDER_ROUTES } from './lib/prerender-meta.mjs'

const DEFAULT_URL = BRAND.url + '/'
const REQUIRED = [
  [/default-src\s+'self'/, "default-src 'self'"],
  [/script-src-attr\s+'none'/, "script-src-attr 'none'"],
  [/object-src\s+'none'/, "object-src 'none'"],
  [/base-uri\s+'self'/, "base-uri 'self'"],
  [/frame-ancestors\s+'none'/, "frame-ancestors 'none'"]
]

export function checkCspHeader (value) {
  if (!value) return ['missing Content-Security-Policy header']
  const problems = []
  for (const [pattern, label] of REQUIRED) {
    if (!pattern.test(value)) problems.push('missing ' + label)
  }
  return problems
}

function warn (message) {
  console.warn('verify: ' + message)
}

async function edgeHeaders (url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      accept: 'text/html',
      'user-agent': 'Mozilla/5.0 (compatible; hive-ausbit-deploy-check)'
    },
    signal: AbortSignal.timeout(15000)
  })
  return {
    status: response.status,
    csp: response.headers.get('content-security-policy'),
    challenge: response.headers.get('cf-mitigated')
  }
}

/**
 * Every prerendered route must resolve without a redirect loop. A docroot
 * directory whose name matches a route (join/, create/, …) makes nginx answer
 * /path with 301 /path/, which the no-trailing-slash rule sends straight back;
 * the browser then shows "page isn't redirecting properly". The nginx vhost
 * needs an explicit location for each of those directories, and a stale vhost
 * is otherwise invisible to the rest of this check.
 */
async function routeCheck (baseUrl) {
  const problems = []
  for (const route of PRERENDER_ROUTES) {
    if (route === '/404') continue
    const target = new URL(route, baseUrl).toString()
    try {
      const response = await fetch(target, {
        redirect: 'follow',
        headers: {
          accept: 'text/html',
          'user-agent': 'Mozilla/5.0 (compatible; hive-ausbit-deploy-check)'
        },
        signal: AbortSignal.timeout(15000)
      })
      await response.body?.cancel()
      if (response.status === 403 || response.status === 503) {
        if (response.headers.get('cf-mitigated')) {
          warn('edge challenged the route check; skipping remaining routes')
          return problems
        }
      }
      if (response.status >= 400) {
        problems.push(route + ' returned HTTP ' + response.status)
      }
    } catch (error) {
      const message = String(error?.message || error)
      const cause = String(error?.cause?.message || '')
      if (/redirect/i.test(message + ' ' + cause)) {
        problems.push(route + ' is a redirect loop (check the nginx vhost)')
      } else {
        problems.push(route + ': ' + message)
      }
    }
  }
  return problems
}

async function browserCheck ({ url, originIp }) {
  const { chromium } = await import('@playwright/test')
  const host = new URL(url).hostname
  const args = ['--no-sandbox']
  if (originIp) args.push('--host-resolver-rules=MAP ' + host + ' ' + originIp)

  const browser = await chromium.launch({ headless: true, args })
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: Boolean(originIp),
      viewport: { width: 1280, height: 900 }
    })
    const page = await context.newPage()
    const pageErrors = []
    const consoleErrors = []
    page.on('pageerror', error => pageErrors.push(String(error)))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    if (!response) throw new Error('no response')

    const headers = response.headers()
    if (response.status() >= 400) {
      const error = new Error('HTTP ' + response.status())
      error.challenge = Boolean(headers['cf-mitigated'])
      throw error
    }

    await page.waitForFunction(
      () => (document.querySelector('#q-app')?.children.length || 0) > 0,
      null,
      { timeout: 25000 }
    )

    const executed = await page.evaluate(async () => {
      window.__cspProbe = 0
      const img = document.createElement('img')
      img.setAttribute('onerror', 'window.__cspProbe += 1')
      img.src = '/__deploy_check_missing__'
      document.body.appendChild(img)
      await new Promise(resolve => setTimeout(resolve, 600))
      return window.__cspProbe
    })

    return {
      status: response.status(),
      cspProblems: checkCspHeader(headers['content-security-policy'] || ''),
      executed,
      pageErrors,
      cspViolations: consoleErrors.filter(message =>
        /Content Security Policy/i.test(message) &&
        !/Executing inline event handler violates/i.test(message)
      ),
      otherErrors: consoleErrors.filter(message =>
        !/Executing inline event handler violates|Failed to load resource|net::ERR_ABORTED/i.test(message)
      )
    }
  } finally {
    await browser.close()
  }
}

async function main () {
  if (process.env.VERIFY_SKIP === '1') {
    warn('skipped by VERIFY_SKIP=1')
    return
  }

  const url = process.env.VERIFY_URL || DEFAULT_URL
  const originIp = process.env.VERIFY_ORIGIN_IP || ''
  const failures = []

  // The legacy subdomain must keep working. A 200 means the app is still
  // served there; 301/308 is accepted if the host is later redirected.
  try {
    const legacy = await fetch(BRAND.legacyUrl + '/', {
      redirect: 'manual',
      headers: { 'user-agent': 'Banksia deploy check' }
    })
    if (![200, 301, 302, 307, 308].includes(legacy.status)) {
      failures.push('legacy host ' + BRAND.legacyHost + ' returned HTTP ' + legacy.status)
    }
  } catch (error) {
    warn('legacy host check failed: ' + error.message)
  }

  try {
    const edge = await edgeHeaders(url)
    if (edge.status >= 500) {
      failures.push('edge returned HTTP ' + edge.status)
    } else if (edge.challenge) {
      warn('edge returned a Cloudflare challenge; edge header check skipped')
    } else {
      const problems = checkCspHeader(edge.csp || '')
      if (problems.length) failures.push('edge CSP: ' + problems.join(', '))
    }
  } catch (error) {
    warn('edge fetch failed: ' + error.message)
  }

  try {
    for (const problem of await routeCheck(url)) failures.push(problem)
  } catch (error) {
    warn('route check failed: ' + error.message)
  }

  let result
  let mode = 'edge'
  try {
    result = await browserCheck({ url })
  } catch (error) {
    if (!originIp) throw error
    warn('edge browser check failed (' + error.message + '), retrying origin ' + originIp)
    mode = 'origin'
    result = await browserCheck({ url, originIp })
  }

  if (result.cspProblems.length) failures.push(mode + ' CSP: ' + result.cspProblems.join(', '))
  if (result.executed > 0) failures.push('inline event handler executed (' + result.executed + ')')
  if (result.pageErrors.length) failures.push('page errors: ' + result.pageErrors.slice(0, 3).join(' | '))
  if (result.cspViolations.length) failures.push('unexpected CSP violations: ' + result.cspViolations.slice(0, 2).join(' | '))

  if (result.otherErrors.length) {
    warn(result.otherErrors.length + ' non-CSP console error(s), first: ' + result.otherErrors[0])
  }

  if (failures.length) {
    console.error('Deploy verification FAILED (' + mode + ')')
    for (const failure of failures) console.error('  - ' + failure)
    process.exitCode = 1
    return
  }

  console.log('Deploy verification passed (' + mode + ')')
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((error) => {
    console.error('Deploy verification error:', error)
    process.exitCode = 1
  })
}
