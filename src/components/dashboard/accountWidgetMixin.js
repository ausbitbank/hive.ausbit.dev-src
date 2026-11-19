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

import { useSignedInUsername } from 'src/composables/useAccountWidget'

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
      updatedAt: 0
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
      this.reload()
    }
  },
  created () {
    this._accountWidgetStop = this.$watch(() => this.signedInUser, () => this.reload())
  },
  mounted () {
    this.reload()
  },
  beforeUnmount () {
    if (this._accountWidgetStop) this._accountWidgetStop()
  },
  methods: {
    async reload () {
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
      const result = await this.loadAccountData(name)
      this.loading = false
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
    },
    /** Override in a widget to receive the raw result before it is stored. */
    applyAccountData () {},
    async loadAccountData (name) {
      // Imported lazily so widgets that do not need chains/prices stay light.
      const { loadAccountWidgetData } = await import('src/composables/useAccountWidget')
      return loadAccountWidgetData(this, { getSettings: () => ({ account: name }) })
    }
  }
}

export default accountWidgetMixin
