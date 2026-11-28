import { test, expect } from './fixtures'
import { mockRankedPosts, waitForApp } from './helpers'

test.use({ serviceWorkers: 'block' })

test('ignored tags remove matching posts from the feed', async ({ page }) => {
  test.setTimeout(20000)
  await mockRankedPosts(page)
  await page.goto('/browse')
  await waitForApp(page)
  await expect(page.locator('.browse-toolbar__summary')).not.toContainText('Loading posts', { timeout: 10000 })
  await expect(page.locator('.browse-grid .post-card').first()).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Filter posts' }).click()
  const filterCard = page.locator('.feed-filter-card')
  await page.getByLabel('Tag to ignore').fill('#HIVE')
  await filterCard.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.feed-filter-card__tag-list')).toContainText('#hive')
  await filterCard.getByRole('button', { name: 'Done', exact: true }).dispatchEvent('click')

  await expect(page.locator('.browse-toolbar__summary')).toContainText('0 posts')
  await expect(page.locator('.browse-toolbar__summary')).toContainText('hidden by filters')
  await expect(page.locator('.browse-grid .post-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filter posts' }).locator('.q-badge')).toHaveText('1')

  await page.getByRole('button', { name: 'Filter posts' }).click()
  await filterCard.getByRole('button', { name: 'Reset filters' }).click()
  await filterCard.getByRole('button', { name: 'Done', exact: true }).dispatchEvent('click')
  await expect(page.locator('.browse-grid .post-card').first()).toBeVisible({ timeout: 10000 })
})

test('a post tag quick action filters the feed immediately', async ({ page }) => {
  test.setTimeout(20000)
  await mockRankedPosts(page)
  await page.goto('/browse')
  await waitForApp(page)
  await expect(page.locator('.browse-toolbar__summary')).not.toContainText('Loading posts', { timeout: 10000 })
  const firstCard = page.locator('.browse-grid .post-card').first()
  await expect(firstCard).toBeVisible({ timeout: 10000 })

  await firstCard.locator('.post-card__tag-ignore').click()
  await expect(page.locator('.browse-toolbar__summary')).toContainText('0 posts')
  await expect(page.locator('.browse-grid .post-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filter posts' }).locator('.q-badge')).toHaveText('1')

  await page.getByRole('button', { name: 'Filter posts' }).click()
  const filterCard = page.locator('.feed-filter-card')
  await filterCard.getByRole('button', { name: 'Reset filters' }).click()
  await filterCard.getByRole('button', { name: 'Done', exact: true }).dispatchEvent('click')
  await expect(page.locator('.browse-grid .post-card').first()).toBeVisible({ timeout: 10000 })
})

test('short-form timelines use the shared feed filters', async ({ page }) => {
  test.setTimeout(20000)
  await mockRankedPosts(page, {
    count: 6,
    post: { category: 'hive-167922', json_metadata: { app: 'leothreads/0.3', tags: ['inleo'] } }
  })
  await page.goto('/shorts/threads')
  await waitForApp(page)
  await expect(page.locator('.sf-toolbar')).toContainText('Showing', { timeout: 10000 })
  await expect(page.locator('.sf-list .sfc').first()).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Filter posts' }).click()
  const filterCard = page.locator('.feed-filter-card')
  await page.getByLabel('Tag to ignore').fill('#InLeo')
  await filterCard.getByRole('button', { name: 'Add', exact: true }).click()
  await filterCard.getByRole('button', { name: 'Done', exact: true }).dispatchEvent('click')

  await expect(page.locator('.sf-toolbar')).toContainText('hidden by filters')
  await expect(page.locator('.sf-list .sfc')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filter posts' }).locator('.q-badge')).toHaveText('1')

  await page.locator('.sf-empty').getByRole('button', { name: 'Reset filters' }).click()
  await expect(page.locator('.sf-list .sfc').first()).toBeVisible({ timeout: 10000 })
})

test('browse filters and layout controls work', async ({ page }) => {
  test.setTimeout(20000)
  await mockRankedPosts(page)
  await page.goto('/browse')
  await waitForApp(page)
  await expect(page.locator('.browse-toolbar__summary')).not.toContainText('Loading posts', { timeout: 10000 })
  await expect(page.locator('.browse-grid, .browse-state').first()).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Filter posts' }).click()
  await expect(page.getByRole('switch', { name: 'Hide reblogs' })).toBeVisible()
  const reblogs = page.locator('.feed-filter-list .q-item', { hasText: 'Hide reblogs' })
  await reblogs.locator('.q-toggle').click()
  await expect(page.getByRole('button', { name: 'Filter posts' }).locator('.q-badge')).toBeVisible()

  await page.getByRole('button', { name: 'Done', exact: true }).dispatchEvent('click')

  const tableToggle = page.getByRole('button', { name: 'Table', exact: true })
  if (await tableToggle.count()) {
    await tableToggle.dispatchEvent('click')
    await expect.poll(() => new URL(page.url()).searchParams.get('style')).toBe('table')
  }
})
