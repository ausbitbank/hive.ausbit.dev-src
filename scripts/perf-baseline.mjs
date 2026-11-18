#!/usr/bin/env node
// Repeatable performance baseline and CI budget check.
//
// Serves the production build with Brotli/gzip compression and records Core
// Web Vitals plus encoded transfer sizes for the main explorer routes.
//
// Usage:
//   node scripts/perf-baseline.mjs [--label W22-before] [--check]
//
// `--check` compares the current run with docs/performance/budgets.json and
// exits non-zero on a regression. The default mode writes latest.json,
// history.jsonl and the generated dashboard.

import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const ROOT = resolve(process.cwd())
const DIST = resolve(ROOT, 'dist/spa')
const PERF_DIR = resolve(ROOT, 'docs/performance')
const PORT = Number(process.env.PERF_PORT) || 4191
const BASE = 'http://127.0.0.1:' + PORT
const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const labelArg = args.find(arg => arg.startsWith('--label='))
const LABEL = labelArg ? labelArg.slice('--label='.length) : (CHECK ? 'ci-check' : 'local')
const POST = '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'
const ROUTES = ['/', '/browse', '/block/1', POST, '/@ausbitbank/wallet', '/market']
const ROUTE_NAMES = {
  '/': 'Home',
  '/browse': 'Browse',
  '/block/1': 'Block 1',
  [POST]: 'Post',
  '/@ausbitbank/wallet': 'Wallet',
  '/market': 'Internal market'
}

function commit () {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function kb (bytes) {
  return Math.round((Number(bytes) || 0) / 1024 * 10) / 10
}

async function waitForServer () {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(BASE + '/')
      if (response.ok) return true
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return false
}

async function initialAssetSet () {
  const html = await readFile(resolve(DIST, 'index.html'), 'utf8')
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1])
  return new Set(assets.map(asset => asset.split('?')[0]))
}

async function bundleSnapshot () {
  const { readdir, stat } = await import('node:fs/promises')
  const files = await readdir(resolve(DIST, 'assets'))
  const rows = []
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue
    const path = resolve(DIST, 'assets', file)
    const body = await readFile(path)
    rows.push({
      file,
      rawBytes: (await stat(path)).size,
      gzipBytes: gzipSync(body, { level: 9 }).length,
      brotliBytes: brotliCompressSync(body).length
    })
  }
  const initial = await initialAssetSet()
  let initialRaw = 0
  let initialGzip = 0
  let initialBrotli = 0
  for (const row of rows) {
    if (!initial.has('/assets/' + row.file)) continue
    initialRaw += row.rawBytes
    initialGzip += row.gzipBytes
    initialBrotli += row.brotliBytes
  }
  return {
    initial: { rawKb: kb(initialRaw), gzipKb: kb(initialGzip), brotliKb: kb(initialBrotli) },
    largest: rows.sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 12).map(row => ({
      file: row.file,
      rawKb: kb(row.rawBytes),
      gzipKb: kb(row.gzipBytes),
      brotliKb: kb(row.brotliBytes)
    }))
  }
}

