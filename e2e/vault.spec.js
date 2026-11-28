import { test, expect } from './fixtures'
import { loginAs, readQueue, runAxe, seedDrafts, waitForApp } from './helpers'
import {
  encryptPayload,
  generateReaderKeyPair,
  randomKey,
  readerKeyThumbprint,
  sealKeyring,
  wrapRingKey
} from '../src/services/vaultCrypto.js'
import { buildVaultMetadata } from '../src/services/vaultPayload.js'
import {
  buildBulletinSigningPayload,
  buildGrantHeader
} from '../src/services/vaultGrant.js'
import { buildVaultProductMetadata } from '../src/services/vaultProduct.js'
import { buildVaultShardedBulletin, planShardUpdates } from '../src/services/vaultBulletin.js'

// The production build registers a service worker on loopback. Its navigation
// fallback can answer the same-origin requests before Playwright's route mock,
// so keep service workers out of these network-mocked tests.
test.use({ serviceWorkers: 'block' })

const BLOG = 'alice'
const PERIOD = '2026-11'
const KID = '2026-11'
const PRODUCT = 'alice/membership'
const CONTAINER = 'banksia-vault'
const PRICE = '5.000 HBD'
const TEASER = 'A public teaser for everyone.'
const PREMIUM_TEXT = 'Members-only secret: the orchid blooms at midnight, and only members may read this sentence.'
const PREMIUM_TOKEN = 'orchid blooms at midnight'
const EXPIRES = '2026-12-27T12:00:00Z'
const BULLETIN_PERMLINK = 'vault-2026-11-1'

const VAULT_SETTINGS = {
  v: 1,
  enabled: true,
  product: PRODUCT,
  container: CONTAINER,
  bulletin: { author: BLOG, permlink: BULLETIN_PERMLINK },
  price: PRICE,
  period: 'month',
  recurrence: 730,
  executions: 12,
  archive: 'all',
  watermark: true,
  productTitle: 'The Orchid Letter',
  productDescription: 'Weekly orchid field notes and the full archive.',
  benefits: ['Weekly orchid notes', 'Full archive'],
  updatedAt: '2026-11-27T09:00:00.000Z'
}

const GLOBAL_PROPS = {
  head_block_number: 1,
  head_block_id: '0000000000000000000000000000000000000000',
  time: '2026-11-27T00:00:00',
  current_witness: 'alice',
  total_vesting_fund_hive: '1.000 HIVE',
  total_vesting_shares: '1.000000 VESTS',
  hbd_interest_rate: 0
}

const BOB_ACCOUNT = {
  name: 'bob',
  created: '2025-01-01T00:00:00',
  json_metadata: '',
  posting_json_metadata: JSON.stringify({ profile: { name: 'Bob' } })
}

function accountFor (postingKey) {
  return {
    name: BLOG,
    created: '2025-01-01T00:00:00',
    json_metadata: '',
    posting_json_metadata: JSON.stringify({
      profile: { name: 'Alice', about: 'Writer and photographer.' },
      'banksia.io': {
        blog: {
          version: 1,
          claimed: true,
          title: 'Alice writes',
          description: 'Notes from the garden.',
          theme: 'paper',
          directory: true,
          vault: VAULT_SETTINGS
        }
      }
    }),
    posting: { weight_threshold: 1, account_auths: [], key_auths: [[postingKey, 1]] },
    memo_key: postingKey
  }
}

