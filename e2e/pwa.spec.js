import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

const SW_PATH = resolve(process.cwd(), 'dist/spa/sw.js')

test('PWA manifest has install prerequisites and offline assets are published', async ({ page, request }) => {
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.status()).toBe(200)
  const data = await manifest.json()
  expect(data.name).toContain('Banksia')
  expect(data.start_url).toBe('/')
  expect(data.scope).toBe('/')
  expect(data.display).toBe('standalone')
  expect(data.icons.some(icon => icon.sizes === '192x192')).toBe(true)
  expect(data.icons.some(icon => icon.sizes === '512x512')).toBe(true)
  for (const icon of data.icons) {
    expect((await request.get(icon.src)).status()).toBe(200)
  }

  expect((await request.get('/feed.xml')).status()).toBe(200)
  expect((await request.get('/sw.js')).status()).toBe(200)
  expect((await request.get('/offline.html')).status()).toBe(200)

  await page.goto('/')
  await waitForApp(page)
  await expect.poll(async () => page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.getRegistration()
    return Boolean(registration)
  }), { timeout: 20000 }).toBe(true)
})

test('offline navigation is served by the cached app shell', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await waitForApp(page)
  await expect.poll(async () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return Boolean(registration?.active && navigator.serviceWorker.controller)
  }), { timeout: 30000 }).toBe(true)

  // Reload once under the active worker so route assets and fonts are cached
  // by the service worker before the navigation goes offline.
  await page.reload()
  await waitForApp(page)
  await page.waitForTimeout(1000)

  await page.context().setOffline(true)
  try {
    await page.goto('/blocks', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await expect(page.locator('.q-header')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.q-page')).toBeVisible()
  } finally {
    await page.context().setOffline(false)
  }
})

test('service-worker update prompts and reloads only after confirmation', async ({ page }) => {
  test.setTimeout(120000)
  const original = await readFile(SW_PATH, 'utf8')
  await page.addInitScript(() => {
    const loads = Number(sessionStorage.getItem('swUpdateLoads') || 0) + 1
    sessionStorage.setItem('swUpdateLoads', String(loads))
  })

  await page.goto('/')
  await waitForApp(page)
  await expect.poll(async () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return Boolean(registration?.active && navigator.serviceWorker.controller)
  }), { timeout: 30000 }).toBe(true)

  await writeFile(SW_PATH, original + '\n// e2e update marker\n', 'utf8')
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForApp(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Update available')).toBeVisible({ timeout: 40000 })
    const loadsBeforeConfirm = await page.evaluate(() => Number(sessionStorage.getItem('swUpdateLoads')))
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => Number(sessionStorage.getItem('swUpdateLoads')))).toBe(loadsBeforeConfirm)
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(500)
    expect(await runAxe(page)).toEqual([])

    await dialog.getByRole('button', { name: 'Reload now' }).click()
    await page.waitForFunction(
      expected => Number(sessionStorage.getItem('swUpdateLoads')) > expected,
      loadsBeforeConfirm,
      { timeout: 30000 }
    )
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return Boolean(registration?.active && !registration.waiting)
    }, null, { timeout: 30000 })
  } finally {
    await writeFile(SW_PATH, original, 'utf8')
  }
})
