import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

const API_HOSTS = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://api.deathwing.me',
  'https://rpc.mahdiyari.info'
]

const FOLLOWED = ['alice', 'bob', 'carol', 'dave']

test('following cards render the already-following state on first paint', async ({ page }) => {
  const relationshipCalls = []

  // Follow reads are mocked; profiles stay live so the cards can render.
  for (const host of API_HOSTS) {
    await page.route(host + '/**', async route => {
      const request = route.request()
      if (request.method() !== 'POST') return route.continue()
      const payload = request.postDataJSON?.() || {}
      const method = payload.method || ''
      let result

      if (method === 'condenser_api.get_follow_count') {
        result = { account: 'ausbitbank', following_count: FOLLOWED.length, follower_count: 0 }
      } else if (method === 'condenser_api.get_following') {
        const start = payload.params?.[1] || ''
        const rows = start ? [] : FOLLOWED.map(name => ({ following: name, what: ['blog'] }))
        result = rows
      } else if (method === 'condenser_api.get_followers') {
        result = []
      } else if (method === 'bridge.get_relationship_between_accounts') {
        relationshipCalls.push(payload.params)
        result = { follows: false, ignores: false }
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

  await loginAs(page)
  await page.goto('/@ausbitbank/following')
  await waitForApp(page)

  const cards = page.locator('.connection-card')
  await expect.poll(() => cards.count(), { timeout: 25000 }).toBe(FOLLOWED.length)

  for (const card of await cards.all()) {
    await expect(card.locator('.user-card__follow')).toHaveText('Following')
  }
  expect(relationshipCalls).toHaveLength(0)
})
