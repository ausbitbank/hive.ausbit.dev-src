import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

const API_HOSTS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://api.deathwing.me',
  'https://rpc.mahdiyari.info'
]

const PAGE_SIZE = 12

function post (index) {
  return {
    author: 'author' + index,
    permlink: 'post-' + index,
    post_id: 1000 + index,
    created: '2026-01-01T00:00:00',
    title: 'Post number ' + index,
    body: 'Body of post ' + index,
    json_metadata: { tags: ['hive'] },
    category: 'hive',
    children: 0,
    net_votes: 0,
    pending_payout_value: '0.000 HBD',
    active_votes: [],
    stats: { gray: false, hide: false, is_pinned: false }
  }
}

/**
 * Fulfil every configured Hive node with a ranked-posts feed that has three
 * pages: two full pages and a short final page.
 */
async function mockRankedPosts (page) {
  const calls = []

  for (const host of API_HOSTS) {
    await page.route(host + '/**', async route => {
      const request = route.request()
      if (request.method() !== 'POST') return route.fulfill({ status: 204, body: '' })
      const payload = request.postDataJSON?.() || {}
      calls.push(payload)

      if (payload.method === 'bridge.get_ranked_posts') {
        const start = Number(payload.params?.start_permlink?.replace('post-', '')) || 0
        const size = start === 0 ? PAGE_SIZE : PAGE_SIZE
        const limit = Number(payload.params?.limit) || PAGE_SIZE
        const endIndex = Math.min(start + Math.min(size, limit), PAGE_SIZE * 2 + 1)
        const posts = []
        for (let index = start; index < endIndex; index++) posts.push(post(index))
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ jsonrpc: '2.0', id: payload.id || 1, result: posts })
        })
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ jsonrpc: '2.0', id: payload.id || 1, result: null })
      })
    })
  }

  return calls
}

async function scrollToEnd (page) {
  await page.locator('.browse-end, .infinite-scroll__more, .infinite-scroll__loading').first().scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 1500)
}

const COMMENT_COUNT = 70
const COMMENT_PAGE = 30

function discussionPost () {
  return {
    id: 1,
    author: 'poster',
    permlink: 'post',
    category: 'test',
    title: 'A post with many comments',
    body: 'Post body long enough to render the article view properly for a reader.',
    json_metadata: '{"tags":["test"]}',
    created: '2026-01-01T00:00:00',
    active: '2026-01-08T00:00:00',
    last_payout: '2026-01-08T00:00:00',
    depth: 0,
    children: COMMENT_COUNT,
    net_rshares: 100,
    abs_rshares: 100,
    cashout_time: '2026-01-08T00:00:00',
    total_votes: 1,
    active_votes: [],
    pending_payout_value: '0.000 HBD',
    author_rewards: 0,
    total_payout_value: '0.000 HBD',
    curator_payout_value: '0.000 HBD',
    max_accepted_payout: '1000000.000 HBD',
    percent_hbd: 10000,
    parent_author: '',
    parent_permlink: 'test',
    url: '/test/@poster/post',
    root_title: 'A post with many comments',
    beneficiaries: [],
    promoted: '0.000 HBD',
    replies: [],
    body_length: 69,
    author_reputation: '1000',
    stats: { gray: false, hide: false, is_pinned: false, total_votes: 1 }
  }
}

async function mockDiscussion (page) {
  const base = discussionPost()

  for (const host of API_HOSTS) {
    await page.route(host + '/**', async route => {
      const request = route.request()
      if (request.method() !== 'POST') return route.fulfill({ status: 204, body: '' })
      const payload = request.postDataJSON?.() || {}
      let result = null

      if (payload.method === 'condenser_api.get_content') {
        result = { ...base }
      } else if (payload.method === 'bridge.get_discussion') {
        const discussion = { 'poster/post': { ...base, replies: [] } }
        for (let index = 1; index <= COMMENT_COUNT; index++) {
          discussion['poster/comment-' + index] = {
            ...base,
            permlink: 'comment-' + index,
            depth: 1,
            children: 0,
            net_rshares: 1000 - index,
            parent_author: 'poster',
            parent_permlink: index === 1 ? 'post' : 'comment-' + (index - 1),
            body: 'Comment body ' + index
          }
          discussion['poster/post'].replies.push('poster/comment-' + index)
        }
        result = discussion
      } else if (payload.method === 'condenser_api.get_dynamic_global_properties') {
        result = {
          head_block_number: 100000000,
          time: '2026-01-01T00:00:00',
          total_vesting_fund_hive: '1.000 HIVE',
          total_vesting_shares: '1.000000 VESTS',
          hbd_interest_rate: 0
        }
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ jsonrpc: '2.0', id: payload.id, result })
      })
    })
  }
}

