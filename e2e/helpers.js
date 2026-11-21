import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
export const axePath = require.resolve('axe-core/axe.min.js')

export async function runAxe (page, { disableRules = [] } = {}) {
  await page.addScriptTag({ path: axePath })
  const rules = Object.fromEntries(disableRules.map(id => [id, { enabled: false }]))
  const violations = await page.evaluate(async (rules) => {
    const result = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], rules })
    return result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map(node => node.target.join(' '))
    }))
  }, rules)
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
