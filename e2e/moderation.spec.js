import { test, expect } from './fixtures'
import { loginAs, readQueue, runAxe, waitForApp } from './helpers'

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

function skinAccount (reputation = 60) {
  return {
    reputation,
    balance: '0.000 HIVE',
    hbd_balance: '0.000 HBD',
    vesting_shares: '0.000000 VESTS',
    post_count: 0,
    created: '2020-01-01T00:00:00',
    posting_json_metadata: JSON.stringify({
      profile: {
        name: 'Ausbitbank',
        about: 'Hive developer',
        profile_image: 'https://images.hive.blog/u/ausbitbank/avatar'
      },
      'hive.ausbit.dev': { theme: SKIN }
    })
  }
}

function blockedSkinAccount () {
  return skinAccount(-500)
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
  rankedPosts = null,
  voteHistory = null,
  downvotePosts = null,
  downvoteDiscussion = null,
  voterComments = null,
  accountOverride = null,
  listCounts = null,
  safetyFloorNames = null,
  communityInfo = null
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

      if (payload.method === 'bridge.get_community' && communityInfo) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: communityInfo })
        })
      }

      if (payload.method === 'bridge.list_subscribers' && communityInfo) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [] })
        })
      }

      if (payload.method === 'bridge.account_notifications' && communityInfo) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [] })
        })
      }

      if (payload.method === 'condenser_api.get_account_history' && voteHistory) {
        const history = typeof voteHistory === 'function' ? voteHistory(params) : voteHistory
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: history })
        })
      }

      if (payload.method === 'condenser_api.get_reward_fund' && voteHistory) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { recent_claims: '1000000000000000', reward_balance: '50000.000 HIVE' }
          })
        })
      }

      if (payload.method === 'condenser_api.get_current_median_history_price' && voteHistory) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { base: '0.500 HBD', quote: '1.000 HIVE' }
          })
        })
      }

      if (payload.method === 'condenser_api.get_content' && voteHistory) {
        const [author, permlink] = Array.isArray(params) ? params : []
        const post = downvotePosts?.[String(author) + '/' + String(permlink)] || null
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: post })
        })
      }

      if (payload.method === 'bridge.get_discussion' && voteHistory) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: downvoteDiscussion || {} })
        })
      }

      if (payload.method === 'bridge.get_account_posts' && voteHistory) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: voterComments || [] })
        })
      }

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
        if (Array.isArray(safetyFloorNames) && params.observer === 'hive.blog' && params.follow_type === 'muted') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: safetyFloorNames.map(name => ({ name, muted_list_description: '' }))
            })
          })
        }
        if (listCounts && Number.isFinite(listCounts[params.observer])) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: Array.from({ length: listCounts[params.observer] }, (_, index) => ({
                name: 'listed' + index,
                muted_list_description: ''
              }))
            })
          })
        }
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

      const names = Array.isArray(params) ? (params[0] || []) : []
      const base = accountOverride || skinAccount(reputation)
      const result = names.map(name => {
        const account = { ...base, name }
        if (name !== 'ausbitbank') return account
        let metadata
        try { metadata = JSON.parse(account.posting_json_metadata || '{}') } catch { metadata = {} }
        metadata['hive.ausbit.dev'] = { theme: SKIN }
        metadata.profile = { ...(metadata.profile || {}), name: metadata.profile?.name || 'Ausbitbank' }
        account.posting_json_metadata = JSON.stringify(metadata)
        account.reputation = accountOverride?.reputation ?? reputation
        return account
      })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, result })
      })
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
  await mockChain(page, { accountOverride: blockedSkinAccount() })

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
  await mockChain(page, { accountOverride: blockedSkinAccount() })

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
  await mockChain(page, { listCounts: { 'hive.blog': 2, plentyofphish: 1, ecency: 1, spaminator: 1 } })
  await page.goto('/settings/moderation')
  await waitForApp(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Moderation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Phishing safety floor' })).toBeVisible()
  await expect(page.getByLabel('Enable the phishing safety floor')).toBeChecked()
  await page.getByLabel('Enable the phishing safety floor').uncheck()
  await expect(page.getByText('Off: known phishing and compromised accounts are not collapsed')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Discover lists' })).toBeVisible()
  await expect(page.getByText('Phishing accounts', { exact: true })).toBeVisible()
  await expect(page.getByText('Plenty of Phish — source list')).toBeVisible()
  await expect(page.getByText('Hive Analytics blacklist (very large)')).toBeVisible()
  const phishingCard = page.locator('.mod-discovery__card').filter({ hasText: 'Phishing accounts' })
  await expect(phishingCard.locator('.mod-discovery__count')).toContainText('2 names')
  const largeCard = page.locator('.mod-discovery__card').filter({ hasText: 'Hive Analytics blacklist' })
  await expect(largeCard).toContainText('Not supported in this client')
  await expect(largeCard.getByRole('button', { name: 'Subscribe' })).toHaveCount(0)
  await page.locator('.mod-preset').filter({ hasText: 'Strict' }).click()
  await expect(page.locator('.mod-preset').filter({ hasText: 'Strict' })).toHaveAttribute('aria-pressed', 'true')

  await expect(page.getByRole('heading', { name: 'Ignored tags' })).toBeVisible()
  await page.getByLabel('Tag to ignore').fill('#Noise')
  await page.getByRole('button', { name: 'Ignore tag' }).click()
  await expect(page.locator('.mod-tag-list')).toContainText('#noise')

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hive:moderation:v1:guest') || '{}'))
  expect(stored.preset).toBe('strict')
  expect(stored.safetyFloor.enabled).toBe(false)
  expect(stored.tags.ignored).toEqual(['noise'])

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('.mod-preset').filter({ hasText: 'Strict' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.mod-tag-list')).toContainText('#noise')
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page.getByText('No ignored tags yet.')).toBeVisible()
  expect(await runAxe(page)).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await runAxe(page)).toEqual([])
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
  await card.getByRole('button', { name: 'Why?' }).click()
  await expect(card.getByRole('link', { name: 'Community context' })).toHaveAttribute('href', '/c/hive-1#moderation-context')

  await card.getByRole('button', { name: 'Show anyway' }).click()
  await expect(card.locator('.mod-notice')).toHaveCount(0)
  await expect(card.locator('.post-card__summary')).toBeVisible()

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('.post-card').first().locator('.mod-notice')).toHaveCount(0)
})