async function makeVaultFixture ({ tamperCiphertext = false } = {}) {
  const { PrivateKey, utils } = await import('hive-tx')
  const privateKey = PrivateKey.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
  const wif = privateKey.toString()
  const postingKey = privateKey.createPublic().toString()

  const contentKey = randomKey()
  const ringKey = randomKey()
  const keyring = { [KID]: contentKey }

  const encrypted = await encryptPayload(PREMIUM_TEXT, contentKey, {
    blog: BLOG,
    permlink: 'members-post',
    kid: KID,
    mode: 'section'
  })
  let ct = encrypted.ct
  if (tamperCiphertext) ct = (ct.startsWith('A') ? 'B' : 'A') + ct.slice(1)

  const vaultMetadata = buildVaultMetadata({
    mode: 'section',
    kid: KID,
    iv: encrypted.iv,
    ct,
    hash: encrypted.hash,
    bytes: encrypted.bytes,
    tier: 'member',
    price: PRICE,
    product: PRODUCT,
    container: CONTAINER,
    paywall: {
      title: 'Read the rest of this post',
      body: 'Members get every premium post and the full archive.',
      benefits: ['Every members-only post', 'The full members-only archive']
    }
  })

  const premiumPost = {
    author: BLOG,
    permlink: 'members-post',
    title: 'The orchid notes',
    body: TEASER + '\n\n<!--banksia:vault-->',
    created: '2026-11-20T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({
      app: 'banksia.io',
      format: 'markdown',
      tags: ['garden'],
      banksia_vault: vaultMetadata
    })
  }

  const productMetadata = buildVaultProductMetadata(VAULT_SETTINGS)
  const productPost = {
    author: BLOG,
    permlink: 'membership',
    title: VAULT_SETTINGS.productTitle,
    body: 'Weekly orchid field notes and the full archive.',
    created: '2026-11-18T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({ ...productMetadata, app: 'banksia.io', format: 'markdown' })
  }

  return {
    privateKey,
    utils,
    wif,
    postingKey,
    contentKey,
    ringKey,
    keyring,
    encrypted,
    vaultMetadata,
    premiumPost,
    productPost,
    account: accountFor(postingKey)
  }
}

async function makeReaderKey () {
  const pair = await generateReaderKeyPair()
  return { pair, readerKey: pair.publicKeyB64 }
}

async function buildSignedBulletin (fixture, readers, { expires = EXPIRES } = {}) {
  const entries = []
  for (const reader of readers) {
    const readerKey = reader.readerKey || reader.publicKeyB64
    const rkt = reader.rkt
    const header = buildGrantHeader(
      { rkt, tier: 'member', expires },
      { blog: BLOG, period: PERIOD, tier: 'member' }
    )
    const wrapped = await wrapRingKey(fixture.ringKey, readerKey, header)
    entries.push({ rkt, ...wrapped, tier: 'member', expires })
  }
  const sealed = await sealKeyring(fixture.keyring, fixture.ringKey, { blog: BLOG, period: PERIOD })
  const bulletin = {
    v: 1,
    blog: BLOG,
    period: PERIOD,
    seq: 1,
    issued: '2026-11-27T09:00:00.000Z',
    keyring: sealed,
    entries,
    claims: [],
    signer: BLOG,
    delegation: null
  }
  bulletin.sig = await fixture.utils.signMessage(await buildBulletinSigningPayload(bulletin), fixture.privateKey)
  const post = {
    author: BLOG,
    permlink: BULLETIN_PERMLINK,
    parent_author: BLOG,
    parent_permlink: CONTAINER,
    depth: 1,
    title: '',
    body: 'Vault grant bulletin.',
    created: '2026-11-27T09:00:00',
    json_metadata: JSON.stringify({ app: 'banksia.io', banksia_vault_bulletin: bulletin })
  }
  return { bulletin, post }
}

async function buildSignedShardedBulletin (fixture, readers, { expires = EXPIRES } = {}) {
  const canonicalExpires = new Date(expires).toISOString()
  const entries = []
  for (const reader of readers) {
    const readerKey = reader.readerKey || reader.publicKeyB64
    const header = buildGrantHeader(
      { rkt: reader.rkt, tier: 'member', expires: canonicalExpires },
      { blog: BLOG, period: PERIOD, tier: 'member' }
    )
    const wrapped = await wrapRingKey(fixture.ringKey, readerKey, header)
    entries.push({ rkt: reader.rkt, ...wrapped, expires: canonicalExpires })
  }
  const plan = await planShardUpdates({
    blog: BLOG,
    period: PERIOD,
    shardCount: 8,
    entries,
    existingShards: []
  })
  const bulletin = await buildVaultShardedBulletin({
    blog: BLOG,
    period: PERIOD,
    seq: 1,
    keyring: fixture.keyring,
    ringKey: fixture.ringKey,
    shardCount: 8,
    shards: plan.descriptors,
    signer: BLOG,
    issued: '2026-11-27T09:00:00.000Z',
    signAdapter: {
      sign: async text => fixture.utils.signMessage(text, fixture.privateKey)
    }
  })
  const post = {
    author: BLOG,
    permlink: BULLETIN_PERMLINK,
    parent_author: BLOG,
    parent_permlink: CONTAINER,
    depth: 1,
    title: '',
    body: 'Vault grant shards.',
    created: '2026-11-27T09:00:00',
    json_metadata: JSON.stringify({ app: 'banksia.io', banksia_vault_bulletin: bulletin })
  }
  const shardPosts = plan.shards.map(shard => ({
    author: BLOG,
    permlink: shard.permlink,
    parent_author: BLOG,
    parent_permlink: CONTAINER,
    depth: 1,
    title: '',
    body: '',
    created: '2026-11-27T09:00:00',
    json_metadata: JSON.stringify({ app: 'banksia.io', banksia_vault_shard: shard.object })
  }))
  return { bulletin, post, shardPosts }
}

