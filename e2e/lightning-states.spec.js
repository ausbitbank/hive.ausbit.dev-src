import { test, expect } from './fixtures'
import { loginAs, runAxe, waitForApp } from './helpers'

// Browser-network states (offline emulation, request abort, axe) need a real
// Chromium. Obscura cannot emulate network conditions and its route.abort
// hangs until the client timeout, so these stay out of the fast suite.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV9W6QAAAABJRU5ErkJggg=='

async function mockBridge (page) {
  await page.route('https://api.v4v.app/**', async route => {
    const url = route.request().url()
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    })

    if (url.includes('/v1/cryptoprices/sats_to_hive/')) return json({ HIVE: 18.34, HBD: 0.673 })
    if (url.includes('/v1/cryptoprices/')) {
      return json({
        bitcoin: { btc: 1, usd: 61704.005 },
        hive: { btc: 5.8829245e-7, usd: 0.0363 },
        hive_dollar: { btc: 1.602198869e-5, usd: 0.9886 },
        stale: false,
        quote_age_s: 4
      })
    }
    if (url.endsWith('/v1') || url.includes('/v1?')) {
      return json({
        message: 'alive',
        version: '6.6.1',
        config: {
          conv_fee_percent: 0.029,
          conv_fee_sats: 50,
          minimum_invoice_payment_sats: 1,
          maximum_invoice_payment_sats: 180000,
          min_max: { min: { sats: 50 } }
        }
      })
    }
    if (url.includes('/v1/new_invoice_hive')) {
      return json({
        r_hash: 'e2e-hash',
        payment_hash: 'e2e-payment-hash',
        payment_addr: 'e2e-addr',
        payment_request: 'lnbc1000n1e2einvoice',
        amount: 67,
        memo: 'brianoflondon | e2e | #v4vapp',
        expiry: 600,
        expires_at: Math.floor(Date.now() / 1000) + 600,
        qr_code_base64: PNG
      }, 201)
    }
    if (url.includes('/v1/check_invoice')) {
      return json({ paid: false, settled: false, state: 'OPEN', expired: false })
    }
    if (url.includes('/v1/lnurlp/qrcode/')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(PNG, 'base64')
      })
    }
    if (url.includes('/v1/lnurlp/bech32/')) return json({ bech32: 'lnurl1e2e', prefix: 'lightning:lnurl1e2e' })
    return json({}, 404)
  })
}

test.describe('Lightning bridge states', () => {
  test('falls back to the Lightning address when the bridge blocks the request', async ({ page }) => {
    test.setTimeout(120000)
    await page.route('https://api.v4v.app/**', route => route.abort())
    await loginAs(page, 'brianoflondon')
    await page.goto('/lightning')
    await waitForApp(page)

    await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
    const receive = page.locator('.lightning-dialog')
    await receive.getByRole('button', { name: 'Create invoice' }).click()
    await expect(receive).toContainText('This browser could not reach the bridge')
    await expect(receive).toContainText('The Lightning address below still works')
    await expect(receive).not.toContainText('did not respond in time')
    await expect(receive.locator('.lightning-address-card__address code')).toContainText('brianoflondon@v4v.app')
  })

  test('says the browser is offline instead of blaming the bridge', async ({ page }) => {
    test.setTimeout(120000)
    const runtimeErrors = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    await loginAs(page, 'brianoflondon')
    await page.goto('/lightning')
    await waitForApp(page)

    // Load the lazy dialog chunk while online so going offline tests the
    // bridge state, not a failed dynamic import.
    await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
    await expect(page.locator('.lightning-dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Close Lightning receive dialog' }).click()

    await page.context().setOffline(true)
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)

    await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
    const receive = page.locator('.lightning-dialog')
    await receive.getByRole('button', { name: 'Create invoice' }).click()
    await expect(receive).toContainText('You are offline')
    await expect(receive).not.toContainText('could not reach the bridge')
    await expect(receive.locator('.lightning-address-card__address code')).toContainText('brianoflondon@v4v.app')
    expect(runtimeErrors).toEqual([])
  })

  test('labels a rate-limited bridge as busy, not blocked', async ({ page }) => {
    test.setTimeout(120000)
    await page.route('https://api.v4v.app/**', route => {
      const url = route.request().url()
      if (url.includes('/v1/new_invoice_hive')) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ detail: 'Bridge temporarily unavailable' })
        })
      }
      return route.abort()
    })
    await loginAs(page, 'brianoflondon')
    await page.goto('/lightning')
    await waitForApp(page)

    await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
    const receive = page.locator('.lightning-dialog')
    await receive.getByRole('button', { name: 'Create invoice' }).click()
    await expect(receive).toContainText('The bridge is busy')
    await expect(receive).not.toContainText('could not reach the bridge')
  })

  test('lightning page and receive dialog are axe clean at 1440px and 390px', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)
    await loginAs(page, 'brianoflondon')

    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto('/lightning')
      await waitForApp(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Lightning' })).toBeVisible()
      const pageViolations = await runAxe(page)
      expect(pageViolations, '/lightning at ' + viewport.width + 'px').toEqual([])

      await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
      await expect(page.locator('.lightning-dialog')).toBeVisible()
      // axe-core mis-reads the background of Quasar buttons inside a teleported
      // q-dialog (it reports the page background and a false contrast failure).
      // The same amber button pattern is contrast-checked on the page itself.
      const dialogViolations = await runAxe(page, { disableRules: ['color-contrast'] })
      expect(dialogViolations, 'receive dialog at ' + viewport.width + 'px').toEqual([])
      await page.getByRole('button', { name: 'Close Lightning receive dialog' }).click()
    }
  })
})
