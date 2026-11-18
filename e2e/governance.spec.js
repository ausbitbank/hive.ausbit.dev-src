import { test, expect } from '@playwright/test'
import { runAxe, waitForApp } from './helpers'

test.describe('W25 governance and community intelligence', () => {
  test('witness analytics render concentration, feeds and missed blocks', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/witnesses', { waitUntil: 'domcontentloaded' })
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Witness concentration and health' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: 'Consensus stake share' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Feed freshness' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Version drift' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Missed-block counters' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Who backs a witness' })).toBeVisible()
    await page.getByRole('button', { name: 'Load sample' }).click()
    await expect(page.getByText('voters returned')).toBeVisible({ timeout: 45000 })
    await expect(page.getByText('accounts sampled')).toBeVisible()
    expect(await runAxe(page)).toEqual([])
  })

  test('proposal analytics render funding outlook and topic mix', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/proposals', { waitUntil: 'domcontentloaded' })
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Funding outlook and proposal mix' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Monthly commitments')).toBeVisible()
    await expect(page.getByText('Top creators')).toBeVisible()
    await expect(page.getByText('Governance threshold')).toBeVisible()
  })

  test('delegation explorer shows incoming, outgoing and history', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/@ausbitbank/delegations', { waitUntil: 'domcontentloaded' })
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: /delegations/i })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: 'Delegated to others' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Delegated to this account' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent delegation changes' })).toBeVisible()
    expect(await runAxe(page)).toEqual([])
  })

  test('account page surfaces authority risk', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/@ausbitbank', { waitUntil: 'domcontentloaded' })
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Authority risk' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Permission summary')).toBeVisible()
  })

  test('community pages render insight cards', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/c/hive-139531', { waitUntil: 'domcontentloaded' })
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Activity and moderation signals' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Top recent authors')).toBeVisible()
    await expect(page.getByText('Visible signals')).toBeVisible()
    await expect(page.getByText('Sample:')).toBeVisible()
    const postsCard = page.locator('.community-stat').filter({ hasText: 'Posts · 30 days' })
    await expect(postsCard.locator('.community-stat__value')).not.toHaveText('0', { timeout: 30000 })
    await expect(page.getByText('No recent posts found.')).toHaveCount(0)
  })

  test('new governance surfaces do not overflow at 390px', async ({ page }) => {
    test.setTimeout(180000)
    await page.setViewportSize({ width: 390, height: 844 })
    const routes = ['/witnesses', '/proposals', '/@ausbitbank/delegations', '/@ausbitbank', '/c/hive-174578']
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await waitForApp(page)
      await page.waitForTimeout(2500)
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }))
      expect(overflow.scrollWidth, route + ' horizontal overflow').toBeLessThanOrEqual(overflow.innerWidth + 1)
    }
  })
})
