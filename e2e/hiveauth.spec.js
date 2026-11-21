import { expect, test } from './fixtures'
import { waitForApp } from './helpers'

test('HiveAuth login shows a QR request and can be cancelled', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.addInitScript(() => {
    class MockWebSocket {
      constructor () {
        this.readyState = 0
        this.onopen = null
        this.onmessage = null
        this.onerror = null
        this.onclose = null
        setTimeout(() => {
          this.readyState = 1
          this.onopen?.()
          this.onmessage?.({
            data: JSON.stringify({
              cmd: 'connected',
              timeout: 60,
              version: '0.8.10',
              protocol: 0.8
            })
          })
        }, 10)
      }

      send (raw) {
        const message = JSON.parse(raw)
        if (message.cmd !== 'auth_req') return
        setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify({
              cmd: 'auth_wait',
              uuid: 'e2e-hiveauth-uuid',
              expire: Date.now() + 60_000
            })
          })
        }, 20)
      }

      close () {
        this.readyState = 3
      }
    }
    window.WebSocket = MockWebSocket
  })

  await page.goto('/')
  await waitForApp(page)

  await page.locator('.account-trigger').click()
  await page.locator('.login-username input').fill('ausbitbank')
  await page.locator('.login-username input').press('Enter')
  await page.getByRole('button', { name: 'HiveAuth' }).click()

  await expect(page.locator('.login-hiveauth-card')).toBeVisible()
  await expect(page.locator('.login-hiveauth-qr')).toBeVisible()
  await expect(page.locator('.login-hiveauth-card')).toContainText('Request expires in')

  // Obscura's independent layout engine does not position the dialog controls
  // reliably enough for the click target; Chromium covers the cancel path.
  if (test.info().project.name === 'chromium') {
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.login-hiveauth-card')).toBeHidden()
  }
  expect(pageErrors).toEqual([])
})
