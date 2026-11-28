import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

const ADDRESS = 'alice@getalby.com'
const INVOICE = 'lnbc1000u1p' + 'a'.repeat(40)

async function mockBridge (page) {
  await page.route('https://api.v4v.app/**', async route => {
    const url = route.request().url()
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    })
    if (url.includes('/v1/cryptoprices/sats_to_hive/')) return json({ HIVE: 17.5, HBD: 0.634 })
    if (url.includes('/v1/cryptoprices/')) {
      return json({ bitcoin: { btc: 1, usd: 61704 }, hive: { btc: 5.8829245e-7, usd: 0.0363 }, hive_dollar: { btc: 1.602198869e-5, usd: 0.9886 } })
    }
    if (url.endsWith('/v1') || url.includes('/v1?')) {
      return json({ message: 'alive', version: '6.6.1', config: { conv_fee_percent: 0.029, conv_fee_sats: 50, minimum_invoice_payment_sats: 1, maximum_invoice_payment_sats: 180000, min_max: { min: { sats: 50 } } } })
    }
    if (url.includes('/v1/lnurlp/qrcode/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV9W6QAAAABJRU5ErkJggg==', 'base64') })
    }
    if (url.includes('/v1/lnurlp/bech32/')) return json({ bech32: 'lnurl1e2e' })
    return json({}, 404)
  })
}

test.describe('Lightning search and links', () => {
  test('recognises an invoice and an address in search', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)

    await page.goto('/search?q=' + encodeURIComponent(INVOICE))
    await waitForApp(page)
    const invoiceCard = page.locator('.search-lightning')
    await expect(invoiceCard).toBeVisible({ timeout: 30000 })
    await expect(invoiceCard).toContainText('Lightning invoice')
    await expect(invoiceCard.getByRole('link', { name: 'Open payment' })).toHaveAttribute('href', /\/lightning\?pay=lnbc/)

    await page.goto('/search?q=' + encodeURIComponent(ADDRESS))
    await waitForApp(page)
    const addressCard = page.locator('.search-lightning')
    await expect(addressCard).toBeVisible({ timeout: 30000 })
    await expect(addressCard).toContainText('Lightning address')
    await expect(addressCard).toContainText(ADDRESS)
  })

  test('opens the pay dialog from a payment link when logged in', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)
    await loginAs(page, 'ausbitbank')

    await page.goto('/lightning?pay=' + encodeURIComponent(ADDRESS))
    await waitForApp(page)
    const pay = page.locator('.lightning-pay')
    await expect(pay).toBeVisible({ timeout: 30000 })
    await expect(pay.locator('.lightning-pay__invoice-value')).toContainText(ADDRESS)
    await expect(pay.getByRole('button', { name: 'Queue payment' })).toBeVisible()
    await expect(pay.locator('.lightning-pay__summary-row--total')).toContainText('1,134 sats')
  })

  test('spends an exact HBD amount from a payment link, fee included', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)
    await loginAs(page, 'brianoflondon')

    await page.goto('/lightning?pay=' + encodeURIComponent(ADDRESS) + '&account=brianoflondon&amount=5&currency=hbd')
    await waitForApp(page)
    const pay = page.locator('.lightning-pay')
    await expect(pay).toBeVisible({ timeout: 30000 })
    await expect(pay.locator('.lightning-pay__conversion')).toContainText('5.000 HBD total')
    await expect(pay.locator('.lightning-pay__conversion')).toContainText('7,670 sats invoice')
    await expect(pay.locator('.lightning-pay__balance')).toContainText('5.000 HBD')
    await expect(pay.locator('.lightning-pay__summary-row--total strong')).toContainText('8,011 sats')
    await expect(pay.getByRole('button', { name: 'Queue payment' })).toBeVisible()
  })

  test('explains a payment link to a logged-out visitor', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)
    await page.goto('/lightning?pay=' + encodeURIComponent(ADDRESS))
    await waitForApp(page)
    const banner = page.locator('.lightning-link-banner')
    await expect(banner).toBeVisible({ timeout: 20000 })
    await expect(banner).toContainText('payment link is ready')
    await expect(banner).toContainText(ADDRESS)
    await expect(page.locator('.lightning-pay')).toHaveCount(0)
  })
})
