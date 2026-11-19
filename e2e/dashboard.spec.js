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
  await page.getByRole('button', { name: 'Customise', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Dashboard editing' })).toBeVisible()
}

async function addWidget (page, label) {
  await page.getByRole('button', { name: 'Add widget' }).click()
  await page.getByRole('button', { name: 'Add ' + label }).click()
  await page.getByRole('button', { name: 'Done' }).click()
}

test.describe('customisable dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await waitForApp(page)
  })

  test('starts on the built-in layout with the Customise button', async ({ page }) => {
    await expect(page.locator('.home-layout')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Customise', exact: true })).toBeVisible()
    await expect(page.locator('.dw-grid--packed')).toHaveCount(0)
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

    await expect(page.locator('.home-layout')).toBeVisible()
    expect(await readDashboard(page, GUEST_KEY)).toBeNull()
  })

  test('reset returns to the built-in layout', async ({ page }) => {
    await openEditor(page)
    await addWidget(page, 'Network stats')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.dw-grid--packed')).toBeVisible()

    await openEditor(page)
    await page.getByRole('button', { name: 'Reset to default' }).click()

    await expect(page.locator('.home-layout')).toBeVisible()
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
    await expect(label).toHaveText('Half')

    await block.getByRole('button', { name: 'Make Live block wider' }).click()
    await expect(label).toHaveText('Two thirds')
    await expect(page.getByText('1 width change')).toBeVisible()

    await block.getByRole('button', { name: 'Make Live block narrower' }).click()
    await expect(label).toHaveText('Half')
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
    const trending = page.locator('[data-widget-type="posts"]')
    await trending.getByRole('button', { name: /^Options for Posts on Hive/ }).click()
    await page.getByText('Configure', { exact: true }).click()

    const dialog = page.locator('.dw-settings')
    await expect(dialog.locator('.dw-settings__title')).toHaveText('Posts on Hive')
    await dialog.getByRole('combobox').first().click()
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
    const posts = page.locator('[data-widget-type="posts"]')
    await posts.getByRole('button', { name: /^Options for Posts on Hive/ }).click()
    await page.getByText('Configure', { exact: true }).click()

    const dialog = page.locator('.dw-settings')
    await dialog.getByLabel('Feed reference').fill('/@ausbitbank/feed')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(posts.locator('.home-eyebrow')).toHaveText('Feed')
    await expect(posts.locator('.home-panel__title')).toHaveText('@ausbitbank')

    await page.getByRole('button', { name: 'Save' }).click()
    const card = page.locator('[data-widget-type="posts"]')
    await expect(card.locator('.home-panel__title')).toHaveText('@ausbitbank')
    await expect(card.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/@ausbitbank/feed')

    const stored = await readDashboard(page, GUEST_KEY)
    const settings = stored.widgets.find(widget => widget.type === 'posts').settings
    expect(settings.reference).toBe('/@ausbitbank/feed')
  })

  test('community and short-form references change the posts header', async ({ page }) => {
    await openEditor(page)
    const posts = page.locator('[data-widget-type="posts"]')

    const configure = async reference => {
      await posts.getByRole('button', { name: /^Options for Posts on Hive/ }).click()
      await page.getByText('Configure', { exact: true }).click()
      const dialog = page.locator('.dw-settings')
      await dialog.getByLabel('Feed reference').fill(reference)
      await page.getByRole('button', { name: 'Apply' }).click()
    }

    await configure('/c/hive-174578')
    await expect(posts.locator('.home-eyebrow')).toHaveText('Community · Trending')
    await expect(posts.locator('.home-panel__title')).toHaveText('#hive-174578')

    await configure('/shorts/threads')
    await expect(posts.locator('.home-eyebrow')).toHaveText('Short posts · InLeo')
    await expect(posts.locator('.home-panel__title')).toHaveText('Threads')
  })

  test('account posts accept a feed type and reference', async ({ page }) => {
    await openEditor(page)
    const card = page.locator('[data-widget-type="accountPosts"]')
    await card.getByRole('button', { name: /^Options for Account posts/ }).click()
    await page.getByText('Configure', { exact: true }).click()

    const dialog = page.locator('.dw-settings')
    await dialog.getByLabel('Feed type').click()
    await page.getByRole('option', { name: 'Feed', exact: true }).click()
    await dialog.getByLabel('Feed reference').fill('/@ausbitbank/feed')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(card.locator('.home-eyebrow')).toHaveText('Feed')
    await expect(card.locator('.home-panel__title')).toHaveText('@ausbitbank')

    await page.getByRole('button', { name: 'Save' }).click()
    const stored = await readDashboard(page, GUEST_KEY)
    const settings = stored.widgets.find(widget => widget.type === 'accountPosts').settings
    expect(settings.sort).toBe('feed')
    expect(settings.reference).toBe('/@ausbitbank/feed')
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
    await expect(page.locator('.home-layout')).toBeVisible()
    expect(await page.evaluate(key => localStorage.getItem(key), SETUP_KEY)).toBeTruthy()

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Make this dashboard yours' })).toBeHidden()
    await expect(page.locator('.home-layout')).toBeVisible()
  })
})
