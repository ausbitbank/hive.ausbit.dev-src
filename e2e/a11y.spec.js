import { test, expect } from './fixtures'
import { installMockRelay, openHiveAuthLogin } from './hiveauth-mock'
import { loginAs, readDrafts, runAxe, waitForApp } from './helpers'

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
  '/@ausbitbank/tip',
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

  for (const label of ['Everyday', 'Creator', 'Community', 'Trader']) {
    await applyTemplate(label)
    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(3500)
      const violations = await runAxe(page)
      expect(violations, label + ' template at ' + viewport.width + 'px').toEqual([])
    }
  }
})

test('axe clean: HiveAuth login dialog', async ({ page }) => {
  test.setTimeout(120000)
  await installMockRelay(page)
  await openHiveAuthLogin(page)
  await expect(page.locator('.login-hiveauth-qr')).toBeVisible()

  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(500)
    const violations = await runAxe(page, { context: '.login-hiveauth-card' })
    expect(violations, 'HiveAuth dialog at ' + viewport.width + 'px').toEqual([])
  }
})

test('axe clean: compose unsaved-changes and rename dialogs', async ({ page }) => {
  test.setTimeout(180000)
  await loginAs(page)
  await page.goto('/compose')
  await waitForApp(page)
  await page.getByLabel('Post title').fill('Accessibility guard draft')
  await page.getByLabel('Post body in Markdown').fill('Saved body')
  await expect.poll(async () => {
    const stored = await readDrafts(page)
    return stored?.drafts?.some(draft => draft.title === 'Accessibility guard draft')
  }).toBe(true)

  await page.getByRole('button', { name: 'Editor settings' }).dispatchEvent('click')
  await page.getByLabel('Autosave drafts').click()
  await page.getByRole('button', { name: 'Close editor settings' }).click()
  await page.getByLabel('Post body in Markdown').fill('Unsaved body')
  await page.locator('.site-brand').click()
  const leave = page.getByRole('dialog').filter({ hasText: 'Unsaved changes' })
  await expect(leave).toBeVisible()

  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(300)
    const violations = await runAxe(page)
    expect(violations, 'unsaved-changes dialog at ' + viewport.width + 'px').toEqual([])
  }
  await leave.getByRole('button', { name: 'Stay' }).click()

  await page.getByRole('button', { name: /^Rename draft/ }).click()
  const rename = page.getByRole('dialog').filter({ hasText: 'Rename draft' })
  await expect(rename).toBeVisible()
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(300)
    const violations = await runAxe(page)
    expect(violations, 'rename dialog at ' + viewport.width + 'px').toEqual([])
  }
})
