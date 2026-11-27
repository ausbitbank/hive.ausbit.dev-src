// Reader state for Banksia Vault (banksia.vault@1).
//
// This store owns the per-page reader key mirror and the per-post unlock state.
// Plaintext lives in memory only: `lockPost`/`lockAll` drop it, a reload loses
// it, and nothing is written to localStorage, the service worker or analytics.
//
// The unlock path never generates a reader key for a visitor. A key exists only
// after the reader subscribes or imports a recovery file; otherwise the post
// stays behind the paywall.

import { defineStore } from 'pinia'
import {
  findGrantEntry,
  loadBulletinParts,
  loadVaultParts,
  resolveBulletin,
  unlockWithGrant,
  vaultStatusMessage,
  verifyBulletin
} from 'src/services/vaultUnlock'
import {
  forgetReaderKey as forgetStoredReaderKey,
  getReaderKey,
  ensureReaderKey as ensureStoredReaderKey,
  exportReaderKeyRecovery,
  importReaderKeyRecovery,
  listReaderKeys,
  rotateReaderKey as rotateStoredReaderKey
} from 'src/services/vaultReaderKey'

const DEFAULT_POLL_TIMEOUT_MS = 120000
const DEFAULT_POLL_INTERVAL_MS = 5000

// Module-level so timers and in-flight work are never made reactive.
const inflight = new Map()
const polls = new Map()

function normalizeBlog (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function postKey (blog, permlink) {
  return normalizeBlog(blog) + ':' + String(permlink || '').trim().toLowerCase()
}

function idleState () {
  return {
    status: 'idle',
    plaintext: '',
    period: '',
    reader: null,
    expires: '',
    code: '',
    message: '',
    error: '',
    bulletinAt: 0
  }
}

function stopPoll (key) {
  const handle = polls.get(key)
  if (!handle) return
  handle.cancelled = true
  if (handle.timer) clearTimeout(handle.timer)
  polls.delete(key)
}

function visible () {
  return typeof document === 'undefined' || !document.hidden
}

function offline () {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false
  } catch {
    return false
  }
}

function waitForVisible () {
  if (visible()) return Promise.resolve()
  return new Promise(resolve => {
    const handler = () => {
      if (!visible()) return
      document.removeEventListener('visibilitychange', handler)
      resolve()
    }
    document.addEventListener('visibilitychange', handler)
  })
}

