import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

const POST_ROUTE = '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'
const ROUTES = [
  '/',
  '/browse',
  '/blocks',
  '/witnesses',
  '/proposals',
  '/hbd',
  '/market',
  '/markets',
  '/@ausbitbank',
  '/@ausbitbank/wallet',
  '/@ausbitbank/delegations',
  '/c/hive-174578',
  POST_ROUTE
]

for (const route of ROUTES) {
  test('axe clean: ' + route, async ({ page }) => {
    test.setTimeout(120000)
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await waitForApp(page)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 25000 })
      await page.waitForTimeout(3500)
      const violations = await runAxe(page)
      expect(violations, route + ' at ' + viewport.width + 'px').toEqual([])
    }
  })
}
