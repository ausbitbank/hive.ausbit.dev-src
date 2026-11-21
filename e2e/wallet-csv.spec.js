import { readFile } from 'node:fs/promises'
import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

// Downloads need a real Chromium; this spec is excluded from the Obscura suite.
test.describe('Wallet CSV export', () => {
  test('downloads the loaded activity as a tax-friendly CSV', async ({ page }) => {
    test.setTimeout(180000)
    await loginAs(page, 'ausbitbank')
    await page.goto('/@ausbitbank/wallet')
    await waitForApp(page)

    const button = page.getByRole('button', { name: 'Export loaded activity as CSV' }).first()
    await expect(button).toBeVisible({ timeout: 60000 })

    const downloadPromise = page.waitForEvent('download')
    await button.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^hive-wallet-ausbitbank-\d{4}-\d{2}-\d{2}\.csv$/)

    const path = await download.path()
    expect(path).toBeTruthy()
    const csv = await readFile(path, 'utf8')
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe('timestamp,rail,direction,asset,amount,sats,fee_sats,hive_equivalent,counterparty,invoice_hash,parent_id,txid,status')
    expect(lines.length).toBeGreaterThan(2)
    for (const line of lines.slice(1)) {
      expect(line.split(',').length).toBeGreaterThanOrEqual(13)
    }
  })
})
