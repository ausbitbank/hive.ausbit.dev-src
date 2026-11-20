import { test, expect } from './fixtures'
import { loginAs, readQueue, waitForApp } from './helpers'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV9W6QAAAABJRU5ErkJggg=='

async function mockBridge (page, { paid = true } = {}) {
  await page.route('https://api.v4v.app/**', async route => {
    const url = route.request().url()
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    })

    if (url.includes('/v1/cryptoprices/sats_to_hive/')) {
      return json({ HIVE: 18.34, HBD: 0.673 })
    }
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
        version: '6.6.0',
        config: {
          conv_fee_percent: 0.029,
          conv_fee_sats: 50,
          minimum_invoice_payment_sats: 50,
          maximum_invoice_payment_sats: 180000
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
      return json({ paid, settled: paid, state: paid ? 'SETTLED' : 'OPEN', expired: false })
    }
    if (url.includes('/v1/lnurlp/qrcode/')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.from(PNG, 'base64')
      })
    }
    if (url.includes('/v1/lnurlp/bech32/')) {
      return json({ bech32: 'lnurl1e2e', prefix: 'lightning:lnurl1e2e' })
    }
    return json({}, 404)
  })
}

test.describe('Lightning bridge', () => {
  test('receives a sats invoice and queues a reviewed payment', async ({ page }) => {
    test.setTimeout(120000)
    const runtimeErrors = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    await mockBridge(page)
    await loginAs(page, 'brianoflondon')
    await page.goto('/lightning')
    await waitForApp(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Lightning' })).toBeVisible()
    await expect(page.locator('.lightning-address-card__address code').first()).toContainText('brianoflondon@v4v.app')

    await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
    const receive = page.locator('.lightning-dialog')
    await expect(receive).toBeVisible()
    await receive.getByRole('button', { name: 'Create invoice' }).click()
    await expect(page.locator('.lightning-invoice__sats')).toContainText('67 sats')
    await expect(page.locator('.lightning-invoice__status')).toContainText('Paid', { timeout: 15000 })
    await receive.getByRole('button', { name: 'Close Lightning receive dialog' }).click()

    await page.getByRole('button', { name: 'Pay a Lightning invoice' }).click()
    const pay = page.locator('.lightning-pay')
    await expect(pay).toBeVisible()
    await pay.getByLabel('Lightning invoice or address').fill('alice@getalby.com')
    await pay.getByRole('button', { name: 'Review payment' }).click()
    await pay.locator('.lightning-pay__sats-input input').fill('1000')
    await expect(pay.locator('.lightning-pay__summary-row--total strong')).toContainText('1,079 sats')
    await expect(pay.locator('.lightning-pay__balance')).toContainText('HBD')
    await expect(pay.locator('.lightning-pay__balance')).not.toContainText('Not enough')
    await pay.getByRole('button', { name: 'Queue payment' }).click()
    await expect(pay.locator('.lightning-pay__queued')).toContainText('Payment queued for review')

    await expect.poll(async () => {
      const queue = await readQueue(page)
      const item = queue?.items?.[0]
      return {
        to: item?.[2]?.[1]?.to,
        amount: item?.[2]?.[1]?.amount,
        memo: item?.[2]?.[1]?.memo,
        manualOnly: queue?.meta?.[0]?.manualOnly
      }
    }).toEqual({
      to: 'v4vapp',
      amount: '0.673 HBD',
      memo: 'alice@getalby.com #HBD #v4vapp',
      manualOnly: true
    })

    expect(runtimeErrors).toEqual([])
  })

  test('falls back to the Lightning address when invoice creation is blocked', async ({ page }) => {
    test.setTimeout(120000)
    await page.route('https://api.v4v.app/**', route => route.abort())
    await loginAs(page, 'brianoflondon')
    await page.goto('/lightning')
    await waitForApp(page)

    await page.getByRole('button', { name: 'Create a fixed invoice' }).click()
    const receive = page.locator('.lightning-dialog')
    await receive.getByRole('button', { name: 'Create invoice' }).click()
    await expect(receive).toContainText('cannot create a live invoice')
    await expect(receive.locator('.lightning-address-card__address code')).toContainText('brianoflondon@v4v.app')
  })
})
