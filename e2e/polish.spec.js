import { test, expect } from '@playwright/test'
import { waitForApp } from './helpers'

const POST_ROUTE = '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'

test('header lockup keeps a stable icon/title gap and hides the title on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await waitForApp(page)
  await expect(page.locator('.site-brand')).toBeVisible()

  const desktop = await page.evaluate(() => {
    const brand = document.querySelector('.site-brand')
    const mark = brand.querySelector('.site-brand__mark')
    const label = brand.querySelector('.site-brand__text')
    const markBox = mark.getBoundingClientRect()
    const labelBox = label.getBoundingClientRect()
    return {
      gap: labelBox.x - markBox.right,
      markHeight: markBox.height,
      centerDelta: Math.abs((markBox.top + markBox.height / 2) - (labelBox.top + labelBox.height / 2)),
      labelVisible: labelBox.width > 0
    }
  })
  expect(desktop.labelVisible).toBe(true)
  expect(desktop.gap).toBeGreaterThanOrEqual(8)
  expect(desktop.gap).toBeLessThanOrEqual(12)
  expect(desktop.markHeight).toBeGreaterThanOrEqual(20)
  expect(desktop.markHeight).toBeLessThanOrEqual(24)
  expect(desktop.centerDelta).toBeLessThanOrEqual(2)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForApp(page)
  await expect(page.locator('.site-brand__mark')).toBeVisible()
  const mobile = await page.evaluate(() => {
    const mark = document.querySelector('.site-brand__mark').getBoundingClientRect()
    const label = document.querySelector('.site-brand__text').getBoundingClientRect()
    return { markWidth: mark.width, labelVisible: label.width > 0 }
  })
  expect(mobile.labelVisible).toBe(false)
  expect(mobile.markWidth).toBeGreaterThanOrEqual(22)
})

test('post sidebar stacks between the article and comments on mobile and aligns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(POST_ROUTE)
  await waitForApp(page)
  await expect(page.locator('.post-sidebar')).toBeVisible({ timeout: 30000 })

  const mobile = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect()
    return {
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      children: [...document.querySelectorAll('.post-grid > *')].map(el => el.className.split(' ')[0]),
      articleTop: rect('.post-article').top + window.scrollY,
      sidebarTop: rect('.post-sidebar').top + window.scrollY,
      commentsTop: rect('#comments').top + window.scrollY,
      position: getComputedStyle(document.querySelector('.post-sidebar')).position
    }
  })
  expect(mobile.h1).toBe(1)
  expect(mobile.overflow).toBe(0)
  expect(mobile.children).toEqual(['post-article', 'post-sidebar', 'comments'])
  expect(mobile.sidebarTop).toBeGreaterThan(mobile.articleTop)
  expect(mobile.commentsTop).toBeGreaterThan(mobile.sidebarTop)
  expect(mobile.position).toBe('static')

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto(POST_ROUTE)
  await waitForApp(page)
  await expect(page.locator('.post-sidebar')).toBeVisible({ timeout: 30000 })

  const desktop = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect()
    const values = [...document.querySelectorAll('.post-fact dd')].map(el => el.getBoundingClientRect().right)
    const actions = [...document.querySelectorAll('.post-sidebar .post-side-card__actions .q-btn')].map(el => el.getBoundingClientRect().height)
    return {
      sidebarSticky: getComputedStyle(document.querySelector('.post-sidebar')).position,
      topDelta: Math.abs(rect('.post-sidebar').top - rect('.post-article').top),
      valueRightSpread: Math.max(...values) - Math.min(...values),
      actionHeights: actions,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }
  })
  expect(desktop.sidebarSticky).toBe('sticky')
  expect(desktop.topDelta).toBeLessThanOrEqual(2)
  expect(desktop.valueRightSpread).toBeLessThanOrEqual(1)
  expect(desktop.overflow).toBe(0)
  for (const height of desktop.actionHeights) expect(height).toBeGreaterThanOrEqual(36)
})
