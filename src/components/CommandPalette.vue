<template>
  <q-dialog v-model="open" position="top" @show="onShow">
    <q-card class="command-palette">
      <div class="command-palette__search">
        <q-icon name="search" size="20px" aria-hidden="true" />
        <q-input
          ref="queryInput"
          v-model="query"
          borderless
          dense
          autofocus
          class="command-palette__input"
          placeholder="Search accounts, posts, tags, blocks, transactions…"
          aria-label="Search or jump to a Hive page"
          @keydown="onKeydown"
        />
        <kbd class="command-palette__esc">Esc</kbd>
      </div>

      <q-separator />

      <div class="command-palette__results" role="listbox" aria-label="Command palette results" tabindex="0">
        <template v-for="group in groups" :key="group.label">
          <div class="command-palette__group">{{ group.label }}</div>
          <div
            v-for="result in group.items"
            :id="'command-result-' + result.index"
            :key="result.path + '-' + result.index"
            class="command-result"
            :class="{ 'command-result--active': result.index === selectedIndex }"
            role="option"
            :aria-selected="result.index === selectedIndex"
            @mouseenter="selectedIndex = result.index"
            @click="select(result)"
          >
            <q-icon :name="result.icon" size="19px" class="command-result__icon" aria-hidden="true" />
            <div class="command-result__body">
              <div class="command-result__label">{{ result.label }}</div>
              <div class="command-result__description">{{ result.description }}</div>
            </div>
            <q-icon name="arrow_forward" size="16px" class="command-result__arrow" aria-hidden="true" />
          </div>
        </template>

        <button
          v-if="searchQuery"
          id="command-result--1"
          type="button"
          class="command-result command-result--search"
          :class="{ 'command-result--active': selectedIndex === -1 }"
          @click="openFullSearch"
        >
          <q-icon name="manage_search" size="19px" class="command-result__icon" aria-hidden="true" />
          <div class="command-result__body">
            <div class="command-result__label">Search for “{{ query.trim() }}”</div>
            <div class="command-result__description">Open the full results page</div>
          </div>
          <q-icon name="arrow_forward" size="16px" class="command-result__arrow" aria-hidden="true" />
        </button>

        <div v-if="groups.length === 0" class="command-palette__empty">
          <q-icon name="search_off" size="24px" aria-hidden="true" />
          <span>No matches. Try @account, #tag, a block number, transaction id or a Hive URL.</span>
        </div>
      </div>

      <q-separator />

      <div class="command-palette__footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>Ctrl</kbd><kbd>↵</kbd> full search</span>
        <span><kbd>esc</kbd> close</span>
        <span class="command-palette__shortcut">{{ shortcutLabel }}</span>
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.command-palette {
  width: min(680px, 94vw);
  margin-top: 6vh;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
}

.command-palette__search {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 0.9rem;
  color: var(--c-text-subtle);
}

.command-palette__input {
  flex: 1;
  min-width: 0;
}

.command-palette__esc,
.command-palette__footer kbd {
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  color: var(--c-text-subtle);
  font-family: monospace;
  font-size: 0.67rem;
}

.command-palette__results {
  max-height: 56vh;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.command-palette__group {
  padding: 0.5rem 0.95rem 0.25rem;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.command-result {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.95rem;
  cursor: pointer;
  border-left: 2px solid transparent;
}

.command-result--active {
  border-left-color: var(--c-link);
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
}

.command-result--search {
  width: calc(100% - 1.2rem);
  margin: 0.25rem 0.6rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-link) 5%, transparent);
  font: inherit;
  text-align: left;
}

.command-result--search.command-result--active {
  border-color: color-mix(in srgb, var(--c-link) 50%, transparent);
  border-left-color: var(--c-link);
}

.command-result__icon {
  flex: none;
  color: var(--c-text-faint);
}

.command-result--active .command-result__icon {
  color: var(--c-link-hover);
}

.command-result__body {
  flex: 1;
  min-width: 0;
}

