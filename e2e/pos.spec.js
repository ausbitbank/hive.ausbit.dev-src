import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV9W6QAAAABJRU5ErkJggg=='
const POST_ROUTE = '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'

async function mockBridge (page, { amountSats = 5000, paid = true } = {}) {
  const invoices = []
  await page.route('https://api.v4v.app/**', async route => {
    const url = route.request().url()
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    })

    if (url.includes('/v1/new_invoice_hive')) {
      const body = JSON.parse(route.request().postData() || '{}')
      invoices.push(body)
      const requested = Number(body.sats_amount || body.hbd_amount || body.hive_amount || body.usd_amount || amountSats)
      return json({
        r_hash: 'pos-hash-' + invoices.length,
        payment_hash: 'pos-payment-hash-' + invoices.length,
        payment_addr: 'pos-addr',
        payment_request: 'lnbc5000n1posinvoice' + invoices.length,
        amount: requested,
        memo: 'ausbitbank | POS via hive.ausbit.dev',
        expiry: 900,
        expires_at: Math.floor(Date.now() / 1000) + 900,
        qr_code_base64: PNG
      }, 201)
    }
    if (url.includes('/v1/check_invoice')) {
      return json({ paid, settled: paid, state: paid ? 'SETTLED' : 'OPEN', expired: false })
    }
    if (url.includes('/v1/cryptoprices/')) {
      return json({ bitcoin: { btc: 1, usd: 61704 }, hive: { btc: 5.8829245e-7, usd: 0.0363 }, hive_dollar: { btc: 1.602198869e-5, usd: 0.9886 } })
    }
    if (url.endsWith('/v1') || url.includes('/v1?')) {
      return json({ message: 'alive', version: '6.6.1', config: { conv_fee_percent: 0.029, conv_fee_sats: 50, minimum_invoice_payment_sats: 1, maximum_invoice_payment_sats: 180000, min_max: { min: { sats: 50 } } } })
    }
    if (url.includes('/v1/lnurlp/qrcode/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(PNG, 'base64') })
    }
    if (url.includes('/v1/lnurlp/bech32/')) return json({ bech32: 'lnurl1e2e' })
    return json({}, 404)
  })
  return invoices
}

test.describe('Lightning point of sale', () => {
  test('creates fresh invoices and totals the local session', async ({ page }) => {
    test.setTimeout(120000)
    const invoices = await mockBridge(page)
    await page.goto('/@ausbitbank/pos')
    await waitForApp(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText('@ausbitbank')
    await expect(page.locator('.pos-amount__value')).toHaveText('0')

    for (const key of ['5', '0', '0', '0']) {
      await page.getByRole('button', { name: key, exact: true }).click()
    }
    await expect(page.locator('.pos-amount__value')).toHaveText('5000')
    await page.getByRole('button', { name: 'Create invoice' }).click()

    await expect(page.locator('.lightning-invoice__sats')).toContainText('5,000 sats')
    await expect(page.locator('.pos-paid')).toContainText('Paid')
    await expect(page.locator('.pos-session')).toContainText('1 sale · 5,000 sats')
    expect(invoices[0]).toMatchObject({ sats_amount: 5000, receive_currency: 'hbd', app_name: 'hiveausbit' })
    expect(invoices[0].message).toContain('POS via hive.ausbit.dev')

    await page.getByRole('button', { name: 'New sale' }).click()
    await expect(page.locator('.pos-amount__value')).toHaveText('0')
    for (const key of ['1', '0', '0', '0']) {
      await page.getByRole('button', { name: key, exact: true }).click()
    }
    await page.getByRole('button', { name: 'Create invoice' }).click()
    await expect(page.locator('.pos-session')).toContainText('2 sales · 6,000 sats')
    expect(invoices[1]).toMatchObject({ sats_amount: 1000 })

    if (!process.env.OBSCURA_CDP) {
      const violations = await runAxe(page)
      expect(violations, 'POS paid state').toEqual([])
    }
  })

  test('pos page is axe clean at 1440px and 390px', async ({ page }) => {
    test.skip(Boolean(process.env.OBSCURA_CDP), 'axe runs in Chromium')
    test.setTimeout(120000)
    await mockBridge(page)

    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 900 }]) {
      await page.setViewportSize(viewport)
      await page.goto('/@ausbitbank/pos')
      await waitForApp(page)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const violations = await runAxe(page)
      expect(violations, '/@ausbitbank/pos at ' + viewport.width + 'px').toEqual([])
    }
  })

  test('post zap opens the invoice dialog with sats presets', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page, { amountSats: 5000 })
    await page.goto(POST_ROUTE)
    await waitForApp(page)

    const zap = page.getByRole('button', { name: 'Zap this author with Lightning sats' })
    await expect(zap).toBeVisible({ timeout: 30000 })
    await zap.click()

    const dialog = page.locator('.lightning-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText('Zap @ausbitbank')
    await expect(dialog.getByRole('button', { name: '5k' })).toBeVisible()
    await dialog.getByRole('button', { name: '5k' }).click()
    await expect(dialog.getByRole('spinbutton', { name: 'Invoice amount' })).toHaveValue('5000')

    await dialog.getByRole('button', { name: 'Create invoice' }).click()
    await expect(dialog.locator('.lightning-invoice__status')).toContainText('Paid', { timeout: 15000 })
    await dialog.getByRole('button', { name: 'Close Lightning receive dialog' }).click()
  })
})
