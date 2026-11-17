import { test, expect } from '@playwright/test'
import { waitForApp } from './helpers'

test('browse filters and layout controls work', async ({ page }) => {
  await page.goto('/browse')
  await waitForApp(page)
  await expect(page.locator('.browse-toolbar__summary')).not.toContainText('Loading posts', { timeout: 25000 })
  await expect(page.locator('.browse-grid, .browse-state').first()).toBeVisible({ timeout: 25000 })

  await page.getByRole('button', { name: 'Filter posts' }).click()
  const reblogs = page.locator('.browse-filter-list .q-item', { hasText: 'Hide reblogs' })
  await reblogs.locator('.q-toggle').click()
  await expect(page.getByRole('button', { name: 'Filter posts' }).locator('.q-badge')).toBeVisible()

  const tableToggle = page.getByRole('button', { name: 'Table' })
  if (await tableToggle.count()) {
    await tableToggle.click()
    await expect.poll(() => new URL(page.url()).searchParams.get('style')).toBe('table')
  }
})
