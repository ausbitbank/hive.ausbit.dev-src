import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

const GUEST_KEY = 'hive:dashboard:v1:default'
const ACCOUNT_KEY = 'hive:dashboard:v1:ausbitbank'
const SETUP_KEY = 'hive:dashboard:v1:setupPromptDismissed:ausbitbank'

async function readDashboard (page, key) {
  return page.evaluate(name => {
    const raw = localStorage.getItem(name)
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  }, key)
}

async function openEditor (page) {
  // The button is replaced by the editor bar as soon as the handler runs.
  // Obscura's actionability loop can see that replacement as a detached node
  // and retry a button that no longer exists, so dispatch the click directly.
  await page.getByRole('button', { name: 'Customise', exact: true }).dispatchEvent('click')
  await expect(page.getByRole('region', { name: 'Dashboard editing' })).toBeVisible()
}

async function addWidget (page, label) {
  await page.getByRole('button', { name: 'Add widget' }).click()
  await page.getByRole('button', { name: 'Add ' + label }).click()
  await page.getByRole('button', { name: 'Done' }).click()
}

test.describe('customisable dashboard', () => {  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await waitForApp(page)
  })

  test('starts on the built-in layout with the Customise button', async ({ page }) => {
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Customise', exact: true })).toBeVisible()

    const types = await page
      .locator('.dw-grid--packed [data-widget-type]')
      .evaluateAll(nodes => nodes.map(node => node.dataset.widgetType))
    expect(types).toEqual(['block', 'market', 'witnesses', 'posts', 'posts', 'posts'])
  })

  test('adds a widget, saves it and keeps it after a reload', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'My wallet')
    await expect(page.getByText('1 widget added')).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Customise', exact: true })).toBeVisible()

    const stored = await readDashboard(page, GUEST_KEY)
    expect(stored.customised).toBe(true)
    expect(stored.widgets.map(widget => widget.type)).toContain('wallet')

    await page.reload()
    await waitForApp(page)
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    await expect(page.locator('[data-widget-type="wallet"]')).toBeVisible()
  })

  test('cancelling leaves the saved layout untouched', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Network stats')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    expect(await readDashboard(page, GUEST_KEY)).toBeNull()
  })

  test('reset returns to the built-in layout', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Network stats')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()

    await openEditor(page)
    await page.getByRole('button', { name: 'Reset to default' }).click()

    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    const stored = await readDashboard(page, GUEST_KEY)
    expect(stored.customised).toBe(false)
    expect(stored.widgets.map(widget => widget.type)).not.toContain('network')
  })

  test('keyboard reordering marks the draft as changed', async ({ page }) => {
    await openEditor(page)
    const handle = page.locator('.dw-widget__drag-handle').first()
    await handle.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(page.getByText('order changed')).toBeVisible()
  })

  test('the footer +/- controls resize the card in place', async ({ page }) => {
    await openEditor(page)
    const block = page.locator('[data-widget-type="block"]')
    const label = block.locator('.dw-widget__width-label')
    await expect(label).toHaveText('Third')

    await block.getByRole('button', { name: 'Make Live block wider' }).click()
    await expect(label).toHaveText('Half')
    await expect(page.getByText('1 width change')).toBeVisible()

    await block.getByRole('button', { name: 'Make Live block narrower' }).click()
    await expect(label).toHaveText('Third')
    await expect(page.getByText('width change')).toHaveCount(0)
  })

  test('drag reordering marks the draft as changed', async ({ page }) => {
    await openEditor(page)
    await page.evaluate(() => {
      const handle = document.querySelector('.dw-widget__drag-handle')
      const target = document.querySelectorAll('[data-widget-id]')[1]
        .querySelector('.dw-widget')
      const from = handle.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      const startX = from.left + 8
      const startY = from.top + from.height / 2
      const endX = to.right - 12
      const endY = to.top + to.height / 2
      const fire = (node, type, x, y) => node.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: x,
        clientY: y
      }))
      fire(handle, 'pointerdown', startX, startY)
      fire(window, 'pointermove', startX + 24, startY + 24)
      fire(window, 'pointermove', endX, endY)
      fire(window, 'pointerup', endX, endY)
    })
    await expect(page.getByText('order changed')).toBeVisible()
  })

  test('configures a widget through the settings dialog', async ({ page }) => {
    await openEditor(page)
    const trending = page.locator('[data-widget-type="posts"]').first()
    await trending.getByRole('button', { name: /^Options for Content browser/ }).click()
    await page.getByText('Configure', { exact: true }).click()

    const dialog = page.locator('.dw-settings')
    await expect(dialog.locator('.dw-settings__title')).toHaveText('Content browser')
    await dialog.getByLabel('Network feed').click()
    await page.getByRole('option', { name: 'New' }).click()
    await dialog.locator('input[type="number"]').fill('9')
    await page.getByRole('button', { name: 'Apply' }).click()

    await page.getByRole('button', { name: 'Save' }).click()
    const stored = await readDashboard(page, GUEST_KEY)
    const posts = stored.widgets.find(widget => widget.type === 'posts')
    expect(posts.settings.source).toBe('created')
    expect(posts.settings.limit).toBe(9)
  })

  test('an account feed reference relabels the posts widget and persists', async ({ page }) => {
    await openEditor(page)
    const posts = page.locator('[data-widget-type="posts"]').first()
    await posts.getByRole('button', { name: /^Options for Content browser/ }).click()
    await page.getByText('Configure', { exact: true }).click()

    const dialog = page.locator('.dw-settings')
    await dialog.getByLabel('Feed reference').fill('/@ausbitbank/feed')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(posts.locator('.home-eyebrow')).toHaveText('Feed')
    await expect(posts.locator('.home-panel__title')).toHaveText('@ausbitbank')

    await page.getByRole('button', { name: 'Save' }).click()
    const card = page.locator('[data-widget-type="posts"]').first()
    await expect(card.locator('.home-panel__title')).toHaveText('@ausbitbank')
    await expect(card.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/@ausbitbank/feed')

    const stored = await readDashboard(page, GUEST_KEY)
    const settings = stored.widgets.find(widget => widget.type === 'posts').settings
    expect(settings.reference).toBe('/@ausbitbank/feed')
  })

  test('community and short-form references change the posts header', async ({ page }) => {
    await openEditor(page)
    const posts = page.locator('[data-widget-type="posts"]').first()

    const configure = async reference => {
      await posts.getByRole('button', { name: /^Options for Content browser/ }).click()
      await page.getByText('Configure', { exact: true }).click()
      const dialog = page.locator('.dw-settings')
      await dialog.getByLabel('Feed reference').fill(reference)
      await page.getByRole('button', { name: 'Apply' }).click()
    }

    await configure('/c/hive-174578')
    await expect(posts.locator('.home-eyebrow')).toHaveText('Community · Trending')
    // The live community record replaces the #hive-xxxxx chain name.
    await expect(posts.locator('.home-panel__title')).not.toHaveText('#hive-174578')
    await expect(posts.locator('.home-panel__title')).toHaveText(/\S+/)
    await expect(posts.locator('.home-panel__avatar img')).toHaveAttribute('src', /hive-174578/)

    await configure('/shorts/threads')
    await expect(posts.locator('.home-eyebrow')).toHaveText('Short posts · InLeo')
    await expect(posts.locator('.home-panel__title')).toHaveText('Threads')
  })

  test('the tiling toggle lives in the editor and previews masonry before save', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Masonry', exact: true })).toHaveCount(0)

    await openEditor(page)
    await expect(page.getByRole('button', { name: 'Masonry', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Masonry', exact: true }).click()
    await expect(page.locator('.home-editing.dw-grid--masonry')).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.dw-grid--packed.dw-grid--masonry')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Masonry', exact: true })).toHaveCount(0)

    const stored = await readDashboard(page, GUEST_KEY)
    expect(stored.tiling).toBe('masonry')

    await page.reload()
    await waitForApp(page)
    await expect(page.locator('.dw-grid--packed.dw-grid--masonry')).toBeVisible()
  })

  test('auto-optimize rearranges the draft without saving immediately', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Auto-optimize' }).click()
    // Obscura can report Quasar notifications as hidden while they are in the
    // DOM; presence is the meaningful assertion in both harnesses.
    await expect(page.getByText('Layout optimized — review it, then press Save')).toHaveCount(1)
    expect(await readDashboard(page, GUEST_KEY)).toBeNull()
  })

  test('saves, loads and deletes named layouts', async ({ page }) => {
    const bar = page.getByRole('region', { name: 'Dashboard editing' })
    const snapshot = async label => {
      await page.getByRole('button', { name: /Layouts/ }).click()
      await page.getByText('Save current as…').click()
      const dialog = page.locator('.dw-share').filter({ hasText: 'Save this layout' })
      await dialog.getByLabel('Layout name').fill(label)
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog).toBeHidden()
    }

    await openEditor(page)
    await snapshot('Morning')
    await bar.getByRole('button', { name: 'Save', exact: true }).click()
    let stored = await readDashboard(page, GUEST_KEY)
    expect(stored.layouts).toHaveLength(1)
    expect(stored.layouts[0].label).toBe('Morning')
    const morningId = stored.layouts[0].id
    expect(stored.activeLayoutId).toBe(morningId)

    // A second snapshot with an extra widget, so loading the first one is a
    // real change to the dashboard rather than a no-op.
    await openEditor(page)
    await addWidget(page, 'Network stats')
    await snapshot('Evening')
    await bar.getByRole('button', { name: 'Save', exact: true }).click()
    stored = await readDashboard(page, GUEST_KEY)
    expect(stored.layouts.map(entry => entry.label)).toEqual(['Morning', 'Evening'])
    expect(stored.widgets.map(widget => widget.type)).toContain('network')
    expect(stored.activeLayoutId).toBe(stored.layouts[1].id)

    // Load Morning back into the draft and save it.
    await openEditor(page)
    await page.getByRole('button', { name: /Layouts/ }).click()
    await page.getByRole('button', { name: 'Load Morning', exact: true }).click()
    await expect(page.getByText('Loaded "Morning" — press Save to apply')).toHaveCount(1)
    await bar.getByRole('button', { name: 'Save', exact: true }).click()

    stored = await readDashboard(page, GUEST_KEY)
    expect(stored.widgets.map(widget => widget.type)).not.toContain('network')
    expect(stored.activeLayoutId).toBe(morningId)

    // Rename, then delete the active snapshot. The dashboard itself stays put.
    await openEditor(page)
    await page.getByRole('button', { name: /Layouts/ }).click()
    await page.getByRole('button', { name: 'Rename Morning', exact: true }).click()
    const renameDialog = page.locator('.dw-share').filter({ hasText: 'Rename layout' })
    await renameDialog.getByLabel('New layout name').fill('Compact')
    await renameDialog.getByRole('button', { name: 'Rename', exact: true }).click()
    await expect(renameDialog).toBeHidden()
    stored = await readDashboard(page, GUEST_KEY)
    expect(stored.layouts.map(entry => entry.label)).toEqual(['Compact', 'Evening'])

    await page.getByRole('button', { name: /Layouts/ }).click()
    await page.getByRole('button', { name: 'Delete Compact', exact: true }).click()
    const deleteDialog = page.locator('.dw-share').filter({ hasText: 'Delete layout?' })
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()
    stored = await readDashboard(page, GUEST_KEY)
    expect(stored.layouts.map(entry => entry.label)).toEqual(['Evening'])
    expect(stored.activeLayoutId).toBe('')
  })

  test('account posts accept a feed type and reference', async ({ page }) => {
    await openEditor(page)
    const card = page.locator('[data-widget-type="posts"]').nth(1)
    await card.getByRole('button', { name: /^Options for Content browser/ }).click()
    await page.getByText('Configure', { exact: true }).click()

    const dialog = page.locator('.dw-settings')
    await dialog.getByLabel('Account feed type').click()
    await page.getByRole('option', { name: 'Feed', exact: true }).click()
    await dialog.getByLabel('Feed reference').fill('/@ausbitbank/feed')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(card.locator('.home-eyebrow')).toHaveText('Feed')
    await expect(card.locator('.home-panel__title')).toHaveText('@ausbitbank')

    await page.getByRole('button', { name: 'Save' }).click()
    const stored = await readDashboard(page, GUEST_KEY)
    const settings = stored.widgets.filter(widget => widget.type === 'posts')[1].settings
    expect(settings.feedSort).toBe('feed')
    expect(settings.reference).toBe('/@ausbitbank/feed')
  })

  test('notifications widget names the account in its header', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    await openEditor(page)
    await addWidget(page, 'Notifications')

    const card = page.locator('[data-widget-type="notifications"]')
    await expect(card.locator('.home-eyebrow')).toHaveText('Notifications')
    await expect(card.locator('.home-panel__title')).toHaveText('@ausbitbank')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(card.locator('.home-panel__title')).toHaveText('@ausbitbank')
  })

  test('offers the starter layout once to a signed-in account', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeVisible()

    await page.getByRole('button', { name: 'Use my starter layout' }).dispatchEvent('click')
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    await expect(page.locator('[data-widget-type="wallet"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeHidden()

    const stored = await readDashboard(page, ACCOUNT_KEY)
    expect(stored.customised).toBe(true)
    expect(await page.evaluate(key => localStorage.getItem(key), SETUP_KEY)).toBeTruthy()

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeHidden()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
  })

  test('dismissing the setup prompt keeps it dismissed', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeVisible()

    await page.getByRole('button', { name: 'Not now' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeHidden()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), SETUP_KEY)).toBeTruthy()

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeHidden()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()
  })

  test('loads a persona template into the draft and saves it', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Layouts' }).click()
    const menu = page.locator('.q-menu')
    await expect(menu.getByText('Templates', { exact: true })).toBeVisible()
    await menu.getByText('Creator', { exact: true }).click()

    await expect(page.getByText(/Loaded "Creator"/)).toBeVisible()
    await expect(page.locator('.home-editing.dw-grid--masonry')).toBeVisible()
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()

    const stored = await readDashboard(page, GUEST_KEY)
    expect(stored.widgets.map(widget => widget.type)).toEqual([
      'vitals',
      'creatorStats',
      'walletActions',
      'posts',
      'notifications',
      'network',
      'hbd',
      'portfolioTrend',
      'draftsQueue',
      'followerGrowth'
    ])
  })

  test('offers the new account, creator, governance and HBD widgets in the drawer', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Add widget' }).click()
    for (const label of ['Account vitals', 'Wallet actions', 'Creator stats', 'Governance watch', 'HBD peg & yield', 'Community pulse']) {
      await expect(page.getByRole('button', { name: 'Add ' + label })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Done' }).click()
  })

  test('renders the public phase-1 widgets after save', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'HBD peg & yield')
    await addWidget(page, 'Governance watch')
    await addWidget(page, 'Community pulse')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.locator('[data-widget-type="hbd"]')).toBeVisible()
    await expect(page.locator('[data-widget-type="governance"]')).toBeVisible()
    await expect(page.locator('[data-widget-type="communityPulse"]')).toBeVisible()
    await expect(page.locator('[data-widget-type="hbd"]')).toContainText('HBD peg & yield')
    await expect(page.locator('[data-widget-type="governance"]')).toContainText('Governance watch')
  })

  test('shows the guest state for account-only widgets', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Account vitals')
    await addWidget(page, 'Wallet actions')
    await addWidget(page, 'Creator stats')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.locator('[data-widget-type="vitals"]')).toContainText('Account vitals needs an account')
    await expect(page.locator('[data-widget-type="walletActions"]')).toContainText('Wallet actions needs an account')
    await expect(page.locator('[data-widget-type="creatorStats"]')).toContainText('Creator stats needs an account')
  })

  test('renders signed-in account widgets with live data', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    const notNow = page.getByRole('button', { name: 'Not now' })
    if (await notNow.isVisible().catch(() => false)) await notNow.click()

    await openEditor(page)
    await addWidget(page, 'Account vitals')
    await addWidget(page, 'Wallet actions')
    await addWidget(page, 'Creator stats')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const vitals = page.locator('[data-widget-type="vitals"]')
    await vitals.scrollIntoViewIfNeeded()
    await expect(vitals).toContainText('Voting power')
    await expect(vitals).not.toContainText('needs an account')

    const actions = page.locator('[data-widget-type="walletActions"]')
    await actions.scrollIntoViewIfNeeded()
    // Live account state changes: the card is either listing pending actions
    // or explicitly saying it is all clear. Both prove it loaded real data.
    await expect(actions).toContainText(/Power down|All clear/)
    await expect(actions).not.toContainText('needs an account')

    const creator = page.locator('[data-widget-type="creatorStats"]')
    await creator.scrollIntoViewIfNeeded()
    await expect(creator).toContainText('Creator')
    await expect(creator).toContainText('Author rewards')
    await expect(creator).not.toContainText('Could not load recent posts')
    await expect(creator).not.toContainText('needs an account')
  })

  test('renders the phase-2 discovery and infrastructure widgets', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Add widget' }).click()
    for (const label of ['Trending tags', 'Drafts & queue', 'Community spotlight', 'Node health', 'Hive-Engine watchlist', 'Witness round']) {
      await page.getByRole('button', { name: 'Add ' + label }).click()
    }
    await page.getByRole('button', { name: 'Done' }).click()
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const checks = [
      ['trendingTags', 'Trending tags'],
      ['draftsQueue', 'Drafts & queue'],
      ['communitySpotlight', 'Community spotlight'],
      ['nodeHealth', 'Node health'],
      ['hiveEngine', 'L2 watchlist'],
      ['witnessRound', 'Witness round']
    ]
    for (const [type, text] of checks) {
      const card = page.locator('[data-widget-type="' + type + '"]')
      await card.scrollIntoViewIfNeeded()
      await expect(card).toContainText(text)
    }
  })

  test('renders the signed-in delegation snapshot', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    const notNow = page.getByRole('button', { name: 'Not now' })
    if (await notNow.isVisible().catch(() => false)) await notNow.click()

    await openEditor(page)
    await addWidget(page, 'Delegations')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const card = page.locator('[data-widget-type="delegations"]')
    await card.scrollIntoViewIfNeeded()
    await expect(card).toContainText('Delegated out')
    await expect(card).not.toContainText('needs an account')
  })

  test('offers the phase-3 widgets in the drawer', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Add widget' }).click()
    for (const label of [
      'Magi network',
      'Account watchlist',
      'Price alert',
      'Follower growth',
      'Portfolio trend',
      'Community growth',
      'Lightning balance',
      'Accountability view',
      'Account safety',
      'Hive news digest'
    ]) {
      await expect(page.getByRole('button', { name: 'Add ' + label })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Done' }).click()
  })

  test('renders the public phase-3 widgets after save', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Magi network')
    await addWidget(page, 'Account watchlist')
    await addWidget(page, 'Price alert')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const magi = page.locator('[data-widget-type="magiNetwork"]')
    await magi.scrollIntoViewIfNeeded()
    await expect(magi).toContainText('Magi network')

    const watch = page.locator('[data-widget-type="accountWatchlist"]')
    await watch.scrollIntoViewIfNeeded()
    await expect(watch).toContainText('Add accounts in widget settings')

    const alert = page.locator('[data-widget-type="priceAlert"]')
    await alert.scrollIntoViewIfNeeded()
    await expect(alert).toContainText('Price alert')
    await expect(alert).toContainText('No target set')
  })

  test('shows an honest guest state for the phase-3 action and context widgets', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Portfolio trend')
    await addWidget(page, 'Accountability view')
    await addWidget(page, 'Account safety')
    await addWidget(page, 'Lightning balance')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const guests = [
      ['portfolioTrend', 'Portfolio trend'],
      ['keRatio', 'Accountability view'],
      ['accountSafety', 'Account safety'],
      ['keepsats', 'Lightning balance']
    ]
    for (const [type, label] of guests) {
      const card = page.locator('[data-widget-type="' + type + '"]')
      await card.scrollIntoViewIfNeeded()
      await expect(card).toContainText(label + ' needs an account')
    }
  })

  test('renders the public phase-3 discovery widgets after save', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Hive news digest')
    await addWidget(page, 'Community growth')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const news = page.locator('[data-widget-type="newsDigest"]')
    await news.scrollIntoViewIfNeeded()
    await expect(news).toContainText('Hive news')

    const growth = page.locator('[data-widget-type="communityGrowth"]')
    await growth.scrollIntoViewIfNeeded()
    await expect(growth).toContainText('Choose a community in widget settings')
  })

  test('persists the wallet-actions signing opt-in across a reload', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    const notNow = page.getByRole('button', { name: 'Not now' })
    if (await notNow.isVisible().catch(() => false)) await notNow.click()

    await openEditor(page)
    await addWidget(page, 'Wallet actions')
    const card = page.locator('[data-widget-type="walletActions"]')
    await card.getByRole('button', { name: /^Options for Wallet actions/ }).click()
    await page.getByText('Configure', { exact: true }).click()
    const dialog = page.locator('.dw-settings')
    await expect(dialog.getByText('Enable claim and cancel buttons')).toBeVisible()
    await dialog.getByText('Enable claim and cancel buttons').click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const stored = await readDashboard(page, ACCOUNT_KEY)
    const widget = stored.widgets.find(entry => entry.type === 'walletActions')
    expect(widget.settings.enableActions).toBe(true)
  })

  test('renders follower growth for a signed-in account', async ({ page }) => {
    await loginAs(page)
    await page.goto('/')
    await waitForApp(page)
    const notNow = page.getByRole('button', { name: 'Not now' })
    if (await notNow.isVisible().catch(() => false)) await notNow.click()

    await openEditor(page)
    await addWidget(page, 'Follower growth')
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()

    const card = page.locator('[data-widget-type="followerGrowth"]')
    await card.scrollIntoViewIfNeeded()
    await expect(card).toContainText('Followers')
    await expect(card).not.toContainText('needs an account')
  })

  test('masonry presets collapse to one column on mobile', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Layouts' }).click()
    await page.locator('.q-menu').getByText('Everyday', { exact: true }).click()
    await page.locator('.dw-bar').getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.dw-grid--packed.dw-grid--masonry')).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('.dw-grid--packed.dw-grid--masonry')).toHaveCount(0)
    await expect(page.locator('.dw-grid--packed')).toBeVisible()

    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('my communities feed merges subscriptions and asks guests to log in', async ({ page }) => {
    const layout = id => ({
      widgets: [{ id, type: 'posts', width: 'full', settings: { source: 'myCommunities', limit: 4, view: 'list' } }],
      customised: true,
      version: 1,
      savedAt: Date.now(),
      tiling: 'rows'
    })

    await page.evaluate(doc => {
      localStorage.setItem('hive:dashboard:v1:default', JSON.stringify(doc))
    }, layout('posts-guest'))
    await page.reload()
    await waitForApp(page)
    await expect(page.getByText('Log in to see posts across your communities.')).toBeVisible()

    await loginAs(page)
    await page.evaluate(doc => {
      localStorage.setItem('hive:dashboard:v1:ausbitbank', JSON.stringify(doc))
    }, layout('posts-account'))
    await page.reload()
    await waitForApp(page)

    const widget = page.locator('[data-widget-type="posts"]').first()
    await expect(widget).toContainText('My communities')
    await expect(widget.locator('.home-post-row')).toHaveCount(4, { timeout: 30000 })
    await expect(widget.getByRole('link', { name: /View all/ })).toHaveAttribute('href', '/@ausbitbank/communities')
  })
})