function readerKeyWithThumbprint () {
  return makeReaderKey().then(async ({ pair, readerKey }) => ({
    pair,
    readerKey,
    rkt: await readerKeyThumbprint(readerKey)
  }))
}

function makeState (fixture) {
  return {
    accounts: { alice: fixture.account, bob: BOB_ACCOUNT },
    profile: {
      name: BLOG,
      metadata: {
        profile: { name: 'Alice', about: 'Writer and photographer.' }
      }
    },
    posts: {
      'members-post': fixture.premiumPost,
      membership: fixture.productPost
    },
    replies: { [CONTAINER]: [] },
    histories: { alice: [], bob: [] },
    recurrent: { alice: [], bob: [] },
    accountPosts: { alice: [fixture.premiumPost, fixture.productPost] }
  }
}

async function mockHive (page, state) {
  await page.route(/^https:\/\/api\.hive\.blog(?:\/.*)?$/, async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    let body
    try {
      body = JSON.parse(request.postData() || '{}')
    } catch {
      return route.continue()
    }
    const params = Array.isArray(body.params) ? body.params : []
    let result
    switch (body.method) {
      case 'condenser_api.get_accounts': {
        const names = Array.isArray(params[0]) ? params[0] : params
        result = names
          .map(name => state.accounts[String(name || '').toLowerCase()] || null)
          .filter(Boolean)
        break
      }
      case 'condenser_api.get_content':
        result = state.posts[params[1]] || null
        break
      case 'condenser_api.get_content_replies':
        result = state.replies[params[1]] || []
        break
      case 'condenser_api.get_account_history':
        result = state.histories[params[0]] || []
        break
      case 'condenser_api.find_recurrent_transfers':
        result = state.recurrent[params[0]] || []
        break
      case 'condenser_api.get_dynamic_global_properties':
        result = GLOBAL_PROPS
        break
      case 'bridge.get_profile':
        result = state.profile
        break
      case 'bridge.get_account_posts':
        result = state.accountPosts[(params[0] && params[0].account) || ''] ||
          state.accountPosts[BLOG] ||
          []
        break
      case 'bridge.get_post':
        result = state.posts[params[0] && params[0].permlink] || null
        break
      default:
        result = null
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id || 1, result })
    })
  })
}

async function seedReaderKey (page) {
  return page.evaluate(async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    )
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw))
    const rkt = [...digest.slice(0, 8)]
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
    const b64 = btoa(String.fromCharCode(...raw))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const publicKeyB64 = 'p256:' + b64
    const record = {
      id: 'alice\u0000bob',
      blog: 'alice',
      publicKeyB64,
      privateKey: pair.privateKey,
      rkt,
      createdAt: new Date().toISOString(),
      account: 'bob'
    }
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('banksia-vault', 2)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('reader-keys')) {
          db.createObjectStore('reader-keys', { keyPath: 'blog' })
        }
        if (!db.objectStoreNames.contains('reader-keys-by-account')) {
          db.createObjectStore('reader-keys-by-account', { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('reader-keys-by-account', 'readwrite')
      transaction.objectStore('reader-keys-by-account').put(record)
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    })
    return { publicKeyB64, rkt }
  })
}

async function axeAtBothWidths (page, label) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(400)
    const violations = await runAxe(page)
    expect(violations, label + ' at ' + viewport.width + 'px').toEqual([])
  }
}

function storageLeak (page, secret) {
  return page.evaluate(value => {
    const entries = []
    for (const store of [localStorage, sessionStorage]) {
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index)
        entries.push(key, store.getItem(key))
      }
    }
    return JSON.stringify(entries).includes(value)
  }, secret)
}

