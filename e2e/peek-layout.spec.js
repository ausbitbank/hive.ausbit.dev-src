import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

async function gotoFeedWithCards (page) {
  await page.goto('/created', { waitUntil: 'domcontentloaded' })
  await waitForApp(page)
  const card = page.locator('.post-card').first()
  await expect(card).toBeVisible({ timeout: 30000 })
  return card
}

async function openPeek (page) {
  const card = page.locator('.post-card').first()
  // Dispatch without Playwright's scroll-into-view so the scroll assertion
  // measures the peek itself, not the test harness.
  await card.locator('.post-card__peek').dispatchEvent('click')
  const peek = page.locator('.post-peek')
  await expect(peek).toBeVisible({ timeout: 15000 })
  const viewportWidth = page.viewportSize().width
  await expect.poll(async () => {
    const box = await peek.boundingBox()
    return box ? Math.round(box.x + box.width) : -1
  }, { timeout: 5000 }).toBe(viewportWidth)
  return { card, peek }
}

test('opening the quick look keeps the feed scroll and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoFeedWithCards(page)
  const scrollBefore = await page.evaluate(() => window.scrollY)

  const { peek } = await openPeek(page)
  await expect(peek.locator('.post-peek__body')).toBeVisible()
  expect(await runAxe(page, { context: '.post-peek' })).toEqual([])
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)

  await peek.locator('.post-peek__close').click()
  await expect(peek).toBeHidden({ timeout: 15000 })
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
})

test('opening a full post and going Back restores the feed scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoFeedWithCards(page)

  await page.evaluate(() => window.scrollTo(0, 900))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)

  const target = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.post-card__title a')]
    const link = links.find(anchor => {
      const rect = anchor.getBoundingClientRect()
      return rect.top > 120 && rect.bottom < window.innerHeight - 80
    })
    if (!link) return null
    const rect = link.getBoundingClientRect()
    return {
      x: rect.left + Math.min(24, rect.width / 2),
      y: rect.top + rect.height / 2,
      scrollY: window.scrollY,
      href: link.getAttribute('href')
    }
  })
  expect(target).not.toBeNull()

  await page.mouse.click(target.x, target.y)
  await expect(page).toHaveURL(new RegExp(target.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
  await expect(page.locator('.post-page')).toBeVisible({ timeout: 30000 })

  await page.goBack()
  await expect(page).toHaveURL(/\/created$/)
  await expect(page.locator('.post-card').first()).toBeVisible({ timeout: 30000 })
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 15000 })
    .toBeGreaterThanOrEqual(Math.max(0, target.scrollY - 150))
})

test.describe('quick look on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('uses a full-screen sheet and passes axe', async ({ page }) => {
    await gotoFeedWithCards(page)
    const { peek } = await openPeek(page)
    const box = await peek.boundingBox()
    expect(box.width).toBeGreaterThan(380)
    expect(box.height).toBeGreaterThan(700)
    expect(await runAxe(page, { context: '.post-peek' })).toEqual([])
    await peek.locator('.post-peek__close').click()
    await expect(peek).toBeHidden()
  })
})
