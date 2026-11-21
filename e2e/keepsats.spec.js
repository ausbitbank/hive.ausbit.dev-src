import { test, expect } from './fixtures'
import { loginAs, runAxe, waitForApp } from './helpers'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV9W6QAAAABJRU5ErkJggg=='
const PUBLIC_KEY = 'STM5Q3cRD4aBmm1dSgxQf9y2KtPakZkgT3uEZM2QjHSsNVKivzTFK'

function keepsatsPayload () {
  return {
    hive_accname: 'ausbitbank',
    net_msats: 12345000,
    net_sats: 12345,
    net_hive: 214.5,
    net_hbd: 7.7,
    net_usd: 7.8,
    in_progress_sats: 500,
    admin: false,
    all_transactions: {
      sub: 'ausbitbank',
      sats: '12345',
      hive: '214.5',
      hbd: '7.7',
      usd: '7.8',
      last_transaction_date: '2026-11-21T10:00:00Z',
      in_progress_msats: '500000'
    }
  }
}

async function mockBridge (page, { rejectSignature = false } = {}) {
  await page.route('https://api.v4v.app/**', async route => {
    const url = route.request().url()
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    })

    if (url.includes('/auth/validate/')) {
      return rejectSignature
        ? json({ detail: 'ERROR: message was signed with a different key' }, 401)
        : json({
            access_token: 'test-token',
            token_type: 'bearer',
            expire: Math.floor(Date.now() / 1000) + 1800
          })
    }
    if (url.includes('/auth/')) {
      return json({ challenge: 'alpha beta gamma ausbitbank 1795256725.540959 client hive.ausbit.dev' })
    }
    if (url.includes('/v2/v4vapp/keepsats')) return json(keepsatsPayload())
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

async function fakeKeychain (page) {
  await page.addInitScript(({ publicKey }) => {
    window.hive_keychain = {
      requestSignBuffer: (account, message, keyType, callback) => {
        callback({ success: true, result: '1f'.repeat(65), publicKey, data: { message, username: account } })
      }
    }
  }, { publicKey: PUBLIC_KEY })
}

async function openKeepsats (page) {
  await loginAs(page, 'ausbitbank')
  await fakeKeychain(page)
  await page.goto('/@ausbitbank/wallet')
  await waitForApp(page)
  const panel = page.locator('.keepsats')
  await expect(panel).toBeVisible({ timeout: 30000 })
  await expect(panel).toContainText('Custodial')
  return panel
}

test.describe('Keepsats read-only session', () => {
  test('reads a balance with a posting-key session and keeps the token out of storage', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page)
    const panel = await openKeepsats(page)

    await panel.getByRole('button', { name: 'Read balance' }).click()
    await expect(panel).toContainText('12,345 sats')
    await expect(panel).toContainText('≈ 7.700 HBD')
    await expect(panel).toContainText('500 sats in flight')
    await expect(panel).toContainText('Read-only session')
    await expect(panel).toContainText('Keepsats are an IOU from v4v.app')

    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage }
    }))
    expect(JSON.stringify(storage)).not.toContain('test-token')
    expect(JSON.stringify(storage)).not.toContain('1f1f1f')
    expect(JSON.stringify(storage)).toContain('v4vapp:clientId')

    if (!process.env.OBSCURA_CDP) {
      const violations = await runAxe(page)
      expect(violations, 'wallet with keepsats connected').toEqual([])
    }

    await page.reload()
    await waitForApp(page)
    await expect(page.locator('.keepsats')).toContainText('Read balance')
    await expect(page.locator('.keepsats')).not.toContainText('12,345 sats')
  })

  test('reports a rejected posting signature without leaving a session', async ({ page }) => {
    test.setTimeout(120000)
    await mockBridge(page, { rejectSignature: true })
    const panel = await openKeepsats(page)

    await panel.getByRole('button', { name: 'Read balance' }).click()
    await expect(panel).toContainText('signed with a different key')
    await expect(panel.getByRole('button', { name: 'Read balance' })).toBeVisible()
    await expect(panel).not.toContainText('Read-only session')
  })
})