function vaultHistoryRow ({ index, trxId, readerKey, sub, type = 'fill_recurrent_transfer', timestamp }) {
  const memo = JSON.stringify({
    product: PRODUCT,
    quantity: 1,
    banksia: { v: 1, plan: 'member', reader_key: readerKey, sub, gift_for: null }
  })
  const body = type === 'transfer'
    ? { from: 'bob', to: BLOG, amount: PRICE, memo }
    : { from: 'bob', to: BLOG, amount: PRICE, memo, remaining_executions: 11 }
  return [index, { trx_id: trxId, timestamp, op: [type, body] }]
}

test('locked premium post shows a paywall and never renders plaintext', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  await mockHive(page, state)
  await page.goto('/@alice/members-post', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.banksia-locked')).toBeVisible()
  await expect(page.getByText(TEASER)).toBeVisible()
  await expect(page.locator('.banksia-locked__title')).toBeVisible()

  const html = await page.content()
  expect(html).not.toContain(PREMIUM_TOKEN)
  expect(html).not.toContain(PREMIUM_TEXT)
  expect(await page.locator('body').innerText()).not.toContain(PREMIUM_TOKEN)

  const jsonLd = JSON.parse(await page.locator('#page-json-ld').textContent())
  expect(jsonLd.isAccessibleForFree).toBe(false)
  expect(jsonLd.hasPart).toMatchObject({
    '@type': 'WebPageElement',
    isAccessibleForFree: false,
    cssSelector: '.banksia-locked'
  })

  await axeAtBothWidths(page, 'locked premium post')
})

test('a subdomain blog is read-only and sends members to the apex', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  await mockHive(page, state)

  await page.goto('http://alice.localhost:4173/members-post', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.banksia-locked')).toBeVisible()
  await expect(page.getByText(TEASER)).toBeVisible()
  expect(await page.content()).not.toContain(PREMIUM_TOKEN)
  expect(await page.locator('body').innerText()).not.toContain(PREMIUM_TOKEN)

  const apexLink = page.locator('.banksia-locked a.banksia-locked__button--primary')
  await expect(apexLink).toHaveText('Read on Banksia')
  await expect(apexLink).toHaveAttribute('href', 'https://banksia.io/@alice/members-post')
  await expect(page.getByText(/read-only/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Subscribe/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Use my membership on this device' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Already a member? Restore access' })).toHaveCount(0)

  await axeAtBothWidths(page, 'read-only blog premium post')
})

test('a signed-in member can authorize this device with a public key only', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)

  await page.goto('/@alice/members-post', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.banksia-locked')).toBeVisible()
  const useDevice = page.getByRole('button', { name: 'Use my membership on this device' })
  await expect(useDevice).toBeVisible()
  await expect(useDevice).toBeEnabled()
  await useDevice.click()
  await expect(page.getByText(/Device request queued/)).toBeVisible()

  const queue = await readQueue(page)
  const item = (queue && Array.isArray(queue.items) ? queue.items : [])
    .find(entry => entry[2] && entry[2][0] === 'account_update2')
  expect(item).toBeTruthy()
  expect(item[0]).toBe('bob')
  expect(item[1]).toBe('posting')
  const [name, operation] = item[2]
  expect(name).toBe('account_update2')
  expect(operation.account).toBe('bob')
  expect(operation.json_metadata).toBe('')
  const metadata = JSON.parse(operation.posting_json_metadata)
  const keys = metadata['banksia.io'].reader.devices.alice
  expect(keys).toHaveLength(1)
  expect(keys[0]).toMatch(/^p256:[A-Za-z0-9_-]{40,120}$/)
  expect(operation.posting_json_metadata).not.toMatch(/private|secret|passphrase/i)
})

