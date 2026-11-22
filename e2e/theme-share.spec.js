import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

test.use({ serviceWorkers: 'block' })

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

const ALICE_THEME = {
  schema: 'hive.ausbit.dev/theme@1',
  scope: 'profile',
  id: 'alice-neon',
  name: 'Alice Neon',
  mood: 'A wall card to remix',
  description: 'A published skin used by the theme-sharing E2E test.',
  author: 'alice',
  remixedFrom: null,
  tags: ['dark', 'neon', 'featured'],
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
    status: { text: 'On the theme wall', icon: 'spark' },
    circle: [],
    badges: { selected: [{ source: 'peakd', id: 'badge-069069' }], showLevel: false },
    post: 'none',
    atmosphere: { source: 'none', treatment: 'duotone', intensity: 'medium' },
    visual: { link: 'glow', button: 'pill', chip: 'stamp', divider: 'hex', image: 'rounded', gradient: 'diagonal' },
    banner: null
  }
}

function account (name, metadata = {}) {
  return {
    name,
    json_metadata: '{}',
    posting_json_metadata: JSON.stringify(metadata),
    vesting_shares: '0.000000 VESTS',
    received_vesting_shares: '0.000000 VESTS',
    delegated_vesting_shares: '0.000000 VESTS',
    vesting_withdraw_rate: '0.000000 VESTS',
    last_vote_time: '2026-11-01T00:00:00',
    voting_power: 10000,
    post_count: 0,
    created: '2020-01-01T00:00:00',
    reputation: 0
  }
}

async function mockChain (page) {
  for (const host of HIVE_HOSTS) {
    await page.route(host + '/**', async route => {
      const payload = route.request().postDataJSON?.() || {}
      if (payload.method === 'condenser_api.get_following') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [{ following: 'alice' }] })
        })
        return
      }
      if (payload.method === 'condenser_api.get_followers') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [{ follower: 'badge-069069' }] })
        })
        return
      }
      if (payload.method === 'condenser_api.get_accounts') {
        const names = payload.params?.[0] || []
        const result = names.map(name => {
          if (name === 'alice') {
            return account('alice', {
              profile: { name: 'Alice', about: 'A Hive author', profile_image: 'https://images.hive.blog/u/alice/avatar' },
              'hive.ausbit.dev': { theme: ALICE_THEME }
            })
          }
          if (name === 'badge-069069') {
            return account('badge-069069', {
              profile: {
                name: 'NFT Showroom Verified Artist',
                about: 'Verified by the NFT Showroom team',
                profile_image: 'https://files.peakd.com/file/badge.png'
              }
            })
          }
          return account(name)
        })
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result })
        })
        return
      }
      if (payload.method === 'bridge.get_account_posts') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [] })
        })
        return
      }
      await route.continue()
    })
  }
  await page.route('https://hivebuzz.me/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7h8AAAAASUVORK5CYII=', 'base64')
  await page.route('https://images.hive.blog/**', async route => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: png })
  })
  await page.route('https://files.peakd.com/**', async route => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: png })
  })
}

test('wall filters, remix and adopt palette stay local', async ({ page }) => {
  await loginAs(page, 'viewer')
  await mockChain(page)
  await page.goto('/themes')
  await waitForApp(page)

  await page.getByRole('tab', { name: 'Following' }).click()
  const aliceCard = page.locator('.wall-card--skin').filter({ hasText: '@alice' })
  await expect(aliceCard).toBeVisible()

  const search = page.locator('.wall-filters__search input')
  await search.fill('nobody')
  await expect(page.getByRole('heading', { name: 'No skins here yet' })).toBeVisible()
  await search.fill('alice')
  await expect(aliceCard).toBeVisible()

  await aliceCard.getByRole('button', { name: 'Remix' }).click()
  await expect(page).toHaveURL(/\/settings\/skin\?remix=1/)
  await expect(page.locator('.studio-remix')).toContainText('Remix of @alice')
  await expect(page.locator('.studio-remix')).toContainText('not yet published')

  await page.goto('/themes')
  await waitForApp(page)
  await page.getByRole('tab', { name: 'Following' }).click()
  await page.locator('.wall-card--skin').filter({ hasText: '@alice' }).getByRole('button', { name: 'Use palette' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Alice Neon')
  await dialog.getByRole('button', { name: 'Use this palette' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom')
  const adopted = await page.evaluate(() => JSON.parse(localStorage.getItem('ausbit:appearance') || '{}').customTheme)
  expect(adopted.name).toBe('Alice Neon')
  expect(adopted.mood).toContain('@alice')
})

test('viewer skin controls persist and reverse', async ({ page }) => {
  await page.goto('/appearance')
  await waitForApp(page)

  const status = page.getByLabel('Show profile status lines')
  const extras = page.getByLabel('Show profile shelf extras')
  await status.click()
  await extras.click()

  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ausbit:appearance') || '{}'))
  expect(stored.showSkinStatus).toBe(false)
  expect(stored.showSkinExtras).toBe(false)

  await page.reload()
  await waitForApp(page)
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ausbit:appearance') || '{}'))
  expect(stored.showSkinStatus).toBe(false)
  expect(stored.showSkinExtras).toBe(false)

  await page.getByLabel('Show profile status lines').click()
  await page.getByLabel('Show profile shelf extras').click()
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('ausbit:appearance') || '{}').showSkinStatus)).toBe(true)
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('ausbit:appearance') || '{}').showSkinExtras)).toBe(true)
})

test('studio badge picker adds an earned badge to the preview', async ({ page }) => {
  await loginAs(page, 'viewer')
  await mockChain(page)

  await page.goto('/settings/skin')
  await waitForApp(page)
  await expect(page.locator('.studio-publish')).toBeVisible({ timeout: 20000 })

  const badgeRow = page.locator('.studio-section').filter({ hasText: 'Issued by PeakD or HiveBuzz' }).locator('.q-select')
  await expect(badgeRow).toBeVisible()
  await badgeRow.click()
  await page.locator('.q-menu .q-item').filter({ hasText: 'NFT Showroom Verified Artist' }).click()
  await page.keyboard.press('Escape')

  await expect(page.locator('.studio-preview').getByRole('button', { name: /NFT Showroom Verified Artist/ })).toBeVisible()
})

test('theme code export and import preview before apply', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await loginAs(page, 'viewer')
  await mockChain(page)
  await page.goto('/settings/skin')
  await waitForApp(page)
  await expect(page.locator('.studio-publish')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: 'Copy theme code' }).click()
  await page.waitForTimeout(250)
  const code = await page.evaluate(() => navigator.clipboard.readText())
  expect(code.startsWith('hive-theme:1:')).toBe(true)

  await page.getByRole('button', { name: 'Import code' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('textarea').fill(code)
  await dialog.getByRole('button', { name: 'Check code' }).click()
  await expect(dialog.locator('.studio-import__preview')).toBeVisible()
  await expect(dialog).toContainText('My Hive skin')
  await dialog.getByRole('button', { name: 'Use this theme' }).click()
  await expect(page.getByRole('button', { name: 'Copy theme code' })).toBeVisible()

  await page.getByRole('button', { name: 'Import code' }).click()
  const badDialog = page.getByRole('dialog')
  await badDialog.locator('textarea').fill('not a theme code')
  await badDialog.getByRole('button', { name: 'Check code' }).click()
  await expect(badDialog.locator('.studio-errors')).toContainText('not a Hive theme code')
})
