import { test, expect } from './fixtures'
import { loginAs, readQueue, seedQueue, waitForApp } from './helpers'

const QUEUE_ITEMS = [
  ['ausbitbank', 'active', ['transfer', { from: 'ausbitbank', to: 'alice', amount: '1.000 HIVE', memo: '' }]],
  ['ausbitbank', 'posting', ['vote', { voter: 'ausbitbank', author: 'alice', permlink: 'hello', weight: 10000 }]]
]
const QUEUE_META = [
  { status: 'sent', error: '', txId: 'abc123def456', addedAt: Date.now() - 60000, updatedAt: Date.now() - 50000 },
  { status: 'failed', error: 'Keychain is unavailable.', txId: '', addedAt: Date.now() - 30000, updatedAt: Date.now() - 20000 }
]

test.describe('action flows', () => {
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
