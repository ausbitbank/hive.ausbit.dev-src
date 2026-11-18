import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

const POST_ROUTE = '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'
const SLOW_4G = { latency: 100, download: 6_000_000 / 8, upload: 3_000_000 / 8 }

async function measureRoute (browser, route) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block'
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__w24cls = 0
    window.__w24lcp = null
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__w24cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__w24lcp = entry.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })

  const client = await context.newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: SLOW_4G.latency,
    downloadThroughput: SLOW_4G.download,
    uploadThroughput: SLOW_4G.upload,
    connectionType: 'cellular4g'
  })

  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => Boolean(document.querySelector('#q-app')?.__vue_app__), null, { timeout: 60000 })
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 90000 })
  await page.waitForTimeout(6000)

  const metrics = await page.evaluate(() => {
    return {
      cls: window.__w24cls || 0,
      lcp: window.__w24lcp,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }
  })
  await context.close()
  return metrics
}

test.describe('performance smoke', () => {
  test('slow-4G home, wallet and post stay inside LCP/CLS budgets', async ({ browser }) => {
    test.setTimeout(240000)
    const routes = ['/', '/@ausbitbank/wallet', POST_ROUTE]
    for (const route of routes) {
      const metrics = await measureRoute(browser, route)
      console.log(route, JSON.stringify(metrics))
      expect(metrics.lcp, route + ' LCP').not.toBeNull()
      expect(metrics.lcp, route + ' LCP').toBeLessThan(8000)
      expect(metrics.cls, route + ' CLS').toBeLessThan(0.1)
      expect(metrics.overflow, route + ' overflow').toBe(0)
    }
  })

  test('developer performance panel is query-gated and accessible', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByRole('complementary', { name: 'Performance diagnostics' })).toBeHidden()

    await page.goto('/?perf=1')
    await waitForApp(page)
    const panel = page.getByRole('complementary', { name: 'Performance diagnostics' })
    await expect(panel).toBeVisible({ timeout: 30000 })
    await expect(panel).toContainText('Read cache')
    await expect(panel).toContainText('API nodes')
    await expect(panel).toContainText('Loaded assets')
    expect(await runAxe(page)).toEqual([])

    await panel.getByRole('button', { name: 'Close performance panel' }).click()
    await expect(panel).toBeHidden()
  })
})
