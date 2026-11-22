import { test, expect } from './fixtures'
import { waitForApp } from './helpers'

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

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7h8AAAAASUVORK5CYII=',
  'base64'
)

const SKIN = {
  schema: 'hive.ausbit.dev/theme@1',
  scope: 'profile',
  id: 'e2e-badges',
  name: 'E2E Badges',
  mood: 'Identity and issuer badges',
  description: 'A profile skin with a shelf, circle and badges.',
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
    status: { text: 'Building a badge shelf', icon: 'hammer' },
    circle: ['alice', 'bob'],
    badges: {
      showLevel: true,
      selected: [
        { source: 'peakd', id: 'badge-069069' },
        { source: 'hivebuzz', id: 'first-post' },
        { source: 'peakd', id: 'badge-999999' }
      ]
    },
    post: 'pinned',
    banner: null
  }
}

const POST = {
  author: 'ausbitbank',
  permlink: 'e2e-pinned-post',
  title: 'Pinned from the E2E shelf',
  body: 'A pinned post used by the mocked badge shelf test.',
  json_metadata: JSON.stringify({ image: ['https://images.hive.blog/640x0/https://images.hive.blog/DQmtest/cover.png'] }),
  created: '2026-11-20T00:00:00',
  last_update: '2026-11-20T00:00:00',
  depth: 0,
  children: 0,
  stats: { total_votes: 0 }
}

function badgeAccount (name, profile) {
  return {
    name,
    posting_json_metadata: JSON.stringify({ profile }),
    json_metadata: '{}'
  }
}

test('profile shelf renders status, Circle and issuer badges with mocked APIs', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')

  const relationshipCalls = []
  await page.route('https://hivebuzz.me/**', async route => {
    const url = route.request().url()
    if (url.includes('/api/badges/ausbitbank')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'first-post',
            title: 'First post',
            state: 'on',
            description: '<b>Published</b> your first post',
            url: 'https://hivebuzz.me/badges/first-post.png'
          },
          { id: 'not-yet', title: 'Not yet', state: 'off', url: 'https://hivebuzz.me/badges/off.png' }
        ])
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })
  await page.route('https://files.peakd.com/**', async route => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })
  await page.route('https://images.hive.blog/**', async route => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })

  for (const host of HIVE_HOSTS) {
    await page.route(host + '/**', async route => {
      const payload = route.request().postDataJSON?.() || {}
      if (payload.method === 'bridge.get_account_posts') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [POST] })
        })
        return
      }
      if (payload.method === 'bridge.get_relationship_between_accounts') {
        relationshipCalls.push(payload.params)
        const [badge, account] = payload.params || []
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { follows: badge === 'badge-069069' && account === 'ausbitbank' }
          })
        })
        return
      }
      if (payload.method !== 'condenser_api.get_accounts') return route.continue()
      const response = await route.fetch()
      const json = await response.json()
      const requested = Array.isArray(payload.params?.[0]) ? payload.params[0] : []
      const result = Array.isArray(json.result) ? json.result.filter(Boolean) : []
      const fake = {
        'badge-069069': badgeAccount('badge-069069', {
          name: 'NFT Showroom Verified Artist',
          about: '<p>Verified by the <b>NFT Showroom</b> team</p>',
          profile_image: 'https://files.peakd.com/file/badge.png'
        }),
        alice: badgeAccount('alice', { name: 'Alice', profile_image: 'https://images.hive.blog/u/alice/avatar' }),
        bob: badgeAccount('bob', { name: 'Bob', profile_image: 'https://images.hive.blog/u/bob/avatar' })
      }
      for (const account of result) {
        if (account?.name === 'ausbitbank') {
          let metadata
          try { metadata = JSON.parse(account.posting_json_metadata || '{}') } catch { metadata = {} }
          metadata['hive.ausbit.dev'] = { theme: SKIN }
          metadata.profile = { ...(metadata.profile || {}), pinned: POST.permlink }
          account.posting_json_metadata = JSON.stringify(metadata)
        }
      }
      for (const name of requested) {
        if (!fake[name]) continue
        const existing = result.find(account => account?.name === name)
        if (existing) Object.assign(existing, fake[name])
        else result.push(fake[name])
      }
      json.result = result
      await route.fulfill({ response, json })
    })
  }

  await page.goto('/@ausbitbank')
  await waitForApp(page)

  const shelf = page.locator('.profile-shelf')
  await expect(shelf).toBeVisible()
  await expect(shelf.locator('.skin-status')).toContainText('Building a badge shelf')
  await expect(shelf.locator('.skin-ticker')).toHaveCount(0)
  await expect(shelf.locator('.skin-sticker-tray')).toHaveCount(0)

  await expect(shelf.locator('.skin-circle__link')).toHaveCount(2)
  await expect(shelf.locator('a[href="/@alice"]')).toBeVisible()
  await expect(shelf.locator('a[href="/@bob"]')).toBeVisible()

  await expect(shelf.getByRole('button', { name: /NFT Showroom Verified Artist/ })).toBeVisible()
  await expect(shelf.getByRole('button', { name: /First post/ })).toBeVisible()
  await expect(shelf.getByRole('button', { name: /HiveBuzz level/ })).toBeVisible()
  await expect(shelf.getByRole('button', { name: /badge-999999/ })).toHaveCount(0)

  await shelf.getByRole('button', { name: /NFT Showroom Verified Artist/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Verified by NFT Showroom')
  await expect(dialog).toContainText('Verified by the NFT Showroom team')
  await expect(dialog).not.toContainText('<b>')
  await expect(dialog.getByRole('link', { name: /View on PeakD/ })).toHaveAttribute('href', 'https://peakd.com/b/badge-069069')

  await expect(shelf.locator('.skin-post')).toContainText('Pinned from the E2E shelf')
  expect(relationshipCalls.length).toBeGreaterThan(0)
  expect(relationshipCalls).toContainEqual(['badge-069069', 'ausbitbank'])
})

test('post pages do not request badges or the shelf', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')

  let badgeRequests = 0
  page.on('request', request => {
    const body = request.postData() || ''
    if (body.includes('get_relationship_between_accounts') || request.url().includes('hivebuzz.me/api')) {
      badgeRequests += 1
    }
  })
  await page.route('https://hivebuzz.me/api/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more')
  await waitForApp(page)
  await page.waitForTimeout(1500)
  await expect(page.locator('.profile-shelf')).toHaveCount(0)
  expect(badgeRequests).toBe(0)
})