test('the default safety floor collapses a listed phishing account and can be shown', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  const post = {
    author: 'phish',
    permlink: 'phishing-post',
    title: 'A phishing post',
    body: 'This body should be collapsed by the default safety floor.',
    created: '2026-11-25T00:00:00',
    category: 'hive',
    community: 'hive-1',
    community_title: 'Hive',
    children: 0,
    net_votes: 1,
    author_reputation: 60,
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
  await mockChain(page, { rankedPosts: [post], safetyFloorNames: ['phish'] })

  await page.goto('/created')
  await waitForApp(page)
  const card = page.locator('.post-card').first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await expect(card.locator('.mod-notice')).toContainText('Known phishing or compromised account')
  await expect(card.locator('.post-card__summary')).toHaveCount(0)

  await card.getByRole('button', { name: 'Why?' }).click()
  await expect(card.locator('.mod-notice')).toContainText('Source: @hive.blog')
  await expect(card.locator('.mod-notice')).toContainText('as of 2026-11-24')

  await card.getByRole('button', { name: 'Show anyway' }).click()
  await expect(card.locator('.mod-notice')).toHaveCount(0)
  await expect(card.locator('.post-card__summary')).toBeVisible()

  await page.reload()
  await waitForApp(page)
  await expect(page.locator('.post-card').first().locator('.mod-notice')).toHaveCount(0)
})

