#!/usr/bin/env node
// Optional SEO prerender for key static routes.
//
// Starts the built SPA on a temporary port, renders each key route with
// Chromium, and writes the resulting HTML next to the route so static hosting
// can serve crawlable snapshots. If a browser is unavailable the script logs a
// warning and exits successfully; the SPA history fallback still works.

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const PORT = 4188
const ROUTES = ['/', '/blocks', '/browse', '/witnesses', '/proposals', '/hbd', '/market', '/markets', '/health', '/nodes', '/tax']
const DIST = resolve(process.cwd(), 'dist/spa')

async function waitForServer () {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch('http://127.0.0.1:' + PORT + '/')
      if (response.ok) return true
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return false
}

async function main () {
  const server = spawn(process.execPath, ['scripts/serve-dist.mjs'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: 'ignore'
  })

  let browser
  try {
    if (!(await waitForServer())) throw new Error('static server did not start')
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

    for (const route of ROUTES) {
      await page.goto('http://127.0.0.1:' + PORT + route, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3500)
      await page.locator('h1').first().waitFor({ timeout: 15000 }).catch(() => {})
      const html = (await page.content()).replaceAll('http://127.0.0.1:' + PORT, '')
      const file = route === '/'
        ? resolve(DIST, 'index.html')
        : resolve(DIST, route.replace(/^\//, ''), 'index.html')
      await mkdir(resolve(file, '..'), { recursive: true })
      await writeFile(file, html, 'utf8')
      console.log('Prerendered', route)
    }
  } catch (error) {
    console.warn('Prerender skipped:', error.message)
  } finally {
    if (browser) await browser.close().catch(() => {})
    server.kill('SIGTERM')
  }
}

main().catch(error => {
  console.warn('Prerender skipped:', error.message)
})
