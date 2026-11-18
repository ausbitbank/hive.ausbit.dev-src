import { test, expect } from './fixtures'
import { waitForApp } from './helpers'

test.describe('unified search and discovery', () => {
  test('search page renders a query and groups results by type', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/search?q=hive')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Search Hive' })).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.search-status')).toContainText(/results? for/, { timeout: 45000 })
    await expect(page.locator('.search-group').first()).toBeVisible({ timeout: 45000 })

    const tabs = page.getByRole('navigation', { name: 'Search result types' })
    await tabs.getByRole('button', { name: /^Posts/ }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('type')).toBe('posts')
    await expect(page.locator('.search-group')).toHaveCount(1, { timeout: 45000 })

    await tabs.getByRole('button', { name: /^All/ }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('type')).toBeNull()
  })

  test('a shared search URL restores filters and the query', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/search?q=photography&type=tags&tag=photography&sort=created')
    await waitForApp(page)
    await expect(page.getByLabel('Search Hive')).toHaveValue('photography')
    await expect(page.locator('.search-option--active')).toContainText('Newest')
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeVisible({ timeout: 45000 })

    await page.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('tag')).toBeNull()
  })

  test('saved searches persist on this device', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/search?q=hive&type=posts')
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Save search' })).toBeVisible({ timeout: 45000 })
    await page.getByRole('button', { name: 'Save search' }).click()
    await expect(page.getByRole('heading', { name: 'Saved searches' })).toBeVisible()

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible({ timeout: 45000 })
    expect(await page.evaluate(() => localStorage.getItem('savedSearches'))).toContain('/search?q=hive')
  })

  test('command palette deep-links to the full search page', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.locator('.command-trigger')).toBeVisible({ timeout: 20000 })
    await page.locator('.command-trigger').first().click()
    const palette = page.locator('.command-palette')
    await expect(palette).toBeVisible({ timeout: 15000 })
    await palette.locator('input').first().fill('hive')
    await expect(page.getByRole('button', { name: /Search for “hive”/ })).toBeVisible()
    await page.getByRole('button', { name: /Search for “hive”/ }).click()
    await page.waitForURL('**/search?q=hive')
    await expect(page.getByLabel('Search Hive')).toHaveValue('hive')
  })
})