test('community moderation context explains muted posts, roles and rules', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  const base = {
    parent_author: '',
    created: '2026-11-25T00:00:00',
    category: 'hive-1',
    community: 'hive-1',
    community_title: 'Test community',
    children: 0,
    net_votes: 1,
    author_reputation: 60,
    payout: 0,
    pending_payout_value: '0.000 HBD',
    total_payout_value: '0.000 HBD',
    curator_payout_value: '0.000 HBD',
    max_accepted_payout: '1000000.000 HBD',
    percent_hbd: 10000,
    json_metadata: { tags: ['hive-1'] },
    active_votes: [],
    reblogged_by: []
  }
  const mutedPosts = [
    {
      ...base,
      author: 'muted-one',
      permlink: 'muted-one',
      title: 'A post muted by community moderation',
      stats: { muted_reasons: [0], hide: true }
    },
    {
      ...base,
      author: 'muted-two',
      permlink: 'muted-two',
      title: 'A post muted by a community role',
      stats: { muted_reasons: [4], gray: true }
    }
  ]
  await mockChain(page, {
    rankedPosts: mutedPosts,
    communityInfo: {
      id: 1,
      name: 'hive-1',
      title: 'Test community',
      about: 'A test community.',
      description: '',
      flag_text: 'Be kind and stay on topic.',
      is_nsfw: false,
      subscribers: 10,
      num_authors: 2,
      num_pending: 0,
      sum_pending: 0,
      created_at: '2020-01-01 00:00:00',
      settings: { flag_text: 'Be kind and stay on topic.' },
      team: [
        ['hive-1', 'owner', 'Test community'],
        ['mod-one', 'mod', '']
      ]
    },
    accountOverride: {
      reputation: 60,
      posting_json_metadata: '{}',
      balance: '0.000 HIVE',
      hbd_balance: '0.000 HBD',
      vesting_shares: '0.000000 VESTS',
      post_count: 0,
      created: '2020-01-01T00:00:00'
    }
  })

  await page.goto('/c/hive-1')
  await waitForApp(page)
  const context = page.locator('#moderation-context')
  await expect(context.getByRole('heading', { name: 'Community moderation context' })).toBeVisible({ timeout: 20000 })
  await expect(context).toContainText('Hidden by community moderation')
  await expect(context).toContainText('Muted community role')
  await expect(context).toContainText('Recent muted posts')
  await expect(context).toContainText('@muted-one')
  await expect(context).toContainText('Be kind and stay on topic.')
  await expect(context).toContainText('1 owner · 1 mod')
  await expect(context.getByRole('link', { name: 'Open muted feed' })).toHaveAttribute('href', '/muted/hive-1')
  await expect(context.getByRole('link', { name: 'Rules and team' })).toHaveAttribute('href', '/c/hive-1?tab=about')
  expect(await runAxe(page)).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await runAxe(page)).toEqual([])
})

