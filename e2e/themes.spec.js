import { test, expect } from './fixtures'
import { waitForApp } from './helpers'

const HIVE_HOSTS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://api.deathwing.me',
  'https://rpc.mahdiyari.info',
  'https://techcoderx.com',
  'https://api.syncad.com',
  'https://hive.atexoras.com:2096',
  'https://hiveapi.actifit.io',
  'https://api.c0ff33a.uk'
]

const SKIN = {
  schema: 'hive.ausbit.dev/theme@1',
  scope: 'profile',
  id: 'e2e-neon',
  name: 'E2E Neon',
  mood: 'A test skin',
  description: 'A test skin.',
  author: 'ausbitbank',
  remixedFrom: null,
  tags: ['dark', 'test'],
  mode: 'dark',
  tokens: {
    bg: '#070a18',
    surface: '#10152b',
    surfaceAlt: '#161d38',
    text: '#eef2ff',
    muted: '#9aa8d6',
    border: '#2a3560',
    primary: '#5ce1e6',
    secondary: '#ff5cc8',
    accent: '#a78bfa',
    positive: '#4ade80',
    negative: '#fb7185',
    warning: '#fbbf24',
    info: '#60a5fa'
  },
  type: { body: 'sans', display: 'grotesk', mono: 'mono' },
  shape: { radius: 'soft', border: 'hairline', shadow: 'glow' },
  effects: { texture: 'grid', motion: 'none', ambient: 'none' },
  profile: {
    background: 'mesh',
    avatarFrame: 'ring',
    nameplate: 'gradient',
    card: 'glass',
    ticker: 'E2E skin ticker',
    stickers: ['hex'],
    banner: null
  }
}

test('appearance switches to Hive Light and persists after reload', async ({ page }) => {
  await page.goto('/appearance')
  await waitForApp(page)
  await page.locator('.theme-card').filter({ hasText: 'Hive Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hive-light')
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  await expect(page.locator('body')).toHaveClass(/body--light/)

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hive-light')
  await expect(page.locator('body')).toHaveClass(/body--light/)
})

test('a published profile skin is scoped and can be hidden', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')

  for (const host of HIVE_HOSTS) {
    await page.route(host + '/**', async route => {
      const payload = route.request().postDataJSON?.() || {}
      if (payload.method !== 'condenser_api.get_accounts') return route.continue()
      const response = await route.fetch()
      const json = await response.json()
      if (Array.isArray(json.result)) {
        for (const account of json.result) {
          if (account?.name !== 'ausbitbank') continue
          let metadata
          try { metadata = JSON.parse(account.posting_json_metadata || '{}') } catch { metadata = {} }
          metadata['hive.ausbit.dev'] = { theme: SKIN }
          account.posting_json_metadata = JSON.stringify(metadata)
        }
      }
      await route.fulfill({ response, json })
    })
  }

  await page.goto('/@ausbitbank')
  await waitForApp(page)
  const skin = page.locator('.skin-scope')
  await expect(skin).toBeVisible()
  await expect(page.locator('.skin-badge')).toContainText('Skin by')
  await expect(page.locator('.skin-ticker')).toContainText('E2E skin ticker')
  await expect(skin).toHaveAttribute('data-skin-background', 'mesh')
  await expect(skin).toHaveAttribute('data-avatar-frame', 'ring')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hive-dark')

  await page.getByRole('button', { name: 'Hide skins' }).click()
  await expect(page.locator('.skin-scope')).toHaveCount(0)
  const preference = await page.evaluate(() => JSON.parse(localStorage.getItem('ausbit:appearance') || '{}').profileSkins)
  expect(preference).toBe('off')
})
