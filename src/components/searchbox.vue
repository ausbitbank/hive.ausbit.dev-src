<template>
  <q-form @submit.prevent="onSearchSubmit" @reset="onSearchReset" class="q-mr-md q-electron-drag--exception">
    <q-input
      ref="searchInput"
      dense
      v-model="search"
      :autofocus="autofocus"
      :input-class="$q.screen.lt.sm ? '' : 'text-right'"
      class="q-ml-md"
      label="Search accounts, posts, tags, tx or block"
      aria-label="Search accounts, posts, tags, transactions or blocks"
      @keyup.enter.stop.prevent="onSearchSubmit"
    >
      <template v-slot:append>
        <q-btn flat dense round icon="search" aria-label="Search" title="Search" @click="onSearchSubmit" />
        <q-btn v-if="search !== ''" flat dense round icon="clear" aria-label="Clear search" title="Clear search" @click="search = ''" />
      </template>
    </q-input>
  </q-form>
</template>
<script>
const URL_HOSTS = ['hive.ausbit.dev', 'hive.blog', 'peakd.com', 'ecency.com']
const ACCOUNT_SUBPAGES = [
  'wallet', 'posts', 'blog', 'feed', 'replies', 'comments', 'communities',
  'followers', 'following', 'tip', 'transfers', 'trail'
]
const SORT_ROUTES = ['trending', 'created', 'hot', 'promoted', 'payout', 'payout_comments', 'muted']

export default {
  name: 'searchbox',
  props: {
    autofocus: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      search: '',
      lastSubmitAt: 0
    }
  },
  methods: {
    onSearchSubmit () {
      const now = Date.now()
      if (this.lastSubmitAt && now - this.lastSubmitAt < 500) return
      this.lastSubmitAt = now

      const raw = (this.search || '').trim()
      if (raw === '') {
        this.$q.notify({ type: 'warning', message: 'Enter an account, post, tag, transaction id or block number to search.' })
        return
      }

      const route = this.parseQuery(raw)
      if (!route) {
        this.$q.notify({
          type: 'negative',
          message: 'No results for "' + raw + '". Try a block number, transaction id, @account, @account/post, #tag or a Hive URL.'
        })
        return
      }

      this.$emit('submitted', route)
      this.$router.push(route)
    },
    onSearchReset () {
      this.search = ''
    },
    /**
     * Turn free text (or a supported Hive front-end URL) into a router route.
     * Returns null when the input cannot be understood.
     */
    parseQuery (raw) {
      const input = (raw || '').trim()
      if (input === '') return null

      if (/^https?:\/\//i.test(input)) return this.parseUrl(input)
      // Reject protocol-relative URLs; we only accept explicit http(s) links.
      if (input.startsWith('//')) return null

      // Block number, e.g. 12345678
      if (/^\d+$/.test(input)) return { path: '/block/' + input }

      // Transaction id, e.g. a 40 char hex string
      if (/^[0-9a-f]{40}$/i.test(input)) return { path: '/tx/' + input.toLowerCase() }

      // @account or @account/permlink
      if (input.startsWith('@')) {
        const parts = input.slice(1).split('/')
        const user = (parts[0] || '').toLowerCase()
        if (!this.isValidAccount(user)) return null
        if (parts.length > 1 && parts[1] !== '') {
          const permlink = parts[1].toLowerCase()
          if (!this.isValidPermlink(permlink)) return null
          return { path: '/@' + user + '/' + permlink }
        }
        return { path: '/@' + user }
      }

      // #tag or hive-123456 community tag
      if (input.startsWith('#')) return this.tagRoute(input.slice(1))
      if (/^hive-\d+$/i.test(input)) return this.tagRoute(input)

      // A bare valid username
      if (this.isValidAccount(input)) return { path: '/@' + input.toLowerCase() }

      // A bare tag (only reached when it is not a valid account name)
      if (this.isValidTag(input)) return this.tagRoute(input)

      return null
    },
    parseUrl (raw) {
      let url
      try {
        url = new URL(raw)
      } catch {
        return null
      }
      if (!['http:', 'https:'].includes(url.protocol)) return null

      const host = url.hostname.toLowerCase().replace(/^www\./, '')
      if (!URL_HOSTS.includes(host)) return null

      // Query strings and fragments are intentionally ignored; they never change
      // which account/post/tag the link points at.
      const segments = url.pathname
        .split('/')
        .map(segment => this.safeDecode(segment))
        .filter(segment => segment !== '')
      if (segments.length === 0) return { path: '/' }

      const atIndex = segments.findIndex(segment => segment.startsWith('@'))
      if (atIndex !== -1) {
        const user = segments[atIndex].slice(1).toLowerCase()
        if (!this.isValidAccount(user)) return null
        const next = (segments[atIndex + 1] || '').toLowerCase()
        if (next === '') return { path: '/@' + user }
        if (ACCOUNT_SUBPAGES.includes(next)) {
          if (next === 'wallet') return { path: '/@' + user + '/wallet' }
          return { path: '/@' + user }
        }
        if (!this.isValidPermlink(next)) return null
        return { path: '/@' + user + '/' + next }
      }

      const first = (segments[0] || '').toLowerCase()
      if (/^\d+$/.test(first)) return { path: '/block/' + first }
      if (['block', 'b'].includes(first) && /^\d+$/.test(segments[1] || '')) {
        return { path: '/block/' + segments[1] }
      }
      if (first === 'tx' && /^[0-9a-f]{40}$/i.test(segments[1] || '')) {
        return { path: '/tx/' + (segments[1] || '').toLowerCase() }
      }
      if (SORT_ROUTES.includes(first) && segments[1]) {
        const tag = segments[1].toLowerCase()
        if (!this.isValidTag(tag)) return null
        return { path: '/' + first + '/' + tag }
      }
      // A bare tag path such as hive.blog/photography
      if (segments.length === 1 && this.isValidTag(first) && !this.isValidAccount(first)) {
        return this.tagRoute(first)
      }

      return null
    },
    tagRoute (tag) {
      const clean = (tag || '').replace(/^#/, '').toLowerCase()
      if (!this.isValidTag(clean)) return null
      return { path: '/trending/' + clean }
    },
    isValidAccount (name) {
      if (!name) return false
      try {
        return this.$hive.utils.validateAccountName(name.toLowerCase()) === null
      } catch {
        return false
      }
    },
    isValidPermlink (permlink) {
      return /^[a-z0-9][a-z0-9._-]*$/i.test(permlink || '')
    },
    isValidTag (tag) {
      return /^[a-z0-9][a-z0-9-]{0,23}$/i.test(tag || '')
    },
    safeDecode (value) {
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }
}
</script>