.command-result__label {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.86rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-result__description {
  overflow: hidden;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-result__arrow {
  flex: none;
  color: var(--c-text-faint);
}

.command-result--active .command-result__arrow {
  color: var(--c-link-hover);
}

.command-palette__empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.2rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.command-palette__footer {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.95rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.command-palette__footer span {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.command-palette__shortcut {
  margin-left: auto;
}

@media (max-width: 599px) {
  .command-palette {
    width: 100vw;
    max-width: none;
    margin-top: 0;
    border-radius: 0;
  }

  .command-palette__results {
    max-height: 68vh;
  }
}
</style>

<script>
import { parseSearchRoute } from 'src/services/search'
import { buildSearchPlan } from 'src/services/unifiedSearch'
import { fetchAccount } from 'src/services/chainData'

const RECENT_KEY = 'hive-command-recent'
const MAX_RECENT = 5

/**
 * Next selection index for the command palette.
 *
 * Result rows use indices `0..total-1`; the trailing "Search for …" row uses
 * `-1` and only exists when `hasSearchRow` is true. Navigation wraps in both
 * directions and treats the search row as the last stop.
 */
export function nextSelection (current, total, delta, hasSearchRow) {
  if (total <= 0 && !hasSearchRow) return -1
  if (delta > 0) {
    if (current === -1) return total ? 0 : -1
    if (current >= total - 1) return hasSearchRow ? -1 : 0
    return current + 1
  }
  if (current === -1) return total - 1
  if (current <= 0) return hasSearchRow ? -1 : total - 1
  return current - 1
}

/**
 * The palette action for a pressed Enter key. `selectedIndex` of -1 means the
 * "Search for …" row, which opens the full search page; otherwise a result row
 * is selected, or the full search opens when there are no results.
 */
export function resolveEnterAction (selectedIndex, hasResult, hasSearchRow) {
  if (selectedIndex === -1) return hasSearchRow ? 'search' : 'none'
  if (hasResult) return 'select'
  if (hasSearchRow) return 'search'
  return 'none'
}

function accountJumps (user, { subpages = false } = {}) {
  const base = {
    path: '/@' + user,
    label: '@' + user,
    description: 'Hive account profile',
    icon: 'person',
    kind: 'account'
  }
  if (!subpages) return [base]
  return [
    base,
    { path: '/@' + user + '/wallet', label: 'Wallet · @' + user, description: 'Balances and transactions', icon: 'account_balance_wallet' },
    { path: '/@' + user + '/posts', label: 'Posts · @' + user, description: 'Published posts', icon: 'library_books' },
    { path: '/@' + user + '/blog', label: 'Blog · @' + user, description: 'Posts and reblogs', icon: 'menu_book' },
    { path: '/@' + user + '/followers', label: 'Followers · @' + user, description: 'Accounts following this user', icon: 'people' }
  ]
}

function tagJumps (tag) {
  const clean = String(tag || '').replace(/^#/, '').toLowerCase()
  if (!clean) return []
  return [
    { path: '/trending/' + clean, label: '#' + clean, description: 'Trending posts tagged #' + clean, icon: 'tag', kind: 'tag' },
    { path: '/created/' + clean, label: 'New posts in #' + clean, description: 'Newest first', icon: 'schedule' },
    { path: '/hot/' + clean, label: 'Hot posts in #' + clean, description: 'Most active right now', icon: 'local_fire_department' }
  ]
}

/**
 * "Jump to" destinations for the palette. Mirrors `buildSearchPlan`: a bare
 * word is not an explicit account jump (it is probably a topic), so it offers
 * tag destinations and only shows an account once the async check confirms the
 * account exists. Explicit `@name`, `#tag`, URLs and chain identifiers keep
 * their direct destinations.
 */
export function resolveJumpResults (query, { knownAccounts = {}, accountChecks = {} } = {}) {
  const text = String(query || '').trim()
  if (!text) return []

  const route = parseSearchRoute(text)
  const bareAccount = route && route.kind === 'account' &&
    !text.startsWith('@') && !/^https?:\/\//i.test(text)

  if (route && !bareAccount) {
    const results = [route]
    const accountMatch = route.path.match(/^\/@([^/]+)$/)
    if (route.kind === 'account' && accountMatch && knownAccounts[accountMatch[1]] !== undefined) {
      results.push(...accountJumps(accountMatch[1], { subpages: true }).slice(1))
    }
    if (route.kind === 'tag') {
      results.push(...tagJumps(route.label).slice(1))
    }
    return results
  }

  const plan = buildSearchPlan(text)
  const results = []
  if (plan.tags) results.push(...tagJumps(plan.tags))
  const user = String(plan.accounts || '').toLowerCase()
  if (user && (knownAccounts[user] !== undefined || accountChecks[user] === 'found')) {
    results.push(...accountJumps(user, { subpages: true }))
  }
  return results
}

const COMMANDS = [  { label: 'Home', description: 'Live network dashboard', icon: 'home', path: '/', keywords: 'start dashboard front page' },
  { label: 'Browse posts', description: 'Trending, new and community posts', icon: 'explore', path: '/browse', keywords: 'posts feed content' },
  { label: 'Communities', description: 'Discover Hive communities by topic and activity', icon: 'forum', path: '/communities', keywords: 'community communities discover browse directory join subscribe' },
  { label: 'Short posts', description: 'Snaps, Waves, Threads, D.Buzz and Moments', icon: 'bolt', path: '/shorts', keywords: 'microblog snaps waves threads dbuzz moments short' },
  { label: 'Trending posts', description: 'What Hive is reading now', icon: 'trending_up', path: '/trending', keywords: 'hot popular' },
  { label: 'Latest blocks', description: 'Live chain activity', icon: 'view_agenda', path: '/blocks', keywords: 'chain explorer' },  { label: 'Witnesses', description: 'Vote and manage witnesses', icon: 'how_to_vote', path: '/witnesses', keywords: 'governance votes' },
  { label: 'Proposals', description: 'Decentralized Hive Fund', icon: 'account_balance', path: '/proposals', keywords: 'dhf dao governance' },
  { label: 'Markets', description: 'HIVE and HBD charts', icon: 'show_chart', path: '/markets', keywords: 'prices trading' },
  { label: 'Lightning', description: 'Receive sats as HIVE/HBD or pay a Lightning invoice', icon: 'bolt', path: '/lightning', keywords: 'lightning sats bitcoin btc v4v bridge zap invoice' },
  { label: 'Internal market', description: 'Trade HIVE and HBD', icon: 'store', path: '/market', keywords: 'exchange order book' },
  { label: 'HBD monitor', description: 'Peg, savings and interest', icon: 'attach_money', path: '/hbd', keywords: 'stablecoin savings apr' },
  { label: 'API nodes', description: 'Latency and node health', icon: 'dns', path: '/nodes', keywords: 'api status layer 2 hive-engine magi' },
  { label: 'Magi contracts', description: 'Inspect Magi contract state and outputs', icon: 'hub', path: '/magi', keywords: 'magi vsc layer 2 contract state' },
  { label: 'Search Hive', description: 'Accounts, posts, tags, communities and chain data', icon: 'search', path: '/search', keywords: 'search find lookup explore discovery' },
  { label: 'Network health', description: 'Chain status and global properties', icon: 'monitor_heart', path: '/health', keywords: 'status chain' },
  { label: 'Write a post', description: 'Drafts, preview and publishing', icon: 'edit_note', path: '/compose', keywords: 'compose create publish draft blog' },
  { label: 'Create account', description: 'Join Hive', icon: 'person_add', path: '/create', keywords: 'signup register' }
]

export default {
  name: 'commandPalette',
  data () {
    return {
      open: false,
      query: '',
      selectedIndex: 0,
      recent: [],
      accountChecks: {},
      accountTimer: null,
      shortcutLabel: 'Ctrl K'
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    dynamicResults () {
      return resolveJumpResults(this.query, {
        knownAccounts: this.$hiveStore.accounts || {},
        accountChecks: this.accountChecks
      })
    },
    commandResults () {
      const query = this.query.trim().toLowerCase()
      if (!query) return COMMANDS.slice(0, 12)
      return COMMANDS
        .filter(command => (command.label + ' ' + command.description + ' ' + command.keywords).toLowerCase().includes(query))
        .slice(0, 6)
    },
    personalResults () {
      if (!this.loggedInUser) return []
      const user = this.loggedInUser
      const items = [
        { path: '/compose', label: 'New post', description: 'Draft locally and publish', icon: 'edit_note' },
        { path: '/@' + user + '/wallet', label: 'My wallet', description: 'Balances and transactions', icon: 'account_balance_wallet' },
        { path: '/@' + user, label: 'My profile', description: 'Account overview', icon: 'person' }
      ]
      const query = this.query.trim().toLowerCase()
      if (!query) return items
      return items.filter(item => (item.label + ' ' + item.description).toLowerCase().includes(query))
    },
    searchQuery () {
      return this.query.trim().length >= 2
    },
    groups () {
      const used = new Set()
      let index = 0
      const addGroup = (label, items) => {
        const filtered = []
        for (const item of items) {
          if (!item || used.has(item.path)) continue
          used.add(item.path)
          filtered.push({ ...item, index: index++ })
        }
        return filtered.length ? { label, items: filtered } : null
      }

      return [
        addGroup('Jump to', this.dynamicResults),
        addGroup('Recent', this.query.trim() ? [] : this.recent),
        addGroup('Commands', [...this.personalResults, ...this.commandResults])
      ].filter(Boolean)
    },
    flatResults () {
      return this.groups.flatMap(group => group.items)
    }
  },
  watch: {
    query () {
      this.selectedIndex = 0
      this.scheduleAccountCheck()
    }
  },
  mounted () {
    this.loadRecent()
    this.shortcutLabel = /Mac|iPhone|iPad/i.test(navigator.platform || '') ? '⌘K' : 'Ctrl K'
    window.addEventListener('keydown', this.onGlobalKeydown)
  },
  beforeUnmount () {
    window.removeEventListener('keydown', this.onGlobalKeydown)
    if (this.accountTimer) clearTimeout(this.accountTimer)
  },
  methods: {
    scheduleAccountCheck () {
      if (this.accountTimer) clearTimeout(this.accountTimer)
      const plan = buildSearchPlan(this.query)
      if (plan.kind !== 'account' && plan.kind !== 'keyword') return
      const user = String(plan.accounts || '').toLowerCase()
      if (!/^[a-z][a-z0-9.-]{2,15}$/.test(user)) return
      if (this.$hiveStore.accounts[user] !== undefined || this.accountChecks[user]) return
      this.accountChecks[user] = 'pending'
      this.accountTimer = setTimeout(() => this.checkAccount(user), 300)
    },
    async checkAccount (user) {
      try {
        const account = await fetchAccount(user)
        this.accountChecks[user] = account ? 'found' : 'missing'
        if (account) this.$hiveStore.updateAccountData(account)
      } catch {
        this.accountChecks[user] = 'missing'
      }
    },
    openPalette () {
      this.query = ''
      this.selectedIndex = 0
      this.open = true
    },    onShow () {
      this.$nextTick(() => {
        this.$refs.queryInput?.focus()
        this.scrollSelected()
      })
    },
    onGlobalKeydown (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (event.shiftKey) return
        event.preventDefault()
        if (this.open) {
          this.open = false
          return
        }
        this.openPalette()
        return
      }
      if (event.key === 'Escape' && this.open) {
        // Stop the search page's Escape handling from clearing the query while
        // the palette is on top of it.
        event.preventDefault()
        this.open = false
      }
    },
    onKeydown (event) {
      const total = this.flatResults.length
      const hasSearchRow = this.searchQuery
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        this.selectedIndex = nextSelection(this.selectedIndex, total, 1, hasSearchRow)
        this.scrollSelected()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        this.selectedIndex = nextSelection(this.selectedIndex, total, -1, hasSearchRow)
        this.scrollSelected()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if ((event.metaKey || event.ctrlKey) && hasSearchRow) {
          this.openFullSearch()
          return
        }
        const result = this.selectedIndex >= 0 ? this.flatResults[this.selectedIndex] : null
        const action = resolveEnterAction(this.selectedIndex, Boolean(result), hasSearchRow)
        if (action === 'search') this.openFullSearch()
        else if (action === 'select' && result) this.select(result)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        this.open = false
      }
    },
    scrollSelected () {
      this.$nextTick(() => {
        document.getElementById('command-result-' + this.selectedIndex)?.scrollIntoView({ block: 'nearest' })
      })
    },
    select (result) {
      this.open = false
      this.saveRecent(result)
      this.query = ''
      this.$router.push(result.path).catch(() => {})
    },
    openFullSearch () {
      const text = this.query.trim()
      if (!text) return
      this.open = false
      this.saveRecent({ path: '/search?q=' + encodeURIComponent(text), label: 'Search: ' + text, description: 'Full search results', icon: 'manage_search' })
      this.$router.push({ path: '/search', query: { q: text } }).catch(() => {})
      this.query = ''
    },
    loadRecent () {
      try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
        this.recent = Array.isArray(stored) ? stored.filter(item => item && item.path && item.label).slice(0, MAX_RECENT) : []
      } catch {
        this.recent = []
      }
    },
    saveRecent (result) {
      const item = {
        path: result.path,
        label: result.label,
        description: result.description,
        icon: result.icon || 'history'
      }
      this.recent = [item, ...this.recent.filter(entry => entry.path !== item.path)].slice(0, MAX_RECENT)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent))
      } catch {
        // Recent history is optional; ignore storage failures.
      }
    }
  }
}
</script>
