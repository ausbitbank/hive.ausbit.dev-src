import { test, expect } from './fixtures'
import { loginAs, runAxe, waitForApp } from './helpers'

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

const SKIN = {
  schema: 'hive.ausbit.dev/theme@1',
  scope: 'profile',
  id: 'e2e-safety',
  name: 'E2E Safety',
  mood: 'A moderation test skin',
  description: 'A moderation test skin.',
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
    ticker: '',
    stickers: [],
    atmosphere: { source: 'cover', treatment: 'duotone', intensity: 'medium' },
    visual: { link: 'glow', button: 'pill', chip: 'stamp', divider: 'hex', image: 'rounded', gradient: 'diagonal' },
    banner: null
  }
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7h8AAAAASUVORK5CYII=',
  'base64'
)

async function mockChain (page, {
  reputation = 60,
  muted = [],
  followMuted = [],
  followedMuteMembers = {},
  following = [],
  rankedPosts = null
} = {}) {
  await page.route('https://images.hive.blog/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: PNG
  }))

  for (const host of HIVE_HOSTS) {
    await page.route(host + '/**', async route => {
      const payload = route.request().postDataJSON?.() || {}
      const params = payload.params || {}

      if (payload.method === 'bridge.get_ranked_posts' && rankedPosts) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: rankedPosts })
        })
      }

      if (payload.method === 'condenser_api.get_following') {
        const observer = Array.isArray(params) ? params[0] : params.account
        const rows = observer === 'viewer' ? following : []
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: rows.map(name => ({ following: name })) })
        })
      }

      if (payload.method === 'bridge.get_follow_list') {
        let result = []
        if (params.observer === 'viewer' && params.follow_type === 'muted') {
          result = muted.map(name => ({ name, muted_list_description: '' }))
        } else if (params.observer === 'viewer' && params.follow_type === 'follow_muted') {
          result = followMuted.map(name => ({
            name,
            muted_list_description: name === 'hive.blog' ? 'Phishing accounts' : ''
          }))
        } else if (params.follow_type === 'muted' && followedMuteMembers[params.observer]) {
          result = followedMuteMembers[params.observer].map(name => ({ name, muted_list_description: '' }))
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result })
        })
      }

      if (payload.method !== 'condenser_api.get_accounts') return route.continue()

      const response = await route.fetch()
      const json = await response.json()
      if (Array.isArray(json.result)) {
        for (const account of json.result) {
          if (account?.name !== 'ausbitbank') continue
          account.reputation = reputation
          let metadata
          try { metadata = JSON.parse(account.posting_json_metadata || '{}') } catch { metadata = {} }
          metadata['hive.ausbit.dev'] = { theme: SKIN }
          account.posting_json_metadata = JSON.stringify(metadata)
        }
      }
      await route.fulfill({ response, json })
    })
  }
}

function policyFor (scope) {
  return page => page.evaluate(key => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, 'hive:moderation:v1:' + scope)
}

test('skin safety blocks a negative-reputation skin and remembers the override', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  await mockChain(page, { reputation: -500 })

  await page.goto('/@ausbitbank')
  await waitForApp(page)

  const blocked = page.locator('.skin-blocked')
  await expect(blocked).toBeVisible({ timeout: 20000 })
  await expect(blocked).toContainText('negative reputation')
  await expect(page.locator('.skin-scope')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show this skin anyway' }).click()
  await expect(page.locator('.skin-scope')).toBeVisible()
  await expect(page.locator('.skin-badge')).toContainText('Skin by')

  const policy = await policyFor('guest')(page)
  expect(policy.overrides.showAuthors).toContain('ausbitbank')

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('.skin-scope')).toBeVisible()
})

test('skin safety blocks a muted author for a signed-in viewer', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  await loginAs(page, 'viewer')
  await mockChain(page, { reputation: 60, muted: ['ausbitbank'] })

  await page.goto('/@ausbitbank')
  await waitForApp(page)

  const blocked = page.locator('.skin-blocked')
  await expect(blocked).toBeVisible({ timeout: 20000 })
  await expect(blocked).toContainText('you mute @ausbitbank')
  await expect(page.locator('.skin-scope')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show this skin anyway' }).click()
  await expect(page.locator('.skin-scope')).toBeVisible()
  const stored = await policyFor('viewer')(page)
  expect(stored.overrides.showAuthors).toContain('ausbitbank')
})

