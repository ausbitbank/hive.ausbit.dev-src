import { test, expect } from '@playwright/test'
import { waitForApp } from './helpers'

test('PWA shell, feed and offline assets are published', async ({ page, request }) => {
  const manifest = await request.get('/manifest.webmanifest')
  expect(manifest.status()).toBe(200)
  expect(await manifest.text()).toContain('"name"')

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
