import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
export const axePath = require.resolve('axe-core/axe.min.js')

export async function runAxe (page, { disableRules = [], context = null } = {}) {
  await page.addScriptTag({ path: axePath })
  const rules = Object.fromEntries(disableRules.map(id => [id, { enabled: false }]))
  const violations = await page.evaluate(async ({ rules, context }) => {
    const root = context ? document.querySelector(context) : document
    if (!root) throw new Error('No axe context matched ' + context)
    const result = await window.axe.run(root, { runOnly: ['wcag2a', 'wcag2aa'], rules })
    return result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map(node => node.target.join(' '))
    }))
  }, { rules, context })
  return violations
}

/** Wait for Vue to mount. Prerendered HTML is visible before handlers attach. */
export async function waitForApp (page) {
  await page.waitForFunction(() => Boolean(document.querySelector('#q-app')?.__vue_app__), null, { timeout: 20000 })
}

export async function loginAs (page, username = 'ausbitbank', loginType = 'keychain') {
  await page.addInitScript(({ username, loginType }) => {
    sessionStorage.setItem('loggedInUser', username)
    sessionStorage.setItem('loginType', loginType)
  }, { username, loginType })
}

export async function readQueue (page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('queuedActions')
    if (!raw) return null
    const text = raw.replace(/^__q_objt\|/, '')
    try { return JSON.parse(text) } catch { return null }
  })
}

export async function seedQueue (page, { items, meta }) {
  await page.addInitScript(({ items, meta }) => {
    const now = Date.now()
    localStorage.setItem('queuedActions', '__q_objt|' + JSON.stringify({
      savedAt: now,
      owner: items[0]?.[0] || null,
      items,
      meta
    }))
  }, { items, meta })
}

export async function readDrafts (page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('composeDrafts')
    if (!raw) return null
    const text = raw.replace(/^__q_objt\|/, '')
    try { return JSON.parse(text) } catch { return null }
  })
}

export async function seedDrafts (page, drafts) {
  await page.addInitScript(({ drafts }) => {
    localStorage.setItem('composeDrafts', '__q_objt|' + JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      drafts
    }))
  }, { drafts })
}

export function escapeRegExp (value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const HIVE_API_HOSTS = [
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

function communityRecord (index, overrides = {}) {
  return {
    name: 'hive-' + (100000 + index),
    title: 'Community ' + index,
    about: 'A community about hive topics.',
    type_id: 1,
    subscribers: 5000 - index,
    num_authors: 20 + index,
    num_pending: 4,
    sum_pending: 1.5,
    created_at: '2024-01-01 00:00:00',
    is_nsfw: false,
    lang: 'en',
    ...overrides
  }
}

function communityRecords (start, count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => communityRecord(start + index, overrides))
}

/**
 * Deterministic `bridge.list_communities` mock for directory/shelf tests.
 * Avoids live public nodes, 45s polls and the "exactly 100 live cards" flake.
 */
export async function mockCommunityDirectory (page) {
  const base = communityRecords(0, 300)
  const art = communityRecords(300, 100, { title: 'Art community', about: 'Art and design.' })
  const artMore = communityRecords(400, 20, { title: 'More art', about: 'More art and design.' })
  const gaming = communityRecords(500, 12, { title: 'Gaming community', about: 'Gaming and play.' })
  const ocd = communityRecord(578, {
    name: 'hive-174578',
    title: 'OCD community',
    about: 'The OCD community.',
    settings: { flag_text: 'Be kind and stay on topic.' },
    team: [['hive-174578', 'owner', 'OCD community']]
  })

  for (const host of HIVE_API_HOSTS) {
    const pattern = new RegExp('^' + host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/.*)?$')
    await page.route(pattern, async route => {
      const request = route.request()
      let payload = {}
      try {
        payload = request.postDataJSON() || {}
      } catch {}
      const method = payload.method || ''
      const params = payload.params || {}
      let result = null

      if (method === 'bridge.list_communities') {
        const query = String(params.query || '').trim().toLowerCase()
        const limit = Math.max(1, Math.min(100, Number(params.limit) || 36))
        if (query === 'art') {
          result = params.last ? artMore : art.slice(0, limit)
        } else if (query === 'gaming') {
          result = gaming.slice(0, limit)
        } else if (query === 'hive-174578') {
          result = []
        } else if (params.sort === 'new') {
          result = base.slice(0, limit)
        } else if (params.sort === 'subs') {
          result = base.slice(100, 100 + limit)
        } else {
          result = base.slice(200, 200 + limit)
        }
      } else if (method === 'bridge.get_community') {
        result = params.name === 'hive-174578' ? ocd : null
      } else if (method === 'bridge.get_ranked_posts') {
        result = []
      } else if (method === 'bridge.list_subscribers') {
        result = []
      } else if (method === 'condenser_api.get_accounts') {
        const names = Array.isArray(params) ? (params[0] || []) : []
        result = names.map(name => ({
          name,
          created: '2020-01-01T00:00:00',
          reputation: 60,
          post_count: 0,
          balance: '0.000 HIVE',
          hbd_balance: '0.000 HBD',
          vesting_shares: '0.000000 VESTS',
          json_metadata: '{}',
          posting_json_metadata: '{}'
        }))
      } else if (method === 'condenser_api.lookup_accounts') {
        const prefix = String(params[0] || '').toLowerCase()
        result = prefix.startsWith('hive-174578') ? ['hive-174578'] : []
      } else if (method === 'condenser_api.get_dynamic_global_properties') {
        result = {
          head_block_number: 100000000,
          last_irreversible_block_num: 99999999,
          time: '2026-01-01T00:00:00',
          current_witness: 'alice',
          total_vesting_fund_hive: '150000000.000 HIVE',
          total_vesting_shares: '400000000000.000000 VESTS'
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, result })
      })
    })
  }
}

function rankedPost (index, overrides = {}) {
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
    stats: { gray: false, hide: false, is_pinned: false },
    ...overrides
  }
}

/** Deterministic ranked feed for browse, quick-look and vote specs. */
export async function mockRankedPosts (page, { count = 36, post = {} } = {}) {
  const posts = Array.from({ length: count }, (_, index) => rankedPost(index, post))

  for (const host of HIVE_API_HOSTS) {
    const pattern = new RegExp('^' + host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/.*)?$')
    await page.route(pattern, async route => {
      const request = route.request()
      let payload = {}
      try {
        payload = request.postDataJSON() || {}
      } catch {}
      const method = payload.method || ''
      const params = payload.params || {}
      let result = null

      if (method === 'bridge.get_ranked_posts') {
        const start = Number(String(params.start_permlink || '').replace('post-', '')) || 0
        const limit = Math.max(1, Math.min(100, Number(params.limit) || 12))
        result = posts.slice(start, start + limit)
      } else if (method === 'condenser_api.get_dynamic_global_properties') {
        result = {
          head_block_number: 100000000,
          last_irreversible_block_num: 99999999,
          time: '2026-01-01T00:00:00',
          current_witness: 'alice',
          total_vesting_fund_hive: '150000000.000 HIVE',
          total_vesting_shares: '400000000000.000000 VESTS'
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ jsonrpc: '2.0', id: payload.id || 1, result })
      })
    })
  }

  return posts
}
