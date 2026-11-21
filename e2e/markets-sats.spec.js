import { test, expect } from './fixtures'
import { runAxe, waitForApp } from './helpers'

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
      return json({
        bitcoin: { btc: 1, usd: 61704 },
        hive: { btc: 5.8829245e-7, usd: 0.0363 },
        hive_dollar: { btc: 1.602198869e-5, usd: 0.9886 },
        v4vapp: { sats_Hive: 57.1, sats_HBD: 1578.5 },
        stale: false,
        quote_age_s: 12
      })
    }
    if (url.endsWith('/v1') || url.includes('/v1?')) {
      return json({ message: 'alive', version: '6.6.1', config: { conv_fee_percent: 0.029, conv_fee_sats: 50, minimum_invoice_payment_sats: 1, maximum_invoice_payment_sats: 180000, min_max: { min: { sats: 50 } } } })
    }
    return json({}, 404)
  })
}

test.describe('Markets sats quote', () => {
  test('shows live sats rates and a conversion estimate', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)
    await page.goto('/markets')
    await waitForApp(page)

    const card = page.locator('.sats-quote')
    await expect(card).toBeVisible({ timeout: 30000 })
    await expect(card).toContainText('Live')
    await expect(card).toContainText('≈ 57 sats')
    await expect(card).toContainText('≈ 1,579 sats')
    await expect(card.locator('.sats-quote__result')).toContainText('0.634 HBD')
    await expect(card).toContainText('Quote 12s old')

    if (!process.env.OBSCURA_CDP) {
      const violations = await runAxe(page)
      expect(violations, 'markets with sats quote').toEqual([])
    }
  })
})