test('a valid grant unlocks once, persists across reloads and leaks nothing to storage', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)
  await page.goto('/about', { waitUntil: 'domcontentloaded' })

  const reader = await seedReaderKey(page)
  const { post } = await buildSignedBulletin(fixture, [reader], { expires: EXPIRES })
  state.posts[BULLETIN_PERMLINK] = post
  state.replies[CONTAINER] = [post]

  await page.goto('/@alice/members-post', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(PREMIUM_TOKEN)).toBeVisible()
  await expect(page.getByText(PREMIUM_TOKEN)).toHaveCount(1)
  await expect(page.locator('.banksia-unlocked__badge')).toHaveText('Member')
  await expect(page.locator('.banksia-unlocked__watermark').first()).toContainText('Licensed to @bob')
  await expect(page.locator('.banksia-unlocked__watermark').first()).toContainText(PERIOD)
  await expect(page.locator('.banksia-unlocked__announce')).toHaveText('Members-only content unlocked.')
  await expect(page.locator('.banksia-unlocked')).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator('.banksia-locked')).toHaveCount(0)

  expect(await storageLeak(page, PREMIUM_TOKEN)).toBe(false)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText(PREMIUM_TOKEN)).toBeVisible()
  await expect(page.locator('.banksia-unlocked__badge')).toHaveText('Member')
  expect(await storageLeak(page, PREMIUM_TOKEN)).toBe(false)

  // Logging out must not leave the decrypted post open on a shared browser.
  // `loginAs` seeds sessionStorage on every navigation, so add a later init
  // script that clears it after the login seed has run.
  await page.addInitScript(() => {
    sessionStorage.removeItem('loggedInUser')
    sessionStorage.removeItem('loginType')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForApp(page)
  await expect(page.getByText(PREMIUM_TOKEN)).toHaveCount(0)
  await expect(page.locator('.banksia-locked')).toBeVisible()
})

test('an expired grant keeps the paywall and explains the membership ended', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)
  await page.goto('/about', { waitUntil: 'domcontentloaded' })

  const reader = await seedReaderKey(page)
  const { post } = await buildSignedBulletin(fixture, [reader], { expires: '2026-11-01T00:00:00Z' })
  state.posts[BULLETIN_PERMLINK] = post
  state.replies[CONTAINER] = [post]

  await page.goto('/@alice/members-post', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.banksia-locked')).toBeVisible()
  await expect(page.getByText(/membership ended/i)).toBeVisible()
  expect(await page.content()).not.toContain(PREMIUM_TOKEN)
})

test('a tampered ciphertext fails closed with a safe error', async ({ page }) => {
  const fixture = await makeVaultFixture({ tamperCiphertext: true })
  const state = makeState(fixture)
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)
  await page.goto('/about', { waitUntil: 'domcontentloaded' })

  const reader = await seedReaderKey(page)
  const { post } = await buildSignedBulletin(fixture, [reader])
  state.posts[BULLETIN_PERMLINK] = post
  state.replies[CONTAINER] = [post]

  await page.goto('/@alice/members-post', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.banksia-locked')).toBeVisible()
  await expect(page.getByText(/could not be unlocked/i)).toBeVisible()
  expect(await page.content()).not.toContain(PREMIUM_TOKEN)
})

test('subscribe queues exactly one active recurrent transfer with the public reader key', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)

  await page.goto('/subscribe?blog=alice&product=alice%2Fmembership&redirect=%2F%40alice%2Fmembers-post', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.subscribe-title')).toHaveText('The Orchid Letter')
  await expect(page.locator('.subscribe-head')).toContainText('Weekly orchid field notes and the full archive.')
  await expect(page.locator('.subscribe-benefits')).toContainText('Weekly orchid notes')
  await expect(page.locator('.subscribe-benefits')).toContainText('Full archive')
  await expect(page.locator('.subscribe-price')).toHaveText(PRICE)
  await expect(page.locator('.subscribe-plan .subscribe-muted')).toContainText('every month')

  await axeAtBothWidths(page, 'subscribe')

  await page.getByRole('checkbox').click()
  const payButton = page.getByRole('button', { name: /Queue .*recurring payments/ })
  await expect(payButton).toBeEnabled()
  await payButton.click()

  const queue = await readQueue(page)
  expect(queue.items).toHaveLength(1)
  const [owner, authority, operation] = queue.items[0]
  expect(owner).toBe('bob')
  expect(authority).toBe('active')
  expect(operation[0]).toBe('recurrent_transfer')
  expect(operation[1]).toMatchObject({
    to: BLOG,
    amount: PRICE,
    recurrence: 730,
    executions: 12
  })

  const memo = JSON.parse(operation[1].memo)
  expect(memo.product).toBe(PRODUCT)
  expect(memo.banksia.reader_key).toMatch(/^p256:[A-Za-z0-9_-]{40,120}$/)
  expect(operation[1].memo).not.toMatch(/private|secret|passphrase|mnemonic/i)
  expect(operation[1].memo).not.toMatch(/\b5[HJK][1-9A-HJ-NP-Za-km-z]{49}\b/)

  // After the creator issues this reader's grant, "Back to the blog post" must
  // return to the post the reader started from, not the membership product.
  const readerKey = memo.banksia.reader_key
  const grantReader = { readerKey, rkt: await readerKeyThumbprint(readerKey) }
  const { post: grantPost } = await buildSignedBulletin(fixture, [grantReader])
  state.posts[BULLETIN_PERMLINK] = grantPost
  state.replies[CONTAINER] = [grantPost]
  const back = page.getByRole('link', { name: 'Back to the blog post' })
  await expect(back).toBeVisible({ timeout: 20000 })
  await expect(back).toHaveAttribute('href', '/@alice/members-post')
})

