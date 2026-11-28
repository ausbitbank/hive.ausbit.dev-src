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
  const prefix = '/@' + user
  return [
    base,
    { path: prefix + '/wallet', label: 'Wallet · @' + user, description: 'Balances and transactions', icon: 'account_balance_wallet' },
    { path: prefix + '/transfers', label: 'Transfers · @' + user, description: 'Incoming and outgoing transfer history', icon: 'swap_horiz' },
    { path: prefix + '/posts', label: 'Posts · @' + user, description: 'Published posts', icon: 'library_books' },
    { path: prefix + '/blog', label: 'Blog · @' + user, description: 'Posts and reblogs', icon: 'menu_book' },
    { path: prefix + '/feed', label: 'Feed · @' + user, description: 'Posts from accounts this user follows', icon: 'rss_feed' },
    { path: prefix + '/replies', label: 'Replies · @' + user, description: 'Recent replies by this user', icon: 'reply' },
    { path: prefix + '/comments', label: 'Comments · @' + user, description: 'Recent comments by this user', icon: 'comment' },
    { path: prefix + '/followers', label: 'Followers · @' + user, description: 'Accounts following this user', icon: 'people' },
    { path: prefix + '/following', label: 'Following · @' + user, description: 'Accounts this user follows', icon: 'group' },
    { path: prefix + '/communities', label: 'Communities · @' + user, description: 'Communities this user belongs to', icon: 'forum' },
    { path: prefix + '/delegations', label: 'Delegations · @' + user, description: 'Incoming and outgoing HP delegations', icon: 'handshake' },
    { path: prefix + '/downvotes', label: 'Downvotes · @' + user, description: 'Downvote history and transparency', icon: 'thumb_down' },
    { path: prefix + '/tip', label: 'Tip · @' + user, description: 'Send a Lightning tip', icon: 'bolt' },
    { path: prefix + '/pos', label: 'Point of sale · @' + user, description: 'Tipping terminal for in-person payments', icon: 'point_of_sale' },
    { path: prefix + '/lightning', label: 'Lightning · @' + user, description: 'Lightning address and invoices', icon: 'flash_on' }
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

/**
 * Every user-facing page worth jumping to. Commands are grouped by category in
 * the palette and matched against the label, description and keyword aliases.
 * `featured` entries are what the empty palette shows before a search.
 */
export const COMMANDS = [
  // Explore
  { label: 'Home', category: 'Explore', featured: true, description: 'Live network dashboard', icon: 'home', path: '/', keywords: 'start dashboard front page' },
  { label: 'Browse posts', category: 'Explore', featured: true, description: 'Latest posts across Hive', icon: 'explore', path: '/created', keywords: 'browse posts feed content latest new created' },
  { label: 'Trending posts', category: 'Explore', featured: true, description: 'What Hive is reading now', icon: 'trending_up', path: '/trending', keywords: 'hot popular trending' },
  { label: 'Hot posts', category: 'Explore', description: 'Posts gaining activity right now', icon: 'local_fire_department', path: '/hot', keywords: 'hot popular rising' },
  { label: 'Pending payouts', category: 'Explore', description: 'Posts closest to their payout time', icon: 'payments', path: '/payout', keywords: 'payout rewards pending' },
  { label: 'Payout comments', category: 'Explore', description: 'Comments closest to their payout time', icon: 'forum', path: '/payout_comments', keywords: 'payout comments rewards pending' },
  { label: 'Muted posts', category: 'Explore', description: 'Posts hidden by your local moderation policy', icon: 'visibility_off', path: '/muted', keywords: 'muted hidden moderation filtered' },
  { label: 'Communities', category: 'Explore', featured: true, description: 'Discover Hive communities by topic and activity', icon: 'forum', path: '/communities', keywords: 'community communities discover browse directory join subscribe' },
  { label: 'Blogs', category: 'Explore', featured: true, description: 'Clean reading pages at username.banksia.io', icon: 'rss_feed', path: '/blogs', keywords: 'blogs blog reading pages claim host custom domain' },
  { label: 'Blog directory', category: 'Explore', description: 'Opt-in directory of Hive blogs on Banksia', icon: 'menu_book', path: '/blogs/directory', keywords: 'blogs directory listing community projects' },
  { label: 'Short posts', category: 'Explore', featured: true, description: 'Snaps, Waves, Threads, D.Buzz and Moments', icon: 'bolt', path: '/shorts', keywords: 'microblog snaps waves threads dbuzz moments short' },
  { label: 'Snaps', category: 'Explore', description: 'PeakD image-first short posts', icon: 'bolt', path: '/shorts/snaps', keywords: 'snaps peakd images short' },
  { label: 'Waves', category: 'Explore', description: 'Ecency short-post timeline', icon: 'waves', path: '/shorts/waves', keywords: 'waves ecency short' },
  { label: 'Threads', category: 'Explore', description: 'InLeo microblog threads', icon: 'forum', path: '/shorts/threads', keywords: 'threads inleo leo microblog short' },
  { label: 'D.Buzz', category: 'Explore', description: 'DBuzz short posts', icon: 'chat_bubble', path: '/shorts/dbuzz', keywords: 'dbuzz buzz microblog short' },
  { label: 'Moments', category: 'Explore', description: 'Liketu photo moments', icon: 'photo_camera', path: '/shorts/moments', keywords: 'moments liketu photos short' },
  { label: 'Search Hive', category: 'Explore', featured: true, description: 'Accounts, posts, tags, communities and chain data', icon: 'search', path: '/search', keywords: 'search find lookup explore discovery' },

  // Chain
  { label: 'Latest blocks', category: 'Chain', featured: true, description: 'Live chain activity', icon: 'view_agenda', path: '/blocks', keywords: 'chain explorer block blocks' },
  { label: 'Witnesses', category: 'Chain', featured: true, description: 'Vote and manage witnesses', icon: 'how_to_vote', path: '/witnesses', keywords: 'governance votes witness validators' },
  { label: 'Witness settings', category: 'Chain', description: 'Review, update or register a witness', icon: 'tune', path: '/witness', keywords: 'witness settings signing key register update' },
  { label: 'Proposals', category: 'Chain', featured: true, description: 'Decentralized Hive Fund', icon: 'account_balance', path: '/proposals', keywords: 'dhf dao governance proposals funding' },
  { label: 'Markets', category: 'Chain', featured: true, description: 'HIVE and HBD charts', icon: 'show_chart', path: '/markets', keywords: 'prices trading charts market' },
  { label: 'Internal market', category: 'Chain', description: 'Trade HIVE and HBD', icon: 'store', path: '/market', keywords: 'exchange order book trade swap' },
  { label: 'HBD monitor', category: 'Chain', description: 'Peg, savings and interest', icon: 'attach_money', path: '/hbd', keywords: 'stablecoin savings apr debt peg' },
  { label: 'HBD stabilizer', category: 'Chain', description: 'DAO peg-support account and orders', icon: 'balance', path: '/hbdstabilizer', keywords: 'hbd stabilizer smooth dao peg orders' },
  { label: 'Lightning', category: 'Chain', description: 'Receive sats as HIVE/HBD or pay a Lightning invoice', icon: 'bolt', path: '/lightning', keywords: 'lightning sats bitcoin btc v4v bridge zap invoice' },
  { label: 'API nodes', category: 'Chain', description: 'Latency and node health', icon: 'dns', path: '/nodes', keywords: 'api status layer 2 hive-engine magi nodes' },
  { label: 'Magi contracts', category: 'Chain', description: 'Inspect Magi contract state and outputs', icon: 'hub', path: '/magi', keywords: 'magi vsc layer 2 contract state' },
  { label: 'Network health', category: 'Chain', description: 'Chain status and global properties', icon: 'monitor_heart', path: '/health', keywords: 'status chain health global properties' },

  // Create
  { label: 'Write a post', category: 'Create', featured: true, description: 'Drafts, preview and publishing', icon: 'edit_note', path: '/compose', keywords: 'compose create publish draft blog post' },
  { label: 'Join Hive', category: 'Create', featured: true, description: 'Create a new Hive account', icon: 'person_add', path: '/join', keywords: 'signup sign up register account create join' },
  { label: 'Create your keys', category: 'Create', description: 'Generate a password, keys and a claim link', icon: 'key', path: '/join/keys', keywords: 'join keys password claim signup register' },
  { label: 'Create for someone', category: 'Create', featured: true, description: 'Gift a Hive account', icon: 'group_add', path: '/create', keywords: 'account token gift invite create sponsor' },
  { label: 'Claim an account', category: 'Create', description: 'Open a claim link and pay for a new account', icon: 'redeem', path: '/create/claim', keywords: 'claim link account token sponsor register' },
  { label: 'Batch claim links', category: 'Create', description: 'Create several claimed accounts in one Keychain batch', icon: 'fact_check', path: '/create/batch', keywords: 'batch claim account token sponsor' },
  { label: 'Buy a Hive account', category: 'Create', description: 'Pay Hivedex in crypto and keep your keys', icon: 'paid', path: '/join/hivedex', keywords: 'buy paid crypto hivedex signup account' },

  // Wallet
  { label: 'Orders', category: 'Wallet', description: 'Purchases, sales and subscriptions', icon: 'history', path: '/orders', keywords: 'orders purchases sales receipts memberships' },
  { label: 'Cart', category: 'Wallet', description: 'Items waiting to be paid for', icon: 'shopping_cart', path: '/cart', keywords: 'cart basket checkout shopping' },
  { label: 'Checkout', category: 'Wallet', description: 'Review and pay for your cart', icon: 'point_of_sale', path: '/checkout', keywords: 'checkout pay cart basket' },
  { label: 'Subscriptions', category: 'Wallet', description: 'Blog memberships and recurring HBD payments', icon: 'autorenew', path: '/subscriptions', keywords: 'subscriptions memberships recurring vault hbd' },

  // Settings
  { label: 'Appearance', category: 'Settings', description: 'Themes, comfort options and profile skins', icon: 'palette', path: '/appearance', keywords: 'appearance theme dark light night day preferences contrast motion skins' },
  { label: 'Theme wall', category: 'Settings', description: 'Browse looks published from the Hive', icon: 'collections', path: '/themes', keywords: 'themes wall looks palettes skins' },
  { label: 'Skin studio', category: 'Settings', description: 'Build and publish a profile skin', icon: 'brush', path: '/settings/skin', keywords: 'skin studio profile customise design' },
  { label: 'Moderation', category: 'Settings', description: 'Local moderation policy and overrides', icon: 'shield', path: '/settings/moderation', keywords: 'moderation muted blocked policy filters' },
  { label: 'Blog settings', category: 'Settings', description: 'Claim or customise your username.banksia.io page', icon: 'web', path: '/settings/blog', keywords: 'blog settings claim domain theme reading page' },
  { label: 'Vault dashboard', category: 'Settings', description: 'Membership payments, grants and reader keys', icon: 'lock', path: '/settings/blog/vault', keywords: 'vault dashboard membership payments grants creator' },
  { label: 'About Banksia', category: 'Settings', description: 'Name, mark, source and credits', icon: 'help_outline', path: '/about', keywords: 'about info source credits license' }
]

const CATEGORY_ORDER = ['You', 'Explore', 'Chain', 'Create', 'Wallet', 'Settings', 'Actions']

function wordsOf (text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function hasEveryWord (haystack, words) {
  return words.every(word => haystack.some(candidate => candidate.startsWith(word)))
}

/**
 * Match score for a command against the lowercase query. Lower is better and
 * -1 means no match. Label matches rank above description and keyword matches
 * so that "blog" offers Blogs and Blog settings before a page that merely
 * mentions it. Multi-word queries match when every word appears somewhere, so
 * "join keys" and "toggle theme" still find the right command.
 */
export function commandScore (command, query) {
  const label = String(command.label || '').toLowerCase()
  const description = String(command.description || '').toLowerCase()
  const keywords = String(command.keywords || '').toLowerCase()
  const words = wordsOf(query)
  if (!words.length) return -1
  const hayWords = wordsOf(label + ' ' + description + ' ' + keywords)
  if (!hasEveryWord(hayWords, words)) return -1
  if (label.startsWith(query)) return 0
  if (label.includes(query)) return 1
  if (hasEveryWord(wordsOf(label), words)) return 1
  if (description.includes(query)) return 2
  if (hasEveryWord(wordsOf(description), words)) return 2
  return 3
}

export function rankCommands (commands, query) {
  return commands
    .map(command => ({ command, score: commandScore(command, query) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.command)
}

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
      if (!query) return COMMANDS.filter(command => command.featured)
      return rankCommands(COMMANDS, query)
    },
    personalResults () {
      if (!this.loggedInUser) return []
      const user = this.loggedInUser
      const items = [
        { path: '/compose', label: 'New post', description: 'Draft locally and publish', icon: 'edit_note', keywords: 'write create compose' },
        { path: '/@' + user, label: 'My profile', description: 'Account overview', icon: 'person', keywords: 'me account profile' },
        { path: '/@' + user + '/wallet', label: 'My wallet', description: 'Balances and transactions', icon: 'account_balance_wallet', keywords: 'wallet balances transfers' },
        { path: '/@' + user + '/blog', label: 'My blog', description: 'Posts and reblogs', icon: 'menu_book', keywords: 'blog posts' },
        { path: '/@' + user + '/feed', label: 'My feed', description: 'Posts from accounts I follow', icon: 'rss_feed', keywords: 'feed following timeline' },
        { path: '/@' + user + '/replies', label: 'My replies', description: 'Recent replies I published', icon: 'reply', keywords: 'replies comments' },
        { path: '/settings/blog', label: 'Blog settings', description: 'Claim or customise my reading page', icon: 'web', keywords: 'blog settings claim domain' },
        { path: '/settings/blog/vault', label: 'Vault dashboard', description: 'Membership payments, grants and reader keys', icon: 'lock', keywords: 'vault memberships payments grants creator' },
        { path: '/orders', label: 'My orders', description: 'Purchases, sales and subscriptions', icon: 'history', keywords: 'orders purchases sales receipts' },
        { path: '/subscriptions', label: 'My subscriptions', description: 'Blog memberships and recurring HBD payments', icon: 'autorenew', keywords: 'subscriptions memberships recurring vault' }
      ].map(item => ({ ...item, category: 'You' }))
      const query = this.query.trim().toLowerCase()
      if (!query) return items
      return rankCommands(items, query)
    },
    actionResults () {
      const items = [
        { id: 'action-settings', label: 'Open settings', description: 'Theme, voting, images, network and SmartLock', icon: 'settings', keywords: 'settings preferences options config', action: 'settings' },
        { id: 'action-toggle-theme', label: 'Toggle light and dark theme', description: 'Switch the site between light and dark', icon: 'contrast', keywords: 'toggle switch theme dark light mode night day appearance', action: 'toggle-theme' },
        { id: 'action-copy-link', label: 'Copy link to this page', description: 'Put the current URL on your clipboard', icon: 'link', keywords: 'copy share link url clipboard current page', action: 'copy-link' },
        { id: 'action-shortcuts', label: 'Keyboard shortcuts', description: 'Show every keyboard shortcut', icon: 'keyboard', keywords: 'keyboard shortcuts keys help', action: 'shortcuts' }
      ]
      if (!this.loggedInUser) {
        items.unshift({ id: 'action-sign-in', label: 'Sign in', description: 'Keychain, HiveAuth or SmartLock', icon: 'login', keywords: 'sign in login keychain hiveauth smartlock account', action: 'sign-in' })
      }
      const enriched = items.map(item => ({ ...item, category: 'Actions' }))
      const query = this.query.trim().toLowerCase()
      if (!query) return enriched
      return rankCommands(enriched, query)
    },
    searchQuery () {
      return this.query.trim().length >= 2
    },
    /**
     * When the query clearly names a page, show page results above the
     * account/tag jumps. Explicit `@account`, `#tag`, block and URL queries
     * still lead with their direct jump.
     */
    commandsFirst () {
      const query = this.query.trim().toLowerCase()
      if (!query || /^[@#]|^\d|^https?:\/\/|^(?:proposal|tx|block)\s/.test(query)) return false
      return this.commandResults.length > 0 || this.actionResults.length > 0
    },
    groups () {
      const used = new Set()
      let index = 0
      const addGroup = (label, items) => {
        const filtered = []
        for (const item of items) {
          if (!item) continue
          const key = item.id || item.path
          if (!key || used.has(key)) continue
          used.add(key)
          filtered.push({ ...item, index: index++ })
        }
        return filtered.length ? { label, items: filtered } : null
      }

      const commandGroups = new Map()
      const commandItems = [...this.personalResults, ...this.commandResults, ...this.actionResults]
      for (const item of commandItems) {
        const category = item.category || 'Commands'
        if (!commandGroups.has(category)) commandGroups.set(category, [])
        commandGroups.get(category).push(item)
      }
      const query = this.query.trim().toLowerCase()
      let orderedCategories
      if (this.commandsFirst) {
        for (const items of commandGroups.values()) {
          items.sort((a, b) => commandScore(a, query) - commandScore(b, query))
        }
        orderedCategories = [...commandGroups.keys()].sort((a, b) =>
          commandScore(commandGroups.get(a)[0], query) - commandScore(commandGroups.get(b)[0], query)
        )
      } else {
        orderedCategories = [
          ...CATEGORY_ORDER.filter(category => commandGroups.has(category)),
          ...[...commandGroups.keys()].filter(category => !CATEGORY_ORDER.includes(category))
        ]
      }
      const pageGroups = orderedCategories
        .map(category => addGroup(category, commandGroups.get(category)))
        .filter(Boolean)
      const jumpGroup = addGroup('Jump to', this.dynamicResults)
      const recentGroup = addGroup('Recent', this.query.trim() ? [] : this.recent)

      return this.commandsFirst
        ? [...pageGroups, jumpGroup, recentGroup].filter(Boolean)
        : [jumpGroup, recentGroup, ...pageGroups].filter(Boolean)
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
      this.query = ''
      if (result.action) {
        this.runAction(result.action)
        return
      }
      this.saveRecent(result)
      this.$router.push(result.path).catch(() => {})
    },
    runAction (action) {
      if (action === 'toggle-theme') {
        this.$appearance.setTheme(this.$appearance.isDark ? 'hive-light' : 'hive-dark')
        return
      }
      if (action === 'settings') {
        window.dispatchEvent(new CustomEvent('hive:open-settings'))
        return
      }
      if (action === 'shortcuts') {
        window.dispatchEvent(new CustomEvent('hive:open-shortcuts'))
        return
      }
      if (action === 'copy-link') {
        const url = window.location.href
        const done = () => this.$q.notify({ type: 'positive', message: 'Page link copied', position: 'top' })
        const fail = () => this.$q.notify({ type: 'negative', message: 'Could not copy the link', position: 'top' })
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, fail)
        else fail()
        return
      }
      if (action === 'sign-in') {
        window.dispatchEvent(new CustomEvent('banksia:open-login'))
      }
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
