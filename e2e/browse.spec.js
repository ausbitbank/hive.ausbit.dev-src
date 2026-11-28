import { test, expect } from './fixtures'
import { mockRankedPosts, waitForApp } from './helpers'

test.use({ serviceWorkers: 'block' })

test('browse filters and layout controls work', async ({ page }) => {
  test.setTimeout(20000)
  await mockRankedPosts(page)
  await page.goto('/browse')
  await waitForApp(page)
  await expect(page.locator('.browse-toolbar__summary')).not.toContainText('Loading posts', { timeout: 10000 })
  await expect(page.locator('.browse-grid, .browse-state').first()).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Filter posts' }).click()
  await expect(page.getByRole('switch', { name: 'Hide reblogs' })).toBeVisible()
  const reblogs = page.locator('.browse-filter-list .q-item', { hasText: 'Hide reblogs' })
  await reblogs.locator('.q-toggle').click()
  await expect(page.getByRole('button', { name: 'Filter posts' }).locator('.q-badge')).toBeVisible()

  await page.getByRole('button', { name: 'Done', exact: true }).dispatchEvent('click')

  const tableToggle = page.getByRole('button', { name: 'Table', exact: true })
  if (await tableToggle.count()) {
    await tableToggle.dispatchEvent('click')
    await expect.poll(() => new URL(page.url()).searchParams.get('style')).toBe('table')
  }
})