test('creator dashboard derives subscribers, revenue and masked keys', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  const first = await readerKeyWithThumbprint()
  const second = await readerKeyWithThumbprint()
  const { post } = await buildSignedBulletin(fixture, [
    { readerKey: first.readerKey, rkt: first.rkt },
    { readerKey: second.readerKey, rkt: second.rkt }
  ])
  state.posts[BULLETIN_PERMLINK] = post
  state.replies[CONTAINER] = [post]
  state.histories[BLOG] = [
    vaultHistoryRow({
      index: 1,
      trxId: 'pay-transfer',
      readerKey: first.readerKey,
      sub: 'transferreader0001',
      type: 'transfer',
      timestamp: '2026-11-20T10:00:00'
    }),
    vaultHistoryRow({
      index: 2,
      trxId: 'pay-fill',
      readerKey: second.readerKey,
      sub: 'fillreader0000001',
      timestamp: '2026-11-24T10:00:00'
    })
  ]
  loginAs(page, 'alice', 'keychain')
  await mockHive(page, state)

  await page.goto('/settings/blog/vault', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.vault-title')).toContainText('Creator dashboard')
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

  const activeCard = page.locator('.vault-card').filter({ hasText: 'Active members' })
  await expect(activeCard.locator('.vault-metric')).toHaveText('2')
  await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible()
  await expect(page.locator('.vault-table').first().locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('.vault-table').first().locator('tbody tr').first().locator('code')).toContainText('…')
  await expect(page.getByRole('button', { name: 'Download payments CSV' })).toBeEnabled()

  const html = await page.content()
  expect(html).not.toContain(fixture.wif)
  expect(html).not.toContain(fixture.contentKey)
  expect(html).not.toContain(fixture.ringKey)
  expect(html).not.toContain('BEGIN PRIVATE KEY')

  await axeAtBothWidths(page, 'vault dashboard')
})

test('creator dashboard merges registered device keys into the subscriber row', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  const reader = await readerKeyWithThumbprint()
  const device = await makeReaderKey()
  state.accounts.bob = {
    ...BOB_ACCOUNT,
    posting_json_metadata: JSON.stringify({
      'banksia.io': {
        reader: { v: 1, devices: { [BLOG]: [device.readerKey] } }
      }
    })
  }
  const { post } = await buildSignedBulletin(fixture, [{ readerKey: reader.readerKey, rkt: reader.rkt }])
  state.posts[BULLETIN_PERMLINK] = post
  state.replies[CONTAINER] = [post]
  state.histories[BLOG] = [
    vaultHistoryRow({
      index: 1,
      trxId: 'pay-device',
      readerKey: reader.readerKey,
      sub: 'devicereader00001',
      type: 'transfer',
      timestamp: '2026-11-25T10:00:00'
    })
  ]
  loginAs(page, 'alice', 'keychain')
  await mockHive(page, state)

  await page.goto('/settings/blog/vault', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible()
  const table = page.locator('.vault-table').first()
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table.locator('tbody tr').first()).toContainText('+1 device')
  await expect(table.locator('tbody tr').first()).toContainText('not granted')
})