test('downvotes tab shows voter evidence and local voter exclusion', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  const now = new Date().toISOString()
  const rows = ['bob', 'carol', 'dave'].flatMap((voter, voterIndex) =>
    ['one', 'two', 'three'].map((permlink, index) => [
      voterIndex * 10 + index + 1,
      {
        op: ['vote', { voter, author: 'ausbitbank', permlink, weight: -1000 }],
        timestamp: now,
        trx_id: voter + '-' + permlink
      }
    ])
  )
  const targetPost = permlink => ({
    author: 'ausbitbank',
    permlink,
    created: '2026-11-27T00:00:00',
    cashout_time: '2026-12-04T00:00:00',
    pending_payout_value: '10.000 HBD',
    total_payout_value: '0.000 HBD',
    curator_payout_value: '0.000 HBD',
    net_rshares: 1000,
    beneficiaries: [],
    active_votes: [
      { voter: 'bob', rshares: -100 },
      { voter: 'carol', rshares: -100 },
      { voter: 'dave', rshares: -100 }
    ]
  })
  const downvotePosts = Object.fromEntries(
    ['one', 'two', 'three'].map(permlink => ['ausbitbank/' + permlink, targetPost(permlink)])
  )
  const downvoteDiscussion = {
    'ausbitbank/one': {
      author: 'ausbitbank',
      permlink: 'one',
      depth: 0,
      replies: ['bob/reason']
    },
    'bob/reason': {
      author: 'bob',
      permlink: 'reason',
      parent_author: 'ausbitbank',
      parent_permlink: 'one',
      depth: 1,
      created: now,
      body: 'I downvoted because this looks like spam.',
      replies: []
    }
  }
  await mockChain(page, {
    voteHistory: rows,
    downvotePosts,
    downvoteDiscussion,
    voterComments: [],
    accountOverride: {
      reputation: 60,
      posting_json_metadata: '{}',
      balance: '0.000 HIVE',
      hbd_balance: '0.000 HBD',
      vesting_shares: '1000000.000000 VESTS',
      voting_manabar: { current_mana: 1000000000000, last_update_time: 0 },
      downvote_manabar: { current_mana: 250000000000, last_update_time: 0 },
      post_count: 0,
      created: '2020-01-01T00:00:00'
    }
  })

  await page.goto('/@ausbitbank/downvotes')
  await waitForApp(page)
  await expect(page.getByRole('heading', { level: 1, name: '@ausbitbank downvotes' })).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.dv-summary')).toContainText('9')
  await expect(page.locator('.dv-summary')).toContainText('$9.00')
  await expect(page.locator('.dv-summary')).toContainText('9 exact of 9')
  await expect(page.getByText('100% exact')).toBeVisible()
  await expect(page.locator('.dv-evidence')).toContainText('Possible coordinated downvotes')
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(9)
  await expect(page.locator('.dv-table thead').getByRole('columnheader', { name: 'Impact' })).toBeVisible()
  await expect(page.locator('.dv-impact--exact').first()).toContainText('$1.00')

  const contextRow = page.locator('.dv-table tbody tr').filter({ hasText: '@bob' }).filter({ hasText: 'ausbitbank/one' }).first()
  await contextRow.getByRole('button', { name: 'Context' }).click()
  const contextDialog = page.locator('.dv-context')
  await expect(contextDialog).toContainText('Voter comments on this post')
  await expect(contextDialog).toContainText('because this looks like spam')
  expect(await runAxe(page)).toEqual([])
  await contextDialog.locator('textarea').fill('No answer yet')
  await contextDialog.getByRole('button', { name: 'Save note' }).click()
  await contextDialog.getByRole('button', { name: 'Close vote context' }).click()
  await expect(contextRow.locator('.dv-note-dot')).toBeVisible()

  await expect(page.locator('.dv-heat')).toBeVisible()
  await expect(page.locator('.dv-heat').getByRole('columnheader', { name: 'Total' })).toBeVisible()

  await page.getByRole('button', { name: 'Views' }).click()
  await expect(page.getByText('Save current view')).toBeVisible()
  expect(await runAxe(page)).toEqual([])
  await page.keyboard.press('Escape')

  await page.goto('/@ausbitbank/downvotes?range=7&voter=bob&impact=exact')
  await waitForApp(page)
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(3)
  await expect(page.locator('.dv-controls')).toContainText('3 of 9')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(9)

  const topVoters = page.locator('.dv-panel').filter({ hasText: 'Top voters' })
  await topVoters.getByRole('button', { name: 'Watch @bob' }).click()
  await page.getByLabel('Watched only (1)').check()
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(3)
  await page.getByLabel('Watched only (1)').uncheck()
  await topVoters.getByRole('button', { name: 'Unwatch @bob' }).click()

  await page.getByRole('button', { name: 'Views' }).click()
  await page.getByRole('button', { name: 'Save current view' }).click()
  const saveViewDialog = page.locator('.q-dialog')
  await saveViewDialog.locator('input[type="text"]').fill('Everything')
  await saveViewDialog.getByRole('button', { name: 'OK' }).click()
  await page.getByRole('button', { name: 'Views' }).click()
  await expect(page.getByRole('button', { name: /^Everything/ })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/@ausbitbank/downvotes?voter=bob')
  await waitForApp(page)
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(3)
  await page.getByRole('button', { name: 'Views' }).click()
  await page.getByRole('button', { name: /^Everything/ }).click()
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(9)

  const firstRow = page.locator('.dv-table tbody tr').filter({ hasText: '@bob' }).first()
  await firstRow.getByRole('button', { name: 'Ignore voter' }).click()
  await expect(page.locator('.dv-table tbody tr').filter({ hasText: '@bob' })).toHaveCount(0)
  await expect(page.locator('.dv-summary')).toContainText('9')

  await page.getByLabel('Show locally ignored voters').check()
  await expect(page.locator('.dv-table tbody tr').filter({ hasText: '@bob' }).first()).toBeVisible()
})

