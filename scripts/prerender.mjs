#!/usr/bin/env node
// Optional SEO prerender for key static routes.
//
// Starts the built SPA on a temporary port, renders each key route with
// Chromium, extracts its metadata, and writes that metadata into the original
// application shell. The body is intentionally not snapshotted: a hard reload
// must never show stale/prerendered chain data before Vue mounts. If a browser
// is unavailable the script logs a warning and exits successfully; the SPA
// history fallback still works.

import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { applyMetadata } from './lib/prerender-meta.mjs'

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
  const shell = await readFile(resolve(DIST, 'index.html'), 'utf8')
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
      await page.waitForTimeout(1800)
      const metadata = await page.evaluate(() => {
        const content = (selector) => document.querySelector(selector)?.getAttribute('content') || ''
        const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map(script => script.textContent.trim())
          .filter(Boolean)
          .join('\n')
        return {
          title: document.title,
          description: content('meta[name="description"]'),
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          ogTitle: content('meta[property="og:title"]'),
          ogDescription: content('meta[property="og:description"]'),
          ogUrl: content('meta[property="og:url"]'),
          ogImage: content('meta[property="og:image"]'),
          ogType: content('meta[property="og:type"]'),
          twitterCard: content('meta[name="twitter:card"]'),
          twitterTitle: content('meta[name="twitter:title"]'),
          twitterDescription: content('meta[name="twitter:description"]'),
          twitterImage: content('meta[name="twitter:image"]'),
          jsonLd
        }
      })
      const html = applyMetadata(shell, metadata)
      const file = route === '/'
        ? resolve(DIST, 'index.html')
        : resolve(DIST, route.replace(/^\//, ''), 'index.html')
      await mkdir(resolve(file, '..'), { recursive: true })
      await writeFile(file, html, 'utf8')
      console.log('Metadata prerendered', route)
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