test('browse appends the next page automatically at the end of the list', async ({ page }) => {
  await mockRankedPosts(page)
  await page.goto('/browse?limit=' + PAGE_SIZE)
  await waitForApp(page)

  const posts = page.locator('.browse-grid > *')
  await expect.poll(() => posts.count(), { timeout: 25000 }).toBeGreaterThan(0)

  const first = await posts.count()
  expect(first).toBeLessThanOrEqual(PAGE_SIZE)

  await page.locator('.browse-end, .infinite-scroll__more, .infinite-scroll__loading').first().waitFor()
  await scrollToEnd(page)

  await expect.poll(() => posts.count(), { timeout: 25000 }).toBeGreaterThan(first)

  // Reaching the final short page stops further requests and shows the end.
  await expect.poll(async () => {
    await scrollToEnd(page)
    return page.locator('.browse-end').count()
  }, { timeout: 25000 }).toBe(1)

  const after = await posts.count()
  await scrollToEnd(page)
  await page.waitForTimeout(750)
  expect(await posts.count()).toBe(after)
  expect(await page.locator('.infinite-scroll__loading').count()).toBe(0)
})

test('notifications panel pages inside its own scroll area', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const total = 45
  const limit = 20

  for (const host of API_HOSTS) {
    await page.route(host + '/**', async route => {
      const request = route.request()
      if (request.method() !== 'POST') return route.fulfill({ status: 204, body: '' })
      const payload = request.postDataJSON?.() || {}
      let result = null

      if (payload.method === 'bridge.account_notifications') {
        const lastId = Number(payload.params?.last_id) || total + 1
        const start = Math.max(0, lastId - limit)
        result = []
        for (let id = lastId - 1; id >= start; id--) {
          result.push({
            id,
            type: 'vote',
            date: '2026-01-01T00:00:00',
            msg: JSON.stringify({ type: 'vote', voter: 'alice', author: 'poster', permlink: 'post-' + id }),
            score: 10,
            url: '/@poster/post-' + id
          })
        }
      } else if (payload.method === 'bridge.unread_notifications') {
        result = { unread: 0, lastread: null }
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ jsonrpc: '2.0', id: payload.id, result })
      })
    })
  }

  await loginAs(page)
  await page.goto('/')
  await waitForApp(page)

  await page.getByRole('button', { name: /notification/i }).first().click()

  const rows = page.locator('.notification-row')
  await expect.poll(() => rows.count(), { timeout: 25000 }).toBe(limit)

  // The panel is a fixed-height scroller, so the component must observe that
  // element rather than the window.
  const scroller = page.locator('.notifications-scroll .q-scrollarea__container')
  await scroller.hover()
  for (let step = 0; step < 8; step++) {
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(200)
  }

  await expect.poll(() => rows.count(), { timeout: 25000 }).toBe(total)
  await expect(page.locator('.notifications-end')).toBeVisible()
})

test('connections loads the next page of accounts when scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const total = 150
  const limit = 100

  // Only the follow endpoints are mocked; accounts/profiles stay live so the
  // page can still render its header.
  for (const host of API_HOSTS) {
    await page.route(host + '/**', async route => {
      const request = route.request()
      if (request.method() !== 'POST') return route.continue()
      const payload = request.postDataJSON?.() || {}
      const method = payload.method || ''
      let result

      if (method === 'condenser_api.get_follow_count') {
        result = { account: 'ausbitbank', following_count: total, follower_count: 0 }
      } else if (method === 'condenser_api.get_following' || method === 'condenser_api.get_followers') {
        const key = method.endsWith('followers') ? 'follower' : 'following'
        const last = payload.params?.[1] || ''
        // The API repeats the anchor account, then lists the next `limit`.
        const start = last === '' ? 0 : Number(String(last).slice(4)) + 1
        result = []
        for (let index = start; index < Math.min(start + limit, total); index++) {
          result.push({ [key]: 'user' + index, following: 'user' + index, follower: 'user' + index, what: ['blog'] })
        }
      } else {
        return route.continue()
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ jsonrpc: '2.0', id: payload.id, result })
      })
    })
  }

  await page.goto('/@ausbitbank/following')
  await waitForApp(page)

  const cards = page.locator('.infinite-scroll > *')
  await expect.poll(() => cards.count(), { timeout: 25000 }).toBeGreaterThanOrEqual(limit)

  // Walk to the bottom of the list with the wheel only; every page arrives
  // without a single click on the fallback button.
  for (let step = 0; step < 20; step++) {
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(200)
  }

  await expect(page.locator('.infinite-scroll__more')).toHaveCount(0, { timeout: 25000 })
  // The list holds every loaded account rather than only the current page.
  await expect.poll(() => cards.count(), { timeout: 25000 }).toBeGreaterThan(limit)
})

test('comments keep loading as the thread is scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 800 })
  await mockDiscussion(page)
  await page.goto('/@poster/post')
  await waitForApp(page)

  await page.getByRole('button', { name: 'Load comments' }).click()

  const comments = page.locator('.comment')
  await expect.poll(() => comments.count(), { timeout: 25000 }).toBe(COMMENT_PAGE)

  await page.locator('#comments').scrollIntoViewIfNeeded()
  for (let step = 0; step < 12; step++) {
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(250)
  }

  await expect.poll(() => comments.count(), { timeout: 25000 }).toBe(COMMENT_COUNT)
  await expect(page.locator('.comments__progress')).toContainText('of ' + COMMENT_COUNT)
  await expect(page.locator('#comments .infinite-scroll__more')).toBeHidden()
})


