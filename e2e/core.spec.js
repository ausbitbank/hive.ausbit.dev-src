import { test, expect } from '@playwright/test'
import { loginAs, runAxe, waitForApp } from './helpers'

test.describe('navigation and quick wins', () => {
  test('shows the login key guide and simulates a logged-in session', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.locator('.login-card')).toContainText('Posting key')
    await expect(page.locator('.login-card')).toContainText('Active key')
    await expect(page.locator('.login-card')).toContainText('Keychain')
  })

  test('restores a simulated account session', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.locator('button[aria-label^="Account menu"]')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('loggedInUser'))).toContain('ausbitbank')
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
    await button.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50)
  })

  test('share menu exposes link and Markdown actions', async ({ page }) => {
    await page.goto('/b/1')
    await waitForApp(page)
    await page.getByRole('button', { name: /^Share Hive block/ }).click()
    await expect(page.locator('.share-menu')).toContainText('Copy link')
    await expect(page.locator('.share-menu')).toContainText('Copy Markdown')
    expect(await runAxe(page)).toEqual([])
  })
})
