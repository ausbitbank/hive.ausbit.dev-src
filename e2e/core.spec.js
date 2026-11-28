import { test, expect } from './fixtures'
import { loginAs, mockCommunityDirectory, runAxe, waitForApp } from './helpers'

// Keep the production service worker from answering mocked community reads.
test.use({ serviceWorkers: 'block' })

test.describe('navigation and quick wins', () => {
  test('shows the login key guide and simulates a logged-in session', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    const card = page.locator('.login-card')
    await expect(card).toContainText('Use Keychain, SmartLock or HiveAuth')
    await card.getByLabel('Username').fill('ausbitbank')
    await page.waitForTimeout(2500)
    await page.keyboard.press('Enter')
    await expect(card.getByRole('button', { name: 'Hive-Keychain' })).toBeVisible({ timeout: 15000 })
    await card.getByRole('button', { name: 'SmartLock' }).click()
    await expect(page.locator('.login-key-guide')).toContainText('Posting key')
    await expect(page.locator('.login-key-guide')).toContainText('Active key')
    await expect(page.locator('.login-key-guide')).toContainText('Keychain')
  })

  test('restores a simulated account session', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.locator('button[aria-label^="Account menu"]')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('loggedInUser'))).toContain('ausbitbank')
  })

  test('public community directory browses and searches all communities', async ({ page }) => {
    test.setTimeout(30000)
    await mockCommunityDirectory(page)
    await page.goto('/c')
    await page.waitForURL('**/communities')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Discover Hive communities')
    await expect(page.locator('.community-card').first()).toBeVisible()
    await expect(page.locator('.community-index-shelf').first()).toBeVisible()

    const input = page.getByLabel('Search Hive communities by title or description')
    await input.fill('art')
    await expect.poll(() => page.locator('.community-index-section__hint').innerText(), { timeout: 5000 })
      .toContain('Searching all Hive communities')
    await expect.poll(() => page.locator('.community-card').count(), { timeout: 5000 }).toBe(100)

    await page.getByRole('button', { name: 'Load more matches' }).click()
    await expect.poll(() => page.locator('.community-card').count(), { timeout: 5000 }).toBeGreaterThan(100)

    await page.getByRole('button', { name: 'Gaming', exact: true }).dispatchEvent('click')
    await expect.poll(() => page.locator('.community-index-section__hint').innerText(), { timeout: 5000 })
      .toContain('gaming')

    await input.fill('hive-174578')
    await expect.poll(() => page.locator('.community-card__title').first().innerText(), { timeout: 5000 })
      .toContain('OCD')
  })

  test('404 search resolves a block number and quick links are present', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('That page is not here')
    await page.getByLabel('Search for a Hive page').fill('1')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.waitForURL('**/b/1')
    await expect(page.locator('.block-page')).toBeVisible()
  })

  test('keyboard shortcuts open help and navigate with g sequences', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.locator('.home-page')).toBeVisible()
    await page.keyboard.press('?')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeHidden()
    await page.keyboard.press('g')
    await page.keyboard.press('b')
    await page.waitForURL('**/blocks')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('back-to-top appears on a long page and returns to the top', async ({ page }) => {
    await page.goto('/proposals')
    await waitForApp(page)
    await expect(page.locator('.proposal-grid').first()).toBeVisible({ timeout: 30000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const button = page.getByRole('button', { name: 'Back to top' })
    await expect(button).toBeVisible()
    await page.evaluate(() => document.querySelector('button[aria-label="Back to top"]')?.click())
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50)
  })

  test('share menu exposes link and Markdown actions', async ({ page }) => {
    await page.goto('/b/1')
    await waitForApp(page)
    await page.getByRole('button', { name: /^Share Hive block/ }).dispatchEvent('click')
    await expect(page.locator('.share-menu')).toContainText('Copy link')
    await expect(page.locator('.share-menu')).toContainText('Copy Markdown')
    expect(await runAxe(page)).toEqual([])
  })
})
