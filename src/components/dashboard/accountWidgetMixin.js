// Options-API mixin for the dashboard widgets that read one account.
//
// The dashboard hands each widget only its own settings, so a widget cannot see
// the grid. This provides the few things every account widget needs: resolve
// the account (setting -> signed-in user -> guest), load it once, and expose a
// `state` string the template can branch on (`guest`, `loading`, `ready`,
// `error`, `stale`).
//
// Usage:
//   export default {
//     mixins: [accountWidgetMixin],
//     props: { account: { type: String, default: '' } },
//     ...
//   }
//
// The mixin declares no props of its own; widgets declare `account` (and any
// other settings) so the grid can pass them through.

import { loadAccountWidgetData, useSignedInUsername } from 'src/composables/useAccountWidget'

export const accountWidgetMixin = {
  data () {
    return {
      accountName: '',
      accountRecord: null,
      globalProps: null,
      prices: null,
      loadError: '',
      loading: false,
      loaded: false,
      updatedAt: 0,
      accountWidgetRequest: 0
    }
  },
  computed: {
    signedInUser () {
      return useSignedInUsername(this)
    },
    /** The account this widget is about, or '' for guests. */
    targetAccount () {
      const explicit = String(this.account || '').replace(/^@/, '').trim()
      return explicit || this.signedInUser || ''
    },
    state () {
      if (!this.targetAccount) return 'guest'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      return this.loaded ? 'ready' : 'loading'
    }
  },
  watch: {
    targetAccount () {
      // Drop the previous account's record immediately; a pending request is
      // invalidated by the request token in reload().
      this.accountName = ''
      this.accountRecord = null
      this.loaded = false
      this.reload()
    }
  },
  mounted () {
    this.reload()
  },
  beforeUnmount () {
    // Invalidate any in-flight account read: a late result must not run
    // applyAccountData() (and its follow-up L2 reads) on a dead widget.
    this.accountWidgetRequest += 1
  },
  methods: {
    async reload (force = false) {
      const token = ++this.accountWidgetRequest
      const name = this.targetAccount
      if (!name) {
        this.accountName = ''
        this.accountRecord = null
        this.loaded = false
        this.loading = false
        return
      }
      this.loading = true
      this.loadError = ''
      try {
        const result = await this.loadAccountData(name, force)
        if (token !== this.accountWidgetRequest || name !== this.targetAccount) return
        if (!result) {
          this.loadError = 'Could not load @' + name + '.'
          return
        }
        if (result.error && !result.ok) {
          this.loadError = result.error
          return
        }
        this.accountName = result.accountName || name
        this.accountRecord = result.account
        // Global properties and prices drive every HP/USD figure in the widgets;
        // store them here so no widget has to remember to.
        this.globalProps = result.globalProps || null
        this.prices = result.prices || null
        this.applyAccountData(result)
        this.loaded = true
        this.updatedAt = Date.now()
      } catch (error) {
        if (token !== this.accountWidgetRequest || name !== this.targetAccount) return
        this.loadError = error?.message || 'Could not load @' + name + '.'
      } finally {
        if (token === this.accountWidgetRequest && name === this.targetAccount) this.loading = false
      }
    },
    /** Explicit user refresh: bypass the short-lived read cache. */
    async refresh () {
      return this.reload(true)
    },
    /** Override in a widget to receive the raw result before it is stored. */
    applyAccountData () {},
    async loadAccountData (name, force = false) {
      return loadAccountWidgetData(this, { getSettings: () => ({ account: name }), force })
    }
  }
}

export default accountWidgetMixin