test('creator dashboard reads a v2 sharded bulletin without fetching every shard', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  const reader = await readerKeyWithThumbprint()
  const { post, shardPosts } = await buildSignedShardedBulletin(fixture, [{
    readerKey: reader.readerKey,
    rkt: reader.rkt
  }])
  state.posts[BULLETIN_PERMLINK] = post
  for (const shard of shardPosts) state.posts[shard.permlink] = shard
  state.replies[CONTAINER] = [post, ...shardPosts]
  state.histories[BLOG] = [
    vaultHistoryRow({
      index: 1,
      trxId: 'pay-sharded',
      readerKey: reader.readerKey,
      sub: 'shardedreader0001',
      type: 'transfer',
      timestamp: '2026-11-25T10:00:00'
    })
  ]
  loginAs(page, 'alice', 'keychain')
  await mockHive(page, state)

  await page.goto('/settings/blog/vault', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Bulletins' })).toBeVisible()
  await expect(page.getByText('sharded (v2)')).toBeVisible()
  await expect(page.locator('.vault-table').first().locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('.vault-table').first().locator('tbody tr').first()).toContainText('expires')
})

test('reader subscriptions show the plan, next payment and an open-transfer cancel', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  const reader = await readerKeyWithThumbprint()
  const row = vaultHistoryRow({
    index: 1,
    trxId: 'pay-fill',
    readerKey: reader.readerKey,
    sub: 'fillreader0000001',
    timestamp: '2026-11-24T10:00:00'
  })
  const memo = JSON.parse(row[1].op[1].memo)
  state.histories.bob = [row]
  state.recurrent.bob = [{
    id: 501,
    trigger_date: '2026-12-24T10:00:00',
    from: 'bob',
    to: BLOG,
    amount: PRICE,
    memo: JSON.stringify(memo),
    recurrence: 730,
    remaining_executions: 11,
    pair_id: 0
  }]
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)

  await page.goto('/subscriptions', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.subs-item-title')).toContainText(/membership/i)
  await expect(page.locator('.subs-pill')).toHaveText('Active')
  await expect(page.locator('.subs-item')).toContainText(PRICE + ' every 730 hours')
  await expect(page.locator('.subs-facts').first()).toContainText('Next payment')
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await expect(page.locator('.subs-table').first().locator('tbody tr')).toHaveCount(1)

  await axeAtBothWidths(page, 'subscriptions')

  await page.getByRole('button', { name: 'Cancel' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'zero-amount' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Access continues')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toBeHidden()
})

test('a plan with access but no open transfer hides the cancel button', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  const reader = await readerKeyWithThumbprint()
  const row = vaultHistoryRow({
    index: 1,
    trxId: 'pay-fill',
    readerKey: reader.readerKey,
    sub: 'fillreader0000001',
    timestamp: '2026-11-24T10:00:00'
  })
  state.histories.bob = [row]
  state.recurrent.bob = []
  loginAs(page, 'bob', 'keychain')
  await mockHive(page, state)

  await page.goto('/subscriptions', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.subs-item-title')).toContainText(/membership/i)
  await expect(page.locator('.subs-pill')).toHaveText('Active')
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  await expect(page.locator('.subs-item')).toContainText('No active recurring transfer to cancel')
  await axeAtBothWidths(page, 'subscriptions without open transfer')
})

test('composer exposes the membership marker, lock controls and size meter', async ({ page }) => {
  const fixture = await makeVaultFixture()
  const state = makeState(fixture)
  loginAs(page, 'alice', 'keychain')
  await seedDrafts(page, [{
    id: 'e2e-vault-draft',
    owner: 'alice',
    title: 'Members draft',
    body: 'A public teaser line.\n\n<!--banksia:vault-->\n\n' + PREMIUM_TEXT,
    tags: ['hive'],
    community: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    vault: { enabled: true, mode: 'section' }
  }])
  await mockHive(page, state)

  await page.goto('/compose/e2e-vault-draft', { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  await expect(page.getByLabel('Post title')).toHaveValue('Members draft')
  await expect(page.getByRole('heading', { name: 'Members only' })).toBeVisible()
  await expect(page.getByText('Membership', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Disable members-only content')).toBeChecked()
  await expect(page.getByRole('button', { name: 'Lock from here' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Preview as reader' })).toBeEnabled()
  await expect(page.locator('.compose-vault__size')).toContainText('bytes of members-only text')

  const body = await page.getByLabel('Post body in Markdown').inputValue()
  expect(body).toContain('<!--banksia:vault-->')
  expect(body).toContain(PREMIUM_TOKEN)
})
