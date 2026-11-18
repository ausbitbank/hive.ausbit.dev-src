import { test as base, expect } from '@playwright/test'
import { chromium } from 'playwright-core'

// The Chromium suite uses the stock Playwright fixtures. The Obscura fast suite
// sets OBSCURA_CDP to a CDP websocket endpoint; in that mode the browser
// fixture connects over CDP instead of launching Chromium.
const OBSCURA_CDP = process.env.OBSCURA_CDP || ''

export const test = OBSCURA_CDP
  ? base.extend({
      browser: async ({ browserName: _browserName }, use) => {
        const browser = await chromium.connectOverCDP(OBSCURA_CDP)
        await use(browser)
        await browser.close()
      }
    })
  : base

export { expect }