test('skin safety lets a followed author keep a skin that is on a subscribed mute list', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  await loginAs(page, 'viewer')
  await mockChain(page, {
    reputation: 60,
    following: ['ausbitbank'],
    followMuted: ['hive.blog'],
    followedMuteMembers: { 'hive.blog': ['ausbitbank'] }
  })

  await page.goto('/@ausbitbank')
  await waitForApp(page)

  await expect(page.locator('.skin-scope')).toBeVisible({ timeout: 20000 })
  const badge = page.locator('.skin-badge')
  await expect(badge).toContainText('Skin by')
  await expect(badge).toContainText('mute list')
  await expect(page.locator('.skin-blocked')).toHaveCount(0)
})

test('blocked skin notice is axe clean at desktop and mobile widths', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  test.setTimeout(120000)
  await mockChain(page, { reputation: -500 })

  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/@ausbitbank')
    await waitForApp(page)
    await expect(page.locator('.skin-blocked')).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(600)
    const violations = await runAxe(page)
    expect(violations, 'blocked skin at ' + viewport.width + 'px').toEqual([])
  }
})

test('account blog keeps its content while the skin is blocked', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  await mockChain(page, { reputation: -500 })

  await page.goto('/@ausbitbank/blog')
  await waitForApp(page)

  await expect(page.locator('.browse-wrap')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.skin-blocked')).toBeVisible({ timeout: 20000 })
})

test('theme wall marks a blocked skin and can show it', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  await loginAs(page, 'viewer')
  await mockChain(page, { reputation: -500, following: ['ausbitbank'] })

  await page.goto('/themes')
  await waitForApp(page)
  await page.getByRole('tab', { name: 'Following' }).click()

  const card = page.locator('.wall-card--blocked')
  await expect(card).toBeVisible({ timeout: 20000 })
  await expect(card).toContainText('negative reputation')
  await expect(card.locator('.wall-card__swatches')).toHaveCount(0)

  await card.getByRole('button', { name: 'Show skin' }).click()
  await expect(page.locator('.wall-card--blocked')).toHaveCount(0)
  await expect(page.locator('.wall-card__swatches').first()).toBeVisible()
})


test('moderation settings page switches presets and persists', async ({ page }) => {
  await page.goto('/settings/moderation')
  await waitForApp(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Moderation' })).toBeVisible()
  await page.locator('.mod-preset').filter({ hasText: 'Strict' }).click()
  await expect(page.locator('.mod-preset').filter({ hasText: 'Strict' })).toHaveAttribute('aria-pressed', 'true')

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hive:moderation:v1:guest') || '{}'))
  expect(stored.preset).toBe('strict')

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('.mod-preset').filter({ hasText: 'Strict' })).toHaveAttribute('aria-pressed', 'true')
})

test('a negative-reputation feed card collapses with an explanation and can be shown', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  const post = {
    author: 'alice',
    permlink: 'moderated-post',
    title: 'A moderated post',
    body: 'This body should be collapsed until the viewer chooses to show it.',
    created: '2026-11-24T00:00:00',
    category: 'hive',
    community: 'hive-1',
    community_title: 'Hive',
    children: 0,
    net_votes: 1,
    author_reputation: -500,
    payout: 0,
    pending_payout_value: '0.000 HBD',
    total_payout_value: '0.000 HBD',
    curator_payout_value: '0.000 HBD',
    max_accepted_payout: '1000000.000 HBD',
    percent_hbd: 10000,
    json_metadata: { tags: ['hive'] },
    stats: {},
    active_votes: [],
    reblogged_by: []
  }
  await mockChain(page, { rankedPosts: [post] })

  await page.goto('/created')
  await waitForApp(page)
  const card = page.locator('.post-card').first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await expect(card.locator('.mod-notice')).toContainText('Negative reputation')
  await expect(card.locator('.post-card__summary')).toHaveCount(0)

  await card.getByRole('button', { name: 'Show anyway' }).click()
  await expect(card.locator('.mod-notice')).toHaveCount(0)
  await expect(card.locator('.post-card__summary')).toBeVisible()

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('.post-card').first().locator('.mod-notice')).toHaveCount(0)
})
