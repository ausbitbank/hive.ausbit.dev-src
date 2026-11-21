import { test, expect } from './fixtures'
import { loginAs, readDrafts, readQueue, seedDrafts, seedQueue, waitForApp } from './helpers'

const QUEUE_ITEMS = [
  ['ausbitbank', 'active', ['transfer', { from: 'ausbitbank', to: 'alice', amount: '1.000 HIVE', memo: '' }]],
  ['ausbitbank', 'posting', ['vote', { voter: 'ausbitbank', author: 'alice', permlink: 'hello', weight: 10000 }]]
]
const QUEUE_META = [
  { status: 'sent', error: '', txId: 'abc123def456', addedAt: Date.now() - 60000, updatedAt: Date.now() - 50000 },
  { status: 'failed', error: 'Keychain is unavailable.', txId: '', addedAt: Date.now() - 30000, updatedAt: Date.now() - 20000 }
]

test.describe('action flows', () => {
  test('compose autosaves and restores a local draft', async ({ page }) => {
    test.setTimeout(120000)
    const runtimeErrors = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error' && /(TypeError|is not a function|Cannot read|undefined is not)/i.test(message.text())) {
        runtimeErrors.push(message.text())
      }
    })
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Write a post' })).toBeVisible({ timeout: 30000 })

    await page.getByLabel('Post title').fill('E2E autosave draft')
    await page.getByLabel('Post body in Markdown').fill('Draft body written by the fast E2E suite.')

    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.title === 'E2E autosave draft')
    }).toBe(true)

    await page.reload()
    await waitForApp(page)
    await expect(page.getByLabel('Post title')).toHaveValue('E2E autosave draft')
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue('Draft body written by the fast E2E suite.')
    expect(runtimeErrors).toEqual([])
  })

  test('compose queues a top-level posting comment', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await seedDrafts(page, [{
      id: 'e2e-compose-draft',
      owner: 'ausbitbank',
      title: 'E2E compose post',
      body: 'A queued post from the fast E2E suite.\n\n## Heading\n\n- one\n- two',
      tags: ['hive', 'testing'],
      community: 'hive-174578',
      crossPost: null,
      beneficiaries: [{ account: 'ausbitbank', weight: 1000 }],
      rewards: { maxAcceptedPayout: '100000.000 HBD', percentHbd: 10000, allowVotes: true, allowCurationRewards: true },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByLabel('Post title')).toHaveValue('E2E compose post')

    await page.getByRole('button', { name: 'Queue post for signing' }).click()
    await page.getByRole('button', { name: 'Queue for signing' }).click()
    await expect.poll(async () => {
      const queue = await readQueue(page)
      return queue?.items?.some(item =>
        item[1] === 'posting' &&
        item[2]?.[0] === 'comment' &&
        item[2]?.[1]?.parent_author === '' &&
        item[2]?.[1]?.parent_permlink === 'hive-174578'
      )
    }).toBe(true)

    const stored = await readDrafts(page)
    expect(stored?.drafts?.some(draft => draft.id === 'e2e-compose-draft')).toBeFalsy()
  })

  test('compose inserts a recent upload into the body', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    const recent = {
      version: 1,
      items: [{
        url: 'https://images.hive.blog/recent.jpg',
        alt: 'Recent shot',
        name: 'recent.jpg',
        size: 2048,
        type: 'image/png',
        uploadedAt: Date.now()
      }]
    }
    await page.addInitScript(history => {
      localStorage.setItem('composeUploads:ausbitbank', '__q_objt|' + JSON.stringify(history))
    }, recent)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByLabel('Post body in Markdown').fill('A post with an image.')
    await page.getByRole('button', { name: 'Upload image' }).click()
    await expect(page.getByRole('heading', { name: 'Upload images' })).toBeVisible()
    await expect(page.getByText('Recent uploads')).toBeVisible()
    await page.locator('.compose-media-tile').first().click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue(
      /!\[Recent shot\]\(https:\/\/images\.hive\.blog\/recent\.jpg\)/
    )
  })

  test('compose uploads an image through Keychain and inserts it', async ({ page }) => {
    test.setTimeout(120000)
    test.skip(Boolean(process.env.OBSCURA_CDP), 'File inputs need Chromium')
    await loginAs(page)
    await page.addInitScript(() => {
      window.hive_keychain = {
        requestHandshake: callback => callback({ success: true }),
        requestSignBuffer: (account, message, key, callback) => {
          window.__imageUploadSign = {
            account,
            key,
            length: message.length,
            prefix: message.slice(0, 40)
          }
          callback({ success: true, result: 'fakesignature' })
        }
      }
    })
    await page.route('https://images.hive.blog/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://images.hive.blog/fake/uploaded.png' })
    }))

    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Upload image' }).click()
    const dialog = page.locator('.compose-media-dialog')
    await expect(dialog.getByRole('heading', { name: 'Upload images' })).toBeVisible()
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    })
    await dialog.getByLabel('Alt text').fill('A test image')
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()

    await expect(page.getByLabel('Post body in Markdown')).toHaveValue(
      /!\[A test image\]\(https:\/\/images\.hive\.blog\/fake\/uploaded\.png\)/
    )
    const sign = await page.evaluate(() => window.__imageUploadSign)
    expect(sign.account).toBe('ausbitbank')
    expect(sign.key).toBe('Posting')
    expect(sign.length).toBeGreaterThan(100)
    expect(sign.prefix).toContain('"type":"Buffer"')
  })

  test('compose writes media, AI, countdown and declined-reward metadata', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await seedDrafts(page, [{
      id: 'e2e-compose-metadata',
      owner: 'ausbitbank',
      title: 'E2E metadata post',
      body: 'Hello Hive.\n\n![First](https://images.hive.blog/one.jpg)\n\n![Second](https://images.hive.blog/two.jpg)',
      tags: ['hive', 'testing'],
      community: 'hive-174578',
      description: '',
      coverImage: '',
      aiTools: {},
      countdown: '2030-01-01T10:00:00.000Z',
      portfolio: false,
      collection: false,
      authorDisplay: '',
      crossPost: null,
      beneficiaries: [],
      rewards: {
        maxAcceptedPayout: '100000.000 HBD',
        percentHbd: 10000,
        allowVotes: true,
        allowCurationRewards: true,
        decline: false
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByLabel('Post title')).toHaveValue('E2E metadata post')

    await page.getByLabel('Post description').fill('A short preview for cards.')
    await page.getByLabel('Display author name').fill('Jane Doe')
    await page.getByText('AI usage disclosure', { exact: true }).click()
    await page.getByLabel('Researching').check()
    await page.getByLabel('Show in portfolio').check()
    await page.getByLabel('Collection of posts').check()
    await page.getByLabel('Allow rewards').uncheck()

    await page.getByRole('button', { name: 'Choose' }).click()
    await expect(page.getByRole('heading', { name: 'Choose a cover image' })).toBeVisible()
    await page.getByRole('button', { name: /Use as cover/ }).last().click()

    await page.getByRole('button', { name: 'Queue post for signing' }).click()
    await page.getByRole('button', { name: 'Queue for signing' }).click()
    await expect.poll(async () => {
      const queue = await readQueue(page)
      return queue?.items?.some(item =>
        item[1] === 'posting' &&
        item[2]?.[0] === 'comment' &&
        item[2]?.[1]?.title === 'E2E metadata post'
      )
    }).toBe(true)

    const queue = await readQueue(page)
    const item = queue.items.find(entry => entry[2]?.[1]?.title === 'E2E metadata post')
    const metadata = JSON.parse(item[2][1].json_metadata)
    expect(metadata.description).toBe('A short preview for cards.')
    expect(metadata.author).toBe('Jane Doe')
    expect(metadata.ai_tools).toEqual({ research: true })
    expect(metadata.portfolio).toBe(true)
    expect(metadata.collection).toBe(true)
    expect(metadata.tags[0]).toBe('c-c-c')
    expect(metadata.image[0]).toBe('https://images.hive.blog/two.jpg')
    expect(metadata.image).toContain('https://images.hive.blog/one.jpg')
    expect(metadata.countdown).toBe('2030-01-01T10:00:00.000Z')
    expect(item[2][1].comment_options.max_accepted_payout).toBe('0.000 HBD')
  })

  test('comment composer queues a posting comment', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/@ausbitbank/rescuing-hiveausbitdev-from-an-abandoned-vue-2-app-to-a-maintained-hive-explorer')
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Reply' }).first()).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Reply' }).first().click()
    const dialog = page.locator('.post-comment-card')
    await expect(dialog).toBeVisible()
    await dialog.locator('textarea').fill('E2E smoke comment — queued, not broadcast.')
    await dialog.getByRole('button', { name: 'Reply', exact: true }).click()
    await expect.poll(async () => {
      const queue = await readQueue(page)
      return queue?.items?.some(item => item[2]?.[0] === 'comment' && item[1] === 'posting')
    }).toBe(true)
  })

  test('proposal support queues an active vote', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/proposals/392')
    await waitForApp(page)
    const vote = page.getByRole('button', { name: /(Vote for|Remove your vote from) proposal 392/ })
    await expect(vote).toBeVisible({ timeout: 30000 })
    await vote.click()
    await expect.poll(async () => {
      const queue = await readQueue(page)
      return queue?.items?.some(item => item[2]?.[0] === 'update_proposal_votes' && item[1] === 'active')
    }).toBe(true)
  })

  test('wallet transfer dialog queues an active transfer', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/@ausbitbank/wallet')
    await waitForApp(page)
    const manage = page.getByRole('button', { name: 'Manage Liquid HIVE' })
    await expect(manage).toBeVisible({ timeout: 30000 })
    await manage.click()
    await page.getByText('Transfer HIVE', { exact: true }).click()

    const dialog = page.locator('.q-dialog').filter({ hasText: 'Transfer HIVE' }).last()
    await expect(dialog).toBeVisible()
    const to = dialog.locator('.q-select input').first()
    await to.fill('alice')
    await to.press('Enter')
    await dialog.locator('.q-field', { hasText: 'Amount' }).locator('input').fill('0.001')
    await dialog.getByRole('button', { name: 'Send', exact: true }).click()

    await expect.poll(async () => {
      const queue = await readQueue(page)
      return queue?.items?.some(item => item[2]?.[0] === 'transfer' && item[1] === 'active')
    }).toBe(true)
  })

  test('queue controls expose sent and failed items and clear completed work', async ({ page }) => {
    await loginAs(page)
    await seedQueue(page, { items: QUEUE_ITEMS, meta: QUEUE_META })
    await page.goto('/')
    await waitForApp(page)
    await page.locator('.q-header button[aria-label="Action queue"], .q-header button[aria-label*="queued action"]').first().click()

    const panel = page.locator('.queue-panel')
    await expect(panel).toContainText('Sent 1')
    await expect(panel).toContainText('Failed 1')
    await panel.getByRole('button', { name: 'Clear sent' }).click()
    await expect(panel).not.toContainText('Sent 1')
    await expect(panel).toContainText('Failed 1')
  })
})
