import { test, expect } from './fixtures'
import { runAxe } from './helpers'

// The production build registers a service worker on loopback. Its navigation
// fallback can answer the same-origin /api/blogs request before Playwright's
// route mock, so keep service workers out of these network-mocked tests.
test.use({ serviceWorkers: 'block' })

const ACCOUNT = {
  name: 'alice',
  created: '2025-01-01T00:00:00',
  json_metadata: '',
  posting_json_metadata: JSON.stringify({
    profile: {
      name: 'Alice',
      about: 'Writer and photographer.',
      profile_image: 'https://images.hive.blog/u/alice/avatar'
    },
    'banksia.io': {
      blog: {
        version: 1,
        claimed: true,
        title: 'Alice writes',
        description: 'Notes from the garden.',
        theme: 'paper',
        directory: true
      }
    }
  })
}

const PROFILE = {
  name: 'alice',
  metadata: {
    profile: {
      name: 'Alice',
      about: 'Writer and photographer.',
      profile_image: 'https://images.hive.blog/u/alice/avatar'
    }
  }
}

const POSTS = [
  {
    author: 'alice',
    permlink: 'a-post',
    title: 'A post',
    body: 'Hello from the garden.',
    created: '2026-11-20T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({ image: ['https://images.hive.blog/a.png'] }),
    stats: { total_votes: 3 }
  },
  {
    author: 'alice',
    permlink: 'another-post',
    title: 'Another post',
    body: 'More notes from the garden.',
    created: '2026-11-19T10:00:00',
    depth: 0,
    json_metadata: '{}',
    stats: { total_votes: 1 }
  }
]

const GLOBAL_PROPS = {
  head_block_number: 1,
  head_block_id: '0000000000000000000000000000000000000000',
  time: '2026-11-27T00:00:00',
  current_witness: 'alice',
  total_vesting_fund_hive: '1.000 HIVE',
  total_vesting_shares: '1.000000 VESTS',
  hbd_interest_rate: 0
}

async function mockHive (page) {
  await page.route('https://api.hive.blog/**', async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    let body
    try {
      body = JSON.parse(request.postData() || '{}')
    } catch {
      return route.continue()
    }
    let result
    switch (body.method) {
      case 'condenser_api.get_accounts':
        result = [ACCOUNT]
        break
      case 'bridge.get_profile':
        result = PROFILE
        break
      case 'bridge.get_account_posts':
        result = POSTS
        break
      case 'bridge.get_post':
      case 'condenser_api.get_content':
        result = POSTS[0]
        break
      case 'condenser_api.get_dynamic_global_properties':
        result = GLOBAL_PROPS
        break
      default:
        result = null
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result })
    })
  })
}

async function axeAtBothWidths (page, label) {
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(400)
    const violations = await runAxe(page)
    expect(violations, label + ' at ' + viewport.width + 'px').toEqual([])
  }
}

test('/blogs landing is accessible', async ({ page }) => {
  await page.goto('/blogs', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blogs-title')).toBeVisible()
  await expect(page.locator('.blogs-theme')).toHaveCount(3)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A blog that is already yours.')
  await axeAtBothWidths(page, '/blogs')
})

test('/settings/blog social card layout is accessible', async ({ page }) => {
  await mockHive(page)
  await page.goto('/settings/blog?account=alice', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blog-settings__title')).toBeVisible()
  await expect(page.locator('.blog-settings__og')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate social card' })).toBeVisible()
  await axeAtBothWidths(page, '/settings/blog')
})

test('/blogs/directory lists opted-in blogs', async ({ page }) => {  await mockHive(page)
  await page.route('**/api/blogs', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ accounts: ['alice'], configured: true })
  }))

  await page.goto('/blogs/directory', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.directory-card')).toHaveCount(1)
  await expect(page.locator('.directory-card h2')).toHaveText('Alice writes')
  await expect(page.locator('.directory-card__handle')).toHaveText('@alice')
  await axeAtBothWidths(page, '/blogs/directory')
})

test('blog host renders a clean, accessible reading page', async ({ page }) => {
  await mockHive(page)
  // The Playwright config serves the built SPA on 4173; *.localhost resolves to
  // loopback in Chromium, and the router selects the blog route table from the
  // hostname exactly as it does in production.
  await page.goto('http://alice.localhost:4173/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blog-hero__title')).toHaveText('Alice writes')
  await expect(page.locator('.blog-card')).toHaveCount(2)
  await expect(page.locator('.blog-claim')).toHaveCount(0)
  await expect(page.locator('.site-footer')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alice writes')
  await axeAtBothWidths(page, 'blog host')
})
