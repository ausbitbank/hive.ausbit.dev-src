import { test, expect } from './fixtures'
import { loginAs, readDrafts, readQueue, runAxe, seedDrafts, seedQueue, waitForApp } from './helpers'

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

  test('compose autosave toggle guards unsaved navigation', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Write a post' })).toBeVisible({ timeout: 30000 })

    const title = page.getByLabel('Post title')
    const body = page.getByLabel('Post body in Markdown')
    await title.fill('Guard draft')
    await body.fill('Saved body')
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.title === 'Guard draft' && draft.body === 'Saved body')
    }).toBe(true)

    await page.getByRole('button', { name: 'Editor settings' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Editor settings' })).toBeVisible()
    await page.getByLabel('Autosave drafts').click()
    await page.getByRole('button', { name: 'Close editor settings' }).click()

    await body.fill('Unsaved body')
    await page.locator('.site-brand').click()
    const leave = page.getByRole('dialog').filter({ hasText: 'Unsaved changes' })
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Stay' }).click()
    await expect(leave).toBeHidden()
    await expect(page).toHaveURL(/\/compose$/)
    await expect(body).toHaveValue('Unsaved body')

    await page.locator('.site-brand').click()
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Save and leave' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.title === 'Guard draft' && draft.body === 'Unsaved body')
    }).toBe(true)

    // The discard branch leaves the last saved copy untouched.
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue('Unsaved body')
    await page.getByLabel('Post body in Markdown').fill('Discarded body')
    await page.locator('.site-brand').click()
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Leave without saving' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.title === 'Guard draft' && draft.body === 'Unsaved body')
    }).toBe(true)
  })

  test('compose renames a local draft', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await seedDrafts(page, [{
      id: 'e2e-rename-draft',
      owner: 'ausbitbank',
      title: 'Old draft title',
      body: 'Rename this local draft.',
      tags: ['hive'],
      community: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByLabel('Post title')).toHaveValue('Old draft title')

    await page.getByRole('button', { name: 'Rename draft Old draft title' }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Rename draft' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Draft title').fill('New draft title')
    await dialog.getByRole('button', { name: 'Save title' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByLabel('Post title')).toHaveValue('New draft title')
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.id === 'e2e-rename-draft' && draft.title === 'New draft title')
    }).toBe(true)
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
    await expect(page.getByRole('heading', { name: 'Post queued' })).toBeVisible()
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

  test('compose cancels and retries an in-flight upload', async ({ page }) => {
    test.setTimeout(120000)
    test.skip(Boolean(process.env.OBSCURA_CDP), 'File inputs need Chromium')
    await loginAs(page)
    await page.addInitScript(() => {
      // Delay the first signature so the run can be cancelled while signing.
      let signatures = 0
      window.hive_keychain = {
        requestHandshake: callback => callback({ success: true }),
        requestSignBuffer: (account, message, key, callback) => {
          signatures += 1
          const delay = signatures === 1 ? 1500 : 0
          setTimeout(() => callback({ success: true, result: 'fakesignature' }), delay)
        }
      }
    })
    let uploads = 0
    await page.route('https://images.hive.blog/**', async route => {
      if (route.request().method() !== 'POST') {
        // Avatars and other images are not part of this upload test.
        return route.fulfill({ status: 204, body: '' })
      }
      uploads += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://images.hive.blog/fake/retried.png' })
      })
    })

    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Upload image' }).click()
    const dialog = page.locator('.compose-media-dialog')
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'slow.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    })
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click()

    await expect(dialog.locator('.compose-upload-item')).toHaveCount(1)
    await expect(dialog.getByText('Waiting for signature…')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel upload' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel upload' }).click()
    await expect(dialog.locator('.compose-upload-item').getByText('Cancelled', { exact: true })).toBeVisible()
    expect(uploads).toBe(0)

    await dialog.locator('.compose-upload-item').getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue(
      /!\[slow\]\(https:\/\/images\.hive\.blog\/fake\/retried\.png\)/
    )
    expect(uploads).toBe(1)
  })

  test('compose recent uploads show size, time and copy the URL', async ({ page }) => {
    test.setTimeout(120000)
    test.skip(Boolean(process.env.OBSCURA_CDP), 'Clipboard permissions need Chromium')
    await loginAs(page)
    const recent = {
      version: 1,
      items: [{
        url: 'https://images.hive.blog/recent-meta.jpg',
        alt: 'Recent metadata shot',
        name: 'recent-meta.jpg',
        size: 2048,
        type: 'image/png',
        uploadedAt: Date.now() - 5 * 60 * 1000
      }]
    }
    await page.addInitScript(history => {
      localStorage.setItem('composeUploads:ausbitbank', '__q_objt|' + JSON.stringify(history))
    }, recent)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Upload image' }).click()
    const dialog = page.locator('.compose-media-dialog')
    const row = dialog.locator('.compose-upload-recent__item')
    await expect(row).toContainText('recent-meta.jpg')
    await expect(row).toContainText('2.0 KB')
    await expect(row).toContainText('5 min ago')
    const thumbWidth = await row.locator('img').evaluate(element => element.getBoundingClientRect().width)
    expect(thumbWidth).toBeLessThanOrEqual(60)

    await row.getByRole('button', { name: /Copy URL/ }).click()
    await expect(page.getByText('Image URL copied')).toBeVisible()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe('https://images.hive.blog/recent-meta.jpg')
  })

  test('compose upload dialog is axe clean and overflow-free at both widths', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    const recent = {
      version: 1,
      items: [{
        url: 'https://images.hive.blog/recent-axe.jpg',
        alt: 'A recent upload',
        name: 'recent-axe.jpg',
        size: 4096,
        type: 'image/jpeg',
        uploadedAt: Date.now() - 10 * 60 * 1000
      }]
    }
    await page.addInitScript(history => {
      localStorage.setItem('composeUploads:ausbitbank', '__q_objt|' + JSON.stringify(history))
    }, recent)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Upload image' }).click()
    const dialog = page.locator('.compose-media-dialog')
    await expect(dialog.getByRole('heading', { name: 'Upload images' })).toBeVisible()
    await expect(dialog.locator('.compose-upload-recent__item')).toHaveCount(1)

    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(500)
      const layout = await page.evaluate(() => {
        const box = document.querySelector('.compose-media-dialog').getBoundingClientRect()
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          dialogLeft: box.left,
          dialogRight: box.right,
          viewport: document.documentElement.clientWidth
        }
      })
      expect(layout.overflow, viewport.width + 'px overflow').toBe(0)
      expect(layout.dialogLeft).toBeGreaterThanOrEqual(0)
      expect(layout.dialogRight).toBeLessThanOrEqual(layout.viewport)
      const violations = await runAxe(page)
      expect(violations, viewport.width + 'px axe').toEqual([])
    }
  })

  test('compose inserts an emoji and jumps to headings from the outline', async ({ page }) => {
    await loginAs(page)
    const body = '# Intro\n\nSome text\n\n## Details\n\nMore'
    await seedDrafts(page, [{
      id: 'e2e-outline-emoji',
      owner: 'ausbitbank',
      title: 'Outline and emoji',
      body,
      tags: ['testing'],
      community: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByLabel('Post title')).toHaveValue('Outline and emoji')

    const editor = page.getByLabel('Post body in Markdown')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.getByRole('button', { name: 'Insert emoji' }).click()
    await expect(page.getByRole('heading', { name: 'Insert emoji' })).toBeVisible()
    await page.getByRole('button', { name: 'Insert rocket' }).click()
    await expect(editor).toHaveValue(/🚀$/)

    await page.getByRole('button', { name: 'Heading outline' }).click()
    await expect(page.getByRole('heading', { name: 'Heading outline' })).toBeVisible()
    await page.getByRole('button', { name: /Details/ }).click()
    await expect(page.getByRole('heading', { name: 'Heading outline' })).toHaveCount(0)
    expect(await editor.evaluate(element => element.selectionStart)).toBe(body.indexOf('## Details'))
  })

  test('compose inserts a media embed and shows the split preview', async ({ page }) => {    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByLabel('Post body in Markdown').fill('A video from Hive:')
    await page.getByRole('button', { name: 'Insert media embed' }).click()
    await expect(page.getByRole('heading', { name: 'Insert media' })).toBeVisible()
    await page.getByLabel('Media URL').fill('https://youtu.be/dQw4w9WgXcQ')
    await expect(page.getByText('YouTube', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Insert media', exact: true }).click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue(/https:\/\/youtu\.be\/dQw4w9WgXcQ/)

    await page.getByRole('button', { name: 'Split' }).click()
    const preview = page.locator('.compose-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('A video from Hive:')
    await expect(preview.locator('.markdown-video-link').first()).toBeVisible()

    await page.getByRole('button', { name: 'Editor settings' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Editor settings' })).toBeVisible()
    await page.getByLabel('Auto-update preview').click()
    await page.getByLabel('Preview embeds').click()
    await page.getByRole('button', { name: 'Close editor settings' }).click()
    await expect(page.getByText('Preview updates when you refresh.')).toBeVisible()
    await expect(preview.getByText('Watch video')).toBeVisible()
  })

  test('compose table dialog and HTML source mode', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Insert table' }).click()
    await expect(page.getByRole('heading', { name: 'Insert table' })).toBeVisible()
    await page.getByLabel('Table columns').fill('2')
    await page.getByLabel('Table rows').fill('3')
    await page.locator('.md-toolbar__dialog').getByRole('button', { name: 'Insert table' }).click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue(/\| Column 1 \| Column 2 \|/)

    await page.getByRole('button', { name: 'Editor settings' }).dispatchEvent('click')
    await page.getByRole('button', { name: 'HTML source' }).click()
    await page.getByRole('button', { name: 'Close editor settings' }).click()
    await expect(page.getByLabel('Post body in HTML')).toBeVisible()
    await expect(page.getByLabel('Post body in Markdown')).toHaveCount(0)
  })

  test('compose saves and inserts a snippet', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByLabel('Post body in Markdown').fill('Intro')
    await page.getByRole('button', { name: 'Insert snippet' }).click()
    await expect(page.getByRole('heading', { name: 'Snippets' })).toBeVisible()
    await page.getByLabel('Snippet name').fill('Signature')
    await page.getByLabel('Snippet text').fill('Thanks for reading.')
    await page.getByRole('button', { name: 'Save snippet' }).click()
    await expect(page.getByText('Signature', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Insert', exact: true }).click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue(/Thanks for reading\./)
  })

  test('compose saves a draft as a template and applies it', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByLabel('Post title').fill('Template source')
    await page.getByLabel('Post body in Markdown').fill('Template body')
    await page.getByRole('button', { name: 'Post templates' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Post templates' })).toBeVisible()
    await page.getByLabel('Template name').fill('My saved template')
    await page.getByRole('button', { name: 'Save current draft' }).click()
    await expect(page.getByText('My saved template')).toBeVisible()

    await page.getByRole('button', { name: 'Close templates' }).click()
    await page.getByLabel('Post body in Markdown').fill('Changed body')
    await page.getByRole('button', { name: 'Post templates' }).dispatchEvent('click')
    await page.locator('.compose-template').filter({ hasText: 'My saved template' })
      .getByRole('button', { name: 'Apply' }).dispatchEvent('click')
    await page.getByRole('button', { name: 'Apply template' }).click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue('Template body')
  })

  test('compose draft search, pinning and duplication work', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await seedDrafts(page, [
      {
        id: 'e2e-search-first',
        owner: 'ausbitbank',
        title: 'First draft',
        body: 'First body',
        tags: ['hive'],
        community: '',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000
      },
      {
        id: 'e2e-search-second',
        owner: 'ausbitbank',
        title: 'Second draft',
        body: 'Second body',
        tags: ['hive'],
        community: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.locator('.compose-draft__title')).toHaveCount(2)

    await page.getByLabel('Search drafts').fill('Second')
    await expect(page.locator('.compose-draft__title')).toHaveCount(1)
    await expect(page.locator('.compose-draft__title')).toHaveText('Second draft')
    await page.getByLabel('Search drafts').fill('')
    await expect(page.locator('.compose-draft__title')).toHaveCount(2)

    await page.locator('.compose-draft').first().getByRole('button', { name: /Pin draft/ }).dispatchEvent('click')
    const pinned = await page.evaluate(() => {
      const raw = localStorage.getItem('composePinned:ausbitbank')
      if (!raw) return null
      return JSON.parse(raw.replace(/^__q_objt\|/, ''))
    })
    expect(pinned?.ids?.length).toBe(1)

    await page.locator('.compose-draft').first().getByRole('button', { name: /Duplicate draft/ }).dispatchEvent('click')
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.title.endsWith(' (copy)'))
    }).toBe(true)
  })

  test('compose imports snippets from a JSON file', async ({ page }) => {
    test.setTimeout(120000)
    test.skip(Boolean(process.env.OBSCURA_CDP), 'File inputs need Chromium')
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Insert snippet' }).dispatchEvent('click')
    await page.locator('input[aria-label="Import snippets JSON file"]').setInputFiles({
      name: 'snippets.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        type: 'hive-snippets',
        version: 1,
        snippets: [{ name: 'Imported signature', body: 'Thanks for reading.' }]
      }))
    })
    await expect(page.getByText('Imported signature', { exact: true })).toBeVisible()
  })

  test('compose restores a draft history version', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByLabel('Post title').fill('Version test')
    await page.getByLabel('Post body in Markdown').fill('Version one')
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.body === 'Version one')
    }).toBe(true)

    await page.getByLabel('Post body in Markdown').fill('Version two')
    await expect.poll(async () => {
      const stored = await readDrafts(page)
      return stored?.drafts?.some(draft => draft.body === 'Version two')
    }).toBe(true)

    await page.getByRole('button', { name: 'Draft history' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Draft history' })).toBeVisible()
    const item = page.locator('.compose-history__item').filter({ hasText: 'Version one' })
    await expect(item).toBeVisible()
    await item.getByRole('button', { name: 'Restore' }).click()
    await page.getByRole('button', { name: 'Restore version' }).click()
    await expect(page.getByLabel('Post body in Markdown')).toHaveValue('Version one')
  })

  test('compose archives, restores and clears drafts, and shows reminders', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    const dueAt = new Date(Date.now() - 60000).toISOString()
    await seedDrafts(page, [{
      id: 'e2e-archive-draft',
      owner: 'ausbitbank',
      title: 'Archive me',
      body: 'Archived body',
      tags: ['hive'],
      community: '',
      scheduledAt: dueAt,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByText('Draft reminder')).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect(page.getByText('Draft reminder')).toHaveCount(0)

    await page.getByRole('button', { name: 'Archive draft Archive me' }).dispatchEvent('click')
    await expect(page.locator('.compose-draft__title')).toHaveCount(0)
    await page.getByRole('button', { name: 'Archived' }).click()
    await expect(page.locator('.compose-draft__title')).toHaveText('Archive me')
    await page.getByRole('button', { name: 'Restore draft Archive me' }).dispatchEvent('click')
    await page.getByRole('button', { name: 'Active' }).click()
    await expect(page.locator('.compose-draft__title')).toHaveText('Archive me')

    await page.getByRole('button', { name: 'Clear all', exact: true }).click()
    await page.getByRole('button', { name: 'Clear all drafts' }).click()
    await expect(page.locator('.compose-draft__title')).toHaveCount(0)
    await expect(page.getByText('No saved drafts yet. Autosave starts when you write.')).toBeVisible()
  })

  test('compose sets and clears a local publish reminder', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Schedule reminder' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Schedule reminder' })).toBeVisible()
    await page.getByLabel('Reminder date and time', { exact: true }).fill('2030-01-01T12:00')
    await page.getByRole('button', { name: 'Save reminder' }).click()
    await expect(page.getByRole('button', { name: 'Reminder set' })).toBeVisible()

    await page.getByRole('button', { name: 'Reminder set' }).dispatchEvent('click')
    await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear reminder' }).click()
    await expect(page.getByRole('button', { name: 'Schedule reminder' })).toBeVisible()
  })

  test('compose beneficiary presets and topic reordering work', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await seedDrafts(page, [{
      id: 'e2e-preset-draft',
      owner: 'ausbitbank',
      title: 'Preset draft',
      body: 'Body',
      tags: ['alpha', 'beta', 'gamma'],
      community: '',
      beneficiaries: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByText('No beneficiaries. You receive 100% of post rewards.')).toBeVisible()
    await page.getByRole('button', { name: 'Use defaults' }).click()
    await expect(page.getByLabel('Beneficiary account 1')).toHaveValue('ausbitbank')
    await page.getByRole('button', { name: 'Remove all' }).click()
    await expect(page.getByText('No beneficiaries. You receive 100% of post rewards.')).toBeVisible()

    await page.getByRole('button', { name: 'Order topics' }).click()
    await expect(page.getByRole('heading', { name: 'Topic order' })).toBeVisible()
    await expect(page.locator('.compose-topics-order__tag').first()).toHaveText('#alpha')
    await page.getByRole('button', { name: 'Move alpha down' }).click()
    await expect(page.locator('.compose-topics-order__tag').first()).toHaveText('#beta')
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
    await expect(page.getByRole('heading', { name: 'Queue this post?' })).toBeVisible()
    await page.getByText('Raw json_metadata', { exact: true }).click()
    await expect(page.locator('.compose-review__json')).toContainText('"description": "A short preview for cards."')
    await page.getByRole('button', { name: 'Queue for signing' }).click()
    await expect(page.getByRole('heading', { name: 'Post queued' })).toBeVisible()
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

  test('compose missing-cover warning can be hidden and restored locally', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    const coverItem = page.locator('.compose-checklist__item').filter({ hasText: 'Images and cover' })
    await expect(coverItem).toContainText('No images found')
    await coverItem.getByRole('button', { name: /Hide the Images and cover warning/ }).click()
    await expect(coverItem).toHaveCount(0)
    await expect.poll(async () => {
      const stored = await page.evaluate(() => localStorage.getItem('composeDismissedWarnings:ausbitbank'))
      return stored ? JSON.parse(stored.replace(/^__q_objt\|/, '')).warnings : []
    }).toEqual(['cover-missing'])
    await expect(page.getByRole('button', { name: 'Restore warnings' })).toBeVisible()

    await page.reload()
    await waitForApp(page)
    await expect(page.getByText('No images found')).toHaveCount(0)
    await page.getByRole('button', { name: 'Restore warnings' }).click()
    await expect(page.getByText('No images found')).toBeVisible()
  })

  test('compose probes broken images and warns about a portrait cover', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.route('https://images.hive.blog/**', route => {
      if (route.request().url().endsWith('portrait.svg')) {
        return route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="300"><rect width="100" height="300" fill="#444"/></svg>'
        })
      }
      return route.fulfill({ status: 404, body: 'not found' })
    })
    await seedDrafts(page, [{
      id: 'e2e-image-health',
      owner: 'ausbitbank',
      title: 'Image health draft',
      body: '![Portrait](https://images.hive.blog/portrait.svg)\n\n![Broken](https://images.hive.blog/broken.png)',
      tags: ['testing'],
      community: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    await expect(page.getByLabel('Post title')).toHaveValue('Image health draft')

    const brokenItem = page.locator('.compose-checklist__item').filter({ hasText: 'Image links' })
    await expect(brokenItem).toContainText('1 image could not be loaded', { timeout: 20000 })
    const coverItem = page.locator('.compose-checklist__item').filter({ hasText: 'Cover image quality' })
    await expect(coverItem).toContainText('portrait', { timeout: 20000 })
    await expect(coverItem).toContainText('100×300')
    await expect(coverItem.getByRole('button', { name: /Hide the Cover image quality warning/ })).toBeVisible()
  })

  test('compose community picker searches, links rules and warns outside subscriptions', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/compose')
    await waitForApp(page)
    const select = page.getByLabel('Community or category')
    await select.click()

    await select.fill('Hive Governance')
    const governance = page.locator('.q-menu .q-item').filter({ hasText: 'Hive Governance' })
    await expect(governance).toBeVisible()
    await expect(governance).toContainText('#hive-111111')
    await select.fill('hive-111111')
    await expect(governance).toBeVisible()
    await governance.click()

    const card = page.locator('.compose-community-card')
    await expect(card).toContainText('Hive Governance')
    await expect(card).toContainText('#hive-111111')
    await expect(card).toContainText('Subscribed')
    await expect(card).toContainText(/[\d,]+ subscribers/)
    const rules = card.getByRole('link', { name: 'Rules' })
    await expect(rules).toHaveAttribute('href', '/c/hive-111111?tab=about')
    await expect(page.locator('.compose-warning').filter({ hasText: 'not one of your subscribed communities' })).toHaveCount(0)
    const avatar = card.locator('.compose-community-card__avatar')
    await expect(avatar).toHaveAttribute('src', 'https://images.hive.blog/u/hive-111111/avatar/small')

    await select.click()
    await select.fill('hive-999999')
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { level: 1, name: 'Write a post' }).click()
    // Quasar's menu content is a scrollable region without its own tab stop, so
    // axe can only be run once the transient popup has closed.
    await expect(page.locator('.q-menu')).toBeHidden()
    await expect(card).toContainText('#hive-999999')
    const warning = page.locator('.compose-warning').filter({ hasText: 'not one of your subscribed communities' })
    await expect(warning).toBeVisible()
    await expect(warning.getByRole('link', { name: 'Read the rules' }))
      .toHaveAttribute('href', '/c/hive-999999?tab=about')

    for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      expect(overflow, viewport.width + 'px overflow').toBe(0)
      expect(await runAxe(page), viewport.width + 'px axe').toEqual([])
    }
  })

  test('community rules links open the about tab', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/c/hive-174578?tab=about')
    await waitForApp(page)
    await expect(page.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Rules', { exact: true }).first()).toBeVisible({ timeout: 30000 })
  })

  test('compose warns when a tag names another community', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await seedDrafts(page, [{
      id: 'e2e-tag-mismatch',
      owner: 'ausbitbank',
      title: 'Tag mismatch draft',
      body: 'Posting in one community with another community tag.',
      tags: ['writing', 'hive-123456'],
      community: 'hive-174578',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }])
    await page.goto('/compose')
    await waitForApp(page)
    const mismatch = page.locator('.compose-checklist__item').filter({ hasText: 'This post goes to #hive-174578' })
    await expect(mismatch).toContainText('#hive-174578')
    await expect(mismatch).toContainText('#hive-123456')
  })

  test('cover warnings stay out of shorts and comment composers', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto('/shorts')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Short posts' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Images and cover')).toHaveCount(0)
    await expect(page.getByText("Don't warn again")).toHaveCount(0)

    await page.goto('/@ausbitbank/rescuing-hiveausbitdev-from-an-abandoned-vue-2-app-to-a-maintained-hive-explorer')
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Reply' }).first()).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Reply' }).first().click()
    await expect(page.locator('.post-comment-card')).toBeVisible()
    await expect(page.getByText('Images and cover')).toHaveCount(0)
    await expect(page.getByText("Don't warn again")).toHaveCount(0)
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
