import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

async function gotoFeedWithCards (page) {
  await page.goto('/created', { waitUntil: 'domcontentloaded' })
  await waitForApp(page)
  const card = page.locator('.post-card').first()
  await expect(card).toBeVisible({ timeout: 30000 })
  return card
}

async function expectLoggedIn (page) {
  await expect(page.locator('button[aria-label^="Account menu"]')).toBeVisible({ timeout: 20000 })
}

test('quick look opens the post without leaving the feed and closes cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const card = await gotoFeedWithCards(page)
  const title = (await card.locator('.post-card__title').innerText()).trim()

  await card.locator('.post-card__peek').click()
  const peek = page.locator('.post-peek')
  await expect(peek).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(400)
  await expect(peek.locator('.post-peek__title')).toContainText(title.slice(0, 16))
  await expect(peek.locator('.post-peek__body')).toBeVisible()
  await expect(peek.locator('.post-peek__foot')).toContainText('Open full post')

  const url = new URL(page.url())
  expect(url.pathname).toBe('/created')
  expect(url.searchParams.get('peek')).toMatch(/^@[^/]+\/.+/)

  await peek.locator('.post-peek__close').click()
  await expect(peek).toBeHidden({ timeout: 15000 })
  expect(new URL(page.url()).searchParams.has('peek')).toBe(false)
  await expect(page.locator('.post-card').first()).toBeVisible()
})

test('browser Back closes the quick look and leaves the feed in place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const card = await gotoFeedWithCards(page)

  await card.locator('.post-card__peek').click()
  const peek = page.locator('.post-peek')
  await expect(peek).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(400)
  await expect(page).toHaveURL(/[?&]peek=/)

  await page.goBack()
  await expect(page).toHaveURL(/\/created$/)
  await expect(peek).toBeHidden({ timeout: 15000 })
  await expect(page.locator('.post-card').first()).toBeVisible()
})

test('a ?peek= link opens the same quick look directly', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const card = await gotoFeedWithCards(page)
  const href = await card.locator('.post-card__title a').getAttribute('href')
  const key = href.replace(/^\//, '')

  await page.goto('/created?peek=' + encodeURIComponent(key), { waitUntil: 'domcontentloaded' })
  await waitForApp(page)
  const peek = page.locator('.post-peek')
  await expect(peek).toBeVisible({ timeout: 30000 })
  await expect(peek.locator('.post-peek__refreshing')).toHaveCount(0, { timeout: 30000 })
  await expect(peek.locator('.post-peek__meta')).toContainText(key.split('/')[0].replace(/^@/, ''))
  await expect(peek.locator('.post-peek__body')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('peek')).toBe(key)
})

test('a vote queued in the quick look updates the source card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAs(page)
  await gotoFeedWithCards(page)
  await expectLoggedIn(page)

  const card = page.locator('.post-card:not(.post-card--voted-up):not(.post-card--voted-down)').first()
  await expect(card).toBeVisible({ timeout: 15000 })
  const href = await card.locator('.post-card__title a').getAttribute('href')
  await card.locator('.post-card__peek').click()
  const peek = page.locator('.post-peek')
  await expect(peek).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(400)

  await expect(peek.locator('.vote-control')).toBeVisible({ timeout: 30000 })
  await peek.locator('.vote-control__btn--up').first().click()
  await peek.locator('.vote-control__confirm').first().click()
  await expect(peek.locator('.vote-control__sent')).toBeVisible()

  await peek.locator('.post-peek__close').click()
  const sameCard = page.locator('.post-card', { has: page.locator(`a[href="${href}"]`) })
  await expect(sameCard).toHaveClass(/post-card--voted-up/)
})

test('quick look exposes voting and the vote breakdown', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAs(page)
  const card = await gotoFeedWithCards(page)
  await expectLoggedIn(page)

  await card.locator('.post-card__peek').click()
  const peek = page.locator('.post-peek')
  await expect(peek).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(400)

  await expect(peek.locator('.vote-control')).toBeVisible({ timeout: 30000 })
  await peek.locator('.post-peek__stat', { hasText: 'vote' }).click()
  await expect(page.locator('.votes-dialog')).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
  await expect(page.locator('.votes-dialog')).toBeHidden()
})
