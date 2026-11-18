import { test, expect } from './fixtures'
import { loginAs, waitForApp } from './helpers'

// A post the test account has not voted on, so the vote control is live.
const POST_ROUTE = '/@dim753/such-is-life'

/* Drive the queue's per-item status through the app's own store, emulating the
   queue panel resolving a broadcast (which needs a signer in real use). */
async function setQueuedVoteStatus (page, status) {
  const handle = await page.evaluateHandle(() =>
    document.querySelector('#q-app')?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('hive') || null
  )
  const found = await handle.evaluate(store => Boolean(store))
  expect(found).toBe(true)
  await page.evaluate(({ store, status }) => {
    store.setQueueStatus(0, status)
    if (status === 'sent') store.setQueueTxId(0, 'deadbeef')
  }, { store: handle, status })
}

test('both vote directions are always available on a post with no votes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAs(page)
  await page.goto(POST_ROUTE, { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  await expect(page.locator('.vote-control')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.vote-control__btn--up').first()).toBeVisible()
  // The downvote must not be hidden just because the post has no downvotes.
  await expect(page.locator('.vote-control__btn--down').first()).toBeVisible()
  await expect(page.locator('.vote-control__btn--down').first()).toBeEnabled()

  // A downvote opens the composer on a negative weight.
  await page.locator('.vote-control__btn--down').first().click()
  await expect(page.locator('.vote-control__composer--down')).toBeVisible()
  await expect(page.locator('.vote-control__composer-value')).toHaveText('100%')
})

test('queued vote stops spinning once the queue confirms it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAs(page)
  await page.goto(POST_ROUTE, { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  const control = page.locator('.vote-control')
  await expect(control).toBeVisible({ timeout: 30000 })
  await page.locator('.vote-control__btn--up').first().click()
  await page.locator('.vote-control__confirm').first().click()

  // Queued: a pending state with a spinner.
  await expect(page.locator('.vote-control__sent--pending')).toBeVisible()
  await expect(page.locator('.vote-control__sent .q-spinner')).toBeVisible()

  await setQueuedVoteStatus(page, 'sent')

  // Confirmed: settled "Voted" state, spinner gone.
  await expect(page.locator('.vote-control__sent--up')).toBeVisible()
  await expect(page.locator('.vote-control__sent-label')).toHaveText('Voted')
  await expect(page.locator('.vote-control__sent .q-spinner')).toHaveCount(0)
})

test('failed vote offers a retry instead of spinning forever', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAs(page)
  await page.goto(POST_ROUTE, { waitUntil: 'domcontentloaded' })
  await waitForApp(page)

  await expect(page.locator('.vote-control')).toBeVisible({ timeout: 30000 })
  await page.locator('.vote-control__btn--up').first().click()
  await page.locator('.vote-control__confirm').first().click()
  await setQueuedVoteStatus(page, 'failed')

  await expect(page.locator('.vote-control__sent--failed')).toBeVisible()
  await expect(page.locator('.vote-control__sent-label')).toHaveText('Vote failed')
  await expect(page.locator('.vote-control__sent .q-spinner')).toHaveCount(0)
  await expect(page.locator('.vote-control__sent-retry')).toBeVisible()
})