async function measureRoute (browser, route, initialAssets) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block'
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__perfLcp = 0
    window.__perfCls = 0
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__perfLcp = Math.max(window.__perfLcp, entry.startTime)
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__perfCls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => Boolean(document.querySelector('#q-app')?.__vue_app__), null, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(4500)

    const data = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {}
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      const resources = performance.getEntriesByType('resource')
      const assets = resources.map(entry => ({
        name: entry.name.split('?')[0],
        path: (() => {
          try { return new URL(entry.name).pathname } catch { return entry.name }
        })(),
        encoded: entry.encodedBodySize || entry.transferSize || 0,
        duration: entry.duration
      }))
      const isJs = asset => /\.js$/.test(asset.path)
      const isCss = asset => /\.css$/.test(asset.path)
      const isFont = asset => /\.(woff2?|ttf)$/.test(asset.path)
      const isImage = asset => /\.(png|jpe?g|webp|svg|ico)$/.test(asset.path)
      const sum = predicate => assets.filter(predicate).reduce((total, asset) => total + asset.encoded, 0)
      return {
        timings: {
          ttfbMs: Math.round(nav.responseStart || 0),
          dclMs: Math.round(nav.domContentLoadedEventEnd || 0),
          loadMs: Math.round(nav.loadEventEnd || 0),
          fcpMs: Math.round(fcp?.startTime || 0),
          lcpMs: Math.round(window.__perfLcp || 0),
          cls: Math.round((window.__perfCls || 0) * 1000) / 1000
        },
        bytes: {
          js: sum(isJs),
          css: sum(isCss),
          fonts: sum(isFont),
          images: sum(isImage),
          total: sum(() => true)
        },
        resources: assets,
        requests: {
          total: assets.length,
          scripts: assets.filter(isJs).length,
          thirdParty: assets.filter(asset => !asset.path.startsWith('/assets/') && !asset.path.startsWith('/statics/')).length
        }
      }
    })

    const initial = data.resources.filter(asset => initialAssets.has(asset.path))
    const initialJs = initial.filter(asset => /\.js$/.test(asset.path)).reduce((total, asset) => total + asset.encoded, 0)
    const initialCss = initial.filter(asset => /\.css$/.test(asset.path)).reduce((total, asset) => total + asset.encoded, 0)
    const routeJs = data.resources
      .filter(asset => /\.js$/.test(asset.path) && !initialAssets.has(asset.path))
      .reduce((total, asset) => total + asset.encoded, 0)

    return {
      route,
      name: ROUTE_NAMES[route] || route,
      ...data.timings,
      initialJsKb: kb(initialJs),
      initialCssKb: kb(initialCss),
      routeJsKb: kb(routeJs),
      jsKb: kb(data.bytes.js),
      cssKb: kb(data.bytes.css),
      fontKb: kb(data.bytes.fonts),
      imageKb: kb(data.bytes.images),
      totalKb: kb(data.bytes.total),
      requests: data.requests.total,
      scriptRequests: data.requests.scripts,
      thirdPartyRequests: data.requests.thirdParty
    }
  } finally {
    await context.close()
  }
}

function readBudgets () {
  return readFile(resolve(PERF_DIR, 'budgets.json'), 'utf8')
    .then(text => JSON.parse(text))
    .catch(() => null)
}

function checkBudgets (result, budgets) {
  if (!budgets) return []
  const failures = []
  const limitFor = (route, key) => {
    const routeBudget = budgets.routes?.[route] || {}
    return routeBudget[key] ?? budgets[key]
  }
  for (const route of result.routes) {
    const checks = [
      ['initialJsKb', 'initial JS'],
      ['routeJsKb', 'route JS'],
      ['jsKb', 'total JS'],
      ['cssKb', 'CSS'],
      ['totalKb', 'total transfer'],
      ['lcpMs', 'LCP'],
      ['cls', 'CLS']
    ]
    for (const [key, name] of checks) {
      const limit = limitFor(route.route, key)
      if (limit === undefined || limit === null) continue
      if (Number(route[key]) > Number(limit)) {
        failures.push(`${route.name}: ${name} ${route[key]} > budget ${limit}`)
      }
    }
  }
  return failures
}

function formatNumber (value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(3)
}

