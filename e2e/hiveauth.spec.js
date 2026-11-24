import { expect, test } from './fixtures'
import { installMockRelay, openHiveAuthLogin } from './hiveauth-mock'
import { waitForApp } from './helpers'

test('HiveAuth login shows a QR request and can be cancelled', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await installMockRelay(page)
  await openHiveAuthLogin(page)

  await expect(page.locator('.login-hiveauth-card')).toBeVisible()
  await expect(page.locator('.login-hiveauth-qr')).toBeVisible()
  await expect(page.locator('.login-hiveauth-card')).toContainText('Waiting for wallet')

  // Obscura's independent layout engine does not position the dialog controls
  // reliably enough for the click target; Chromium covers the cancel path.
  if (test.info().project.name === 'chromium') {
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.login-hiveauth-card')).toBeHidden()
  }
  expect(pageErrors).toEqual([])
})

test('HiveAuth login resumes the pending request after a reload', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await installMockRelay(page, { attachNack: true })
  await openHiveAuthLogin(page)
  await expect(page.locator('.login-hiveauth-qr')).toBeVisible()

  await page.reload()
  await waitForApp(page)

  await expect(page.locator('.login-hiveauth-card')).toBeVisible()
  await expect(page.locator('.login-hiveauth-card')).toContainText('expired before it could be resumed')
  expect(await page.evaluate(() => sessionStorage.getItem('e2e-has-attach'))).toBe('e2e-hiveauth-uuid')

  if (test.info().project.name === 'chromium') {
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.login-hiveauth-card')).toBeHidden()
  }
  expect(pageErrors).toEqual([])
})
