import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

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

  test('a collapsed search result can be shown per row', async ({ page }) => {
    test.setTimeout(120000)
    await page.addInitScript(() => {
      localStorage.setItem('hive:moderation:v1:guest', JSON.stringify({
        preset: 'follow-only',
        custom: null,
        listsOverrideFollows: false,
        disclosureSeen: true,
        overrides: {
          showAuthors: [],
          hideAuthors: [],
          showItems: [],
          hideItems: [],
          ignoredVoters: []
        }
      }))
    })

    await page.goto('/search?q=hive&type=posts')
    await waitForApp(page)
    await expect(page.locator('.search-status')).toContainText(/results? for/, { timeout: 45000 })

    const show = page.getByRole('button', { name: /^Show .* anyway$/ }).first()
    await expect(show).toBeVisible({ timeout: 45000 })
    const item = page.locator('li[data-result-key]').filter({ has: show }).first()
    const key = await item.getAttribute('data-result-key')
    expect(key).toBeTruthy()
    await expect(item.locator('.result-row__description')).toHaveCount(0)

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(200)
      expect(await runAxe(page, { context: '.result-list' }), width + 'px').toEqual([])
    }

    await show.click()
    const shown = page.locator('li[data-result-key="' + String(key).replace(/"/g, '\\"') + '"]')
    await expect(shown.locator('.result-row__description')).toBeVisible()
    await expect(shown.locator('.result-row__moderation')).toHaveCount(0)
    await expect(shown.locator('.result-row__open')).toBeFocused()

    const violations = await runAxe(page, { context: '.result-list' })
    expect(violations).toEqual([])

    const policy = await page.evaluate(() => JSON.parse(localStorage.getItem('hive:moderation:v1:guest') || '{}'))
    expect(policy.overrides.showItems.length).toBeGreaterThan(0)
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