async function writeDashboard (result, budgets) {
  const { history } = await readHistory()
  const rows = result.routes.map(route => [
    route.name,
    formatNumber(route.fcpMs) + ' ms',
    formatNumber(route.lcpMs) + ' ms',
    formatNumber(route.cls),
    formatNumber(route.initialJsKb) + ' KB',
    formatNumber(route.routeJsKb) + ' KB',
    formatNumber(route.cssKb) + ' KB',
    formatNumber(route.totalKb) + ' KB',
    String(route.requests)
  ])
  const budgetRows = []
  if (budgets) {
    for (const route of result.routes) {
      budgetRows.push([
        route.name,
        budgets.routes?.[route.route]?.initialJsKb ?? budgets.initialJsKb ?? '—',
        budgets.routes?.[route.route]?.routeJsKb ?? budgets.routeJsKb ?? '—',
        budgets.routes?.[route.route]?.cssKb ?? budgets.cssKb ?? '—',
        budgets.routes?.[route.route]?.totalKb ?? budgets.totalKb ?? '—',
        budgets.routes?.[route.route]?.lcpMs ?? budgets.lcpMs ?? '—',
        budgets.routes?.[route.route]?.cls ?? budgets.cls ?? '—'
      ])
    }
  }
  const historyRows = history.slice(-8).reverse().map(run => [
    run.label || 'run',
    run.commit || '—',
    new Date(run.generatedAt).toISOString().slice(0, 16).replace('T', ' '),
    run.routes.map(route => route.name + ' LCP ' + route.lcpMs + 'ms / total ' + route.totalKb + 'KB').join('<br>')
  ])
  const bundleRows = result.bundle.largest.map(row => [
    '`' + row.file + '`',
    formatNumber(row.rawKb) + ' KB',
    formatNumber(row.gzipKb) + ' KB',
    formatNumber(row.brotliKb) + ' KB'
  ])
  const markdown = `# Performance dashboard

Generated ${new Date(result.generatedAt).toISOString()} from commit \`${result.commit}\` (${result.label}).

This dashboard measures the built SPA served by \`scripts/serve-dist.mjs\` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the routes named in W22. It is intentionally
repeatable locally and in CI rather than tied to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.map(row => '| ' + row.join(' | ') + ' |').join('\n')}

Initial bundle snapshot: **${formatNumber(result.bundle.initial.gzipKb)} KB gzip**
/ **${formatNumber(result.bundle.initial.brotliKb)} KB Brotli** (entry shell and
modulepreloads).

## Budgets

${budgets
  ? `\`docs/performance/budgets.json\` is enforced by \`bun run perf:check\` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${budgetRows.map(row => '| ' + row.join(' | ') + ' |').join('\n')}`
  : 'No budgets file yet. Add `docs/performance/budgets.json` and run `bun run perf:check`.'}

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
${bundleRows.map(row => '| ' + row.join(' | ') + ' |').join('\n')}

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
${historyRows.map(row => '| ' + row.join(' | ') + ' |').join('\n')}

## Commands

\`\`\`sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
\`\`\`
`
  await writeFile(resolve(PERF_DIR, 'README.md'), markdown, 'utf8')
}

async function readHistory () {
  try {
    const text = await readFile(resolve(PERF_DIR, 'history.jsonl'), 'utf8')
    const history = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    return { history }
  } catch {
    return { history: [] }
  }
}

async function main () {
  await mkdir(PERF_DIR, { recursive: true })
  const initialAssets = await initialAssetSet()
  const bundle = await bundleSnapshot()
  const server = spawn(process.execPath, ['scripts/serve-dist.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: 'ignore'
  })

  let browser
  try {
    if (!(await waitForServer())) throw new Error('static server did not start')
    browser = await chromium.launch({ headless: true })
    const routes = []
    for (const route of ROUTES) {
      process.stdout.write('Measuring ' + route + ' ... ')
      routes.push(await measureRoute(browser, route, initialAssets))
      const last = routes[routes.length - 1]
      console.log('LCP ' + last.lcpMs + 'ms, total ' + last.totalKb + 'KB')
    }

    const result = {
      generatedAt: new Date().toISOString(),
      commit: commit(),
      label: LABEL,
      routes,
      bundle
    }

    const budgets = await readBudgets()
    const failures = checkBudgets(result, budgets)
    if (CHECK && failures.length > 0) {
      console.error('\nPerformance budget failures:')
      for (const failure of failures) console.error('- ' + failure)
      process.exitCode = 1
      return
    }
    if (CHECK) {
      console.log('\nPerformance budgets passed.')
      return
    }

    await writeFile(resolve(PERF_DIR, 'latest.json'), JSON.stringify(result, null, 2) + '\n', 'utf8')
    await appendFile(resolve(PERF_DIR, 'history.jsonl'), JSON.stringify(result) + '\n', 'utf8')
    await writeDashboard(result, budgets)
    console.log('\nWrote docs/performance/latest.json, history.jsonl and README.md')
  } finally {
    if (browser) await browser.close().catch(() => {})
    server.kill('SIGTERM')
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