export const useVaultStore = defineStore('vault', {
  state: () => ({
    readerKeys: {},
    posts: {},
    unlockInFlight: {}
  }),

  actions: {
    async ensureReaderKey (blog, options = {}) {
      const name = normalizeBlog(blog)
      if (!name) throw new Error('A blog account is required for a reader key.')
      const existing = this.readerKeys[name] || await getReaderKey(name)
      if (existing) {
        this.readerKeys[name] = existing
        return existing
      }
      const record = await ensureStoredReaderKey(name, options)
      this.readerKeys[name] = record
      return record
    },

    async readerKey (blog) {
      const name = normalizeBlog(blog)
      if (!name) return null
      if (this.readerKeys[name]) return this.readerKeys[name]
      const record = await getReaderKey(name)
      if (record) this.readerKeys[name] = record
      return record
    },

    async listReaderKeys () {
      const records = await listReaderKeys()
      for (const record of records) this.readerKeys[record.blog] = record
      return records
    },

    async forgetReaderKey (blog) {
      const name = normalizeBlog(blog)
      delete this.readerKeys[name]
      return forgetStoredReaderKey(name)
    },

    async rotateReaderKey (blog) {
      const name = normalizeBlog(blog)
      const record = await rotateStoredReaderKey(name)
      this.readerKeys[name] = record
      return record
    },

    exportRecovery (blog, passphrase, options = {}) {
      return exportReaderKeyRecovery(normalizeBlog(blog), passphrase, options)
    },

    async importRecovery (blog, text, passphrase) {
      const name = normalizeBlog(blog)
      const record = await importReaderKeyRecovery(name, text, passphrase)
      this.readerKeys[name] = record
      return record
    },

    postState (blog, permlink) {
      return this.posts[postKey(blog, permlink)] || idleState()
    },

    setPostState (key, patch) {
      const current = this.posts[key] || idleState()
      this.posts[key] = { ...current, ...patch }
      return this.posts[key]
    },

    /**
     * Try to unlock a premium post with an existing reader key.
     *
     * Never creates a key. A missing key, bulletin or grant leaves a paywall
     * state; a payment-pending state starts the visibility-aware two-minute
     * poll unless `poll: false` is passed.
     */
    async unlockPost ({
      blog,
      author = '',
      permlink,
      metadata,
      settings = {},
      force = false,
      poll = true,
      readerAccount = '',
      timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
      intervalMs = DEFAULT_POLL_INTERVAL_MS
    } = {}) {
      const name = normalizeBlog(blog)
      const key = postKey(name, permlink)
      if (!name || !permlink) {
        return { ok: false, code: 'bulletin', message: vaultStatusMessage('bulletin') }
      }

      if (inflight.has(key)) return inflight.get(key)

      const current = this.posts[key]
      if (!force && current && current.status === 'unlocked' && current.plaintext) {
        return { ok: true, plaintext: current.plaintext, period: current.period, expires: current.expires, reader: current.reader }
      }

      const task = (async () => {
        this.unlockInFlight[key] = true
        if (!force) stopPoll(key)
        this.setPostState(key, {
          status: 'checking',
          code: '',
          message: '',
          error: ''
        })

        try {
          const record = await getReaderKey(name)
          if (!record) {
            const state = this.setPostState(key, {
              status: 'no-key',
              code: 'no-key',
              message: vaultStatusMessage('no-key')
            })
            return { ok: false, ...state }
          }
          this.readerKeys[name] = record

          const resolved = await resolveBulletin({ blog: name, settings, force, allowRelay: true })
          if (!resolved || !resolved.bulletin) {
            if (offline()) {
              const state = this.setPostState(key, {
                status: 'error',
                code: 'offline',
                message: vaultStatusMessage('offline'),
                error: 'offline',
                bulletinAt: 0
              })
              return { ok: false, ...state }
            }
            const state = this.setPostState(key, {
              status: 'payment-pending',
              code: 'bulletin',
              message: vaultStatusMessage('payment-pending'),
              bulletinAt: 0
            })
            if (poll) this.startPoll({ blog: name, author, permlink, metadata, settings, readerAccount, timeoutMs, intervalMs })
            return { ok: false, ...state }
          }

          const verified = await verifyBulletin({ bulletin: resolved.bulletin, allowDelegation: true })
          if (!verified.ok) {
            const code = offline()
              ? 'offline'
              : verified.reason === 'delegation-unsupported'
                  ? 'unsupported'
                  : (verified.reason === 'signature' ? 'signature' : 'bulletin')
            const state = this.setPostState(key, {
              status: 'error',
              code,
              message: vaultStatusMessage(code),
              error: verified.reason || 'verification-failed',
              bulletinAt: Date.now()
            })
            return { ok: false, ...state }
          }

          const mergedBulletin = await loadBulletinParts({ bulletin: resolved.bulletin })
          if (!mergedBulletin) {
            const state = this.setPostState(key, {
              status: 'error',
              code: 'tampered',
              message: vaultStatusMessage('tampered'),
              error: 'bulletin-parts'
            })
            return { ok: false, ...state }
          }

          const entry = await findGrantEntry({
            bulletin: mergedBulletin,
            readerPublicKey: record.publicKeyB64
          })
          if (!entry) {
            const state = this.setPostState(key, {
              status: 'payment-pending',
              code: 'payment-pending',
              message: vaultStatusMessage('payment-pending'),
              bulletinAt: Date.now()
            })
            if (poll) this.startPoll({ blog: name, author, permlink, metadata, settings, readerAccount, timeoutMs, intervalMs })
            return { ok: false, ...state }
          }

          this.setPostState(key, {
            status: 'unlocking',
            code: '',
            message: 'Unlocking…'
          })

          let companionParts = null
          if (metadata && Array.isArray(metadata.parts) && metadata.parts.length) {
            companionParts = await loadVaultParts({ blog: name, metadata })
            if (!companionParts) {
              const state = this.setPostState(key, {
                status: 'error',
                code: 'tampered',
                message: vaultStatusMessage('tampered'),
                error: 'missing-parts'
              })
              return { ok: false, ...state }
            }
          }

          const result = await unlockWithGrant({
            bulletin: mergedBulletin,
            entry,
            readerKey: {
              privateKey: record.privateKey,
              publicKeyB64: record.publicKeyB64
            },
            metadata,
            parts: companionParts,
            blog: name,
            permlink,
            now: Date.now()
          })

          if (!result.ok) {
            const status = result.code === 'expired'
              ? 'expired'
              : (result.code === 'wrong-key' || result.code === 'tampered' || result.code === 'unsupported')
                  ? 'error'
                  : 'payment-pending'
            const state = this.setPostState(key, {
              status,
              code: result.code,
              message: result.message || vaultStatusMessage(result.code),
              error: result.code,
              bulletinAt: Date.now()
            })
            if (status === 'payment-pending' && poll) {
              this.startPoll({ blog: name, author, permlink, metadata, settings, readerAccount, timeoutMs, intervalMs })
            }
            return { ok: false, ...state }
          }

          const account = String(readerAccount || '').trim().replace(/^@/, '')
          const state = this.setPostState(key, {
            status: 'unlocked',
            plaintext: result.plaintext,
            period: result.period,
            reader: {
              ...result.reader,
              account,
              label: account ? 'Licensed to @' + account + ' · ' + result.period : ''
            },
            expires: result.expires,
            code: '',
            message: vaultStatusMessage('unlocked'),
            error: '',
            bulletinAt: Date.now()
          })
          stopPoll(key)
          return { ok: true, ...state }
        } catch (error) {
          const state = this.setPostState(key, {
            status: 'error',
            code: 'bulletin',
            message: vaultStatusMessage('bulletin'),
            error: error && error.message ? error.message : 'unlock-failed'
          })
          return { ok: false, ...state }
        } finally {
          this.unlockInFlight[key] = false
          inflight.delete(key)
        }
      })()

      inflight.set(key, task)
      return task
    },

    /** Same as unlock, but refresh the bulletin first. */
    restoreAccess (options = {}) {
      return this.unlockPost({ ...options, force: true })
    },

    startPoll ({ blog, author, permlink, metadata, settings, readerAccount, timeoutMs, intervalMs }) {
      const key = postKey(blog, permlink)
      stopPoll(key)
      const handle = { cancelled: false, timer: null }
      polls.set(key, handle)
      const deadline = Date.now() + Math.max(0, Number(timeoutMs) || DEFAULT_POLL_TIMEOUT_MS)
      const wait = Math.max(0, Number(intervalMs) || DEFAULT_POLL_INTERVAL_MS)

      const tick = async () => {
        if (handle.cancelled) return
        if (Date.now() > deadline) {
          stopPoll(key)
          return
        }
        const state = this.posts[key]
        if (!state || ['unlocked', 'expired', 'error', 'no-key'].includes(state.status)) {
          stopPoll(key)
          return
        }
        await waitForVisible()
        if (handle.cancelled) return
        await this.unlockPost({
          blog,
          author,
          permlink,
          metadata,
          settings,
          force: true,
          poll: false,
          readerAccount
        }).catch(() => {})
        if (handle.cancelled) return
        const next = this.posts[key]
        if (!next || ['unlocked', 'expired', 'error', 'no-key'].includes(next.status)) {
          stopPoll(key)
          return
        }
        if (Date.now() + wait > deadline) {
          stopPoll(key)
          return
        }
        handle.timer = setTimeout(tick, wait)
      }

      handle.timer = setTimeout(tick, wait)
      return handle
    },

    /** Poll for a grant after payment, stopping on unmount or lock. */
    pollForGrant (options = {}) {
      return this.startPoll({
        timeoutMs: DEFAULT_POLL_TIMEOUT_MS,
        intervalMs: DEFAULT_POLL_INTERVAL_MS,
        ...options
      })
    },

    lockPost (blog, permlink) {
      const key = postKey(blog, permlink)
      stopPoll(key)
      delete this.posts[key]
    },

    lockAll () {
      for (const key of polls.keys()) stopPoll(key)
      this.posts = {}
    }
  }
})
