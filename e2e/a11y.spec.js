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
  '/compose',
  '/communities',
  '/search',
  '/appearance',
  '/themes',
  '/settings/skin',
  '/settings/moderation',
  '/lightning',
  '/health',
  '/@ausbitbank',
  '/@ausbitbank/wallet',
  '/@ausbitbank/pos',
  '/@ausbitbank/delegations',
  '/@ausbitbank/downvotes',
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

test('axe clean: custom dashboard templates', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  const applyTemplate = async label => {
    await page.getByRole('button', { name: 'Customise', exact: true }).click()
    await page.getByRole('button', { name: 'Layouts' }).click()
    await page.locator('.q-menu').getByText(label, { exact: true }).click()
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
  }

  for (const label of ['Everyday', 'Creator']) {
    await applyTemplate(label)
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(3500)
      const violations = await runAxe(page)
      expect(violations, label + ' template at ' + viewport.width + 'px').toEqual([])
    }
  }
})