test('downvotes can keep loading older history without a page cap', async ({ page }) => {
  test.skip(Boolean(process.env.OBSCURA_CDP), 'Obscura does not rewrite mocked API responses')
  const voteRow = index => [index, {
    op: ['vote', { voter: 'bob', author: 'ausbitbank', permlink: 'older-post-' + index, weight: -1000 }],
    timestamp: '2026-11-24T00:00:00',
    trx_id: 'trx' + index
  }]
  const pageRows = start => Array.from({ length: 1000 }, (_, offset) => voteRow(start + offset))
  const historyFor = params => {
    const cursor = Number(Array.isArray(params) ? params[1] : -1)
    if (cursor === -1) return pageRows(2001)
    if (cursor === 2000) return pageRows(1001)
    if (cursor === 1000) return pageRows(1)
    if (cursor === 0) return [voteRow(0)]
    return []
  }
  await mockChain(page, {
    voteHistory: historyFor,
    accountOverride: {
      reputation: 60,
      posting_json_metadata: '{}',
      balance: '0.000 HIVE',
      hbd_balance: '0.000 HBD',
      vesting_shares: '1000000.000000 VESTS',
      voting_manabar: { current_mana: 1000000000000, last_update_time: 0 },
      downvote_manabar: { current_mana: 250000000000, last_update_time: 0 },
      post_count: 0,
      created: '2020-01-01T00:00:00'
    }
  })

  await page.goto('/@ausbitbank/downvotes')
  await waitForApp(page)
  const countCard = page.locator('.dv-stat').filter({ hasText: 'Downvotes received' })
  await expect(countCard.locator('strong')).toHaveText('3000', { timeout: 20000 })
  await expect(page.getByRole('button', { name: 'Load older' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load all older' })).toBeVisible()
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(40)
  await page.getByRole('button', { name: 'Show more rows' }).click()
  await expect(page.locator('.dv-table tbody tr')).toHaveCount(80)

  await page.getByRole('button', { name: 'Load older' }).click()
  await expect(countCard.locator('strong')).toHaveText('3001')
  await expect(page.getByRole('button', { name: 'Load older' })).toHaveCount(0)
  await expect(page.locator('.dv-more__end')).toContainText('End of the filtered vote history reached')
})


test('list subscriptions are explicit, queued with posting authority and preserve flags', async ({ page }) => {
  await loginAs(page, 'viewer')
  await mockChain(page, {
    accountOverride: {
      reputation: 60,
      posting_json_metadata: '{}',
      balance: '0.000 HIVE',
      hbd_balance: '0.000 HBD',
      vesting_shares: '0.000000 VESTS',
      post_count: 0,
      created: '2020-01-01T00:00:00'
    }
  })
  await page.goto('/settings/moderation')
  await waitForApp(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Moderation' })).toBeVisible()

  await page.getByLabel('List owner account').fill('hive.blog')
  await page.locator('.mod-subscribe').getByRole('button', { name: 'Subscribe', exact: true }).click()
  await expect(page.locator('.mod-list-owner')).toContainText('@hive.blog')

  const queue = await readQueue(page)
  expect(queue?.items).toHaveLength(1)
  const operation = queue.items[0]
  expect(operation[1]).toBe('posting')
  expect(operation[2][0]).toBe('custom_json')
  const follow = JSON.parse(operation[2][1].json)[1]
  expect(follow).toMatchObject({ follower: 'viewer', following: 'hive.blog' })
  expect(follow.what).toContain('follow_muted')
})
