import { test, expect } from './fixtures'
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

test('compose page stays single-column and overflow-free on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/compose')
  await waitForApp(page)
  await expect(page.locator('.compose-page')).toBeVisible({ timeout: 30000 })
  await expect(page.getByLabel('Post title')).toBeVisible()
  await expect(page.getByLabel('Post body in Markdown')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in to publish' })).toBeDisabled()

  const mobile = await page.evaluate(() => {
    const grid = document.querySelector('.compose-grid')
    return {
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      textareaHeight: document.querySelector('.compose-textarea').getBoundingClientRect().height
    }
  })
  expect(mobile.h1).toBe(1)
  expect(mobile.overflow).toBe(0)
  expect(mobile.columns).toBe(1)
  expect(mobile.textareaHeight).toBeGreaterThanOrEqual(320)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/compose')
  await waitForApp(page)
  await expect(page.locator('.compose-side')).toBeVisible({ timeout: 30000 })
  const desktop = await page.evaluate(() => {
    const grid = document.querySelector('.compose-grid')
    const main = document.querySelector('.compose-main')
    const side = document.querySelector('.compose-side')
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      mainTop: main.getBoundingClientRect().top,
      sideTop: side.getBoundingClientRect().top,
      sticky: getComputedStyle(main).position
    }
  })
  expect(desktop.overflow).toBe(0)
  expect(desktop.columns).toBe(2)
  expect(Math.abs(desktop.mainTop - desktop.sideTop)).toBeLessThanOrEqual(2)
  expect(desktop.sticky).toBe('sticky')
})

test('search page stays single-column and overflow-free on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/search?q=hive')
  await waitForApp(page)
  await expect(page.locator('.search-page')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Search Hive' })).toBeVisible()

  const mobile = await page.evaluate(() => {
    const layout = document.querySelector('.search-layout')
    return {
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: getComputedStyle(layout).gridTemplateColumns.split(' ').length
    }
  })
  expect(mobile.h1).toBe(1)
  expect(mobile.overflow).toBe(0)
  expect(mobile.columns).toBe(1)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/search?q=hive')
  await waitForApp(page)
  await expect(page.locator('.search-side')).toBeVisible({ timeout: 30000 })
  const desktop = await page.evaluate(() => {
    const layout = document.querySelector('.search-layout')
    const main = document.querySelector('.search-main')
    const side = document.querySelector('.search-side')
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: getComputedStyle(layout).gridTemplateColumns.split(' ').length,
      topDelta: Math.abs(main.getBoundingClientRect().top - side.getBoundingClientRect().top)
    }
  })
  expect(desktop.overflow).toBe(0)
  expect(desktop.columns).toBe(2)
  expect(desktop.topDelta).toBeLessThanOrEqual(2)
})

test('post sidebar stacks between the article and comments on mobile and aligns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(POST_ROUTE)
  await waitForApp(page)
  await expect(page.locator('.post-sidebar')).toBeVisible({ timeout: 30000 })

  const mobile = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect()
    const label = el => {
      for (const name of ['post-article', 'post-sidebar', 'post-comments', 'post-similar']) {
        if (el.classList.contains(name)) return name === 'post-comments' ? 'comments' : name
      }
      return el.className.split(' ')[0]
    }
    const similar = document.querySelector('.post-similar')
    return {
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      children: [...document.querySelectorAll('.post-grid > *')].map(label),
      articleTop: rect('.post-article').top + window.scrollY,
      sidebarTop: rect('.post-sidebar').top + window.scrollY,
      commentsTop: rect('#comments').top + window.scrollY,
      similarTop: similar ? similar.getBoundingClientRect().top + window.scrollY : null,
      position: getComputedStyle(document.querySelector('.post-sidebar')).position
    }
  })
  expect(mobile.h1).toBe(1)
  expect(mobile.overflow).toBe(0)
  expect(mobile.children.filter(name => name !== 'post-similar'))
    .toEqual(['post-article', 'post-sidebar', 'comments'])
  expect(mobile.sidebarTop).toBeGreaterThan(mobile.articleTop)
  expect(mobile.commentsTop).toBeGreaterThan(mobile.sidebarTop)
  if (mobile.children.includes('post-similar')) {
    expect(mobile.children.at(-1)).toBe('post-similar')
    expect(mobile.similarTop).toBeGreaterThan(mobile.commentsTop)
  }
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
