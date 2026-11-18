<template>
  <q-page class="communities-page">
    <account-header :globalProps="globalProps" :account="account" :showBalances="false" />

    <div v-if="error && !loading" class="communities-shell">
      <q-card flat bordered class="communities-state">
        <q-icon name="error_outline" size="2.2em" color="orange" aria-hidden="true" />
        <h1 class="communities-state__title">Communities unavailable</h1>
        <p>{{ error }}</p>
        <q-btn outline no-caps color="primary" icon="refresh" label="Try again" @click="load({ force: true })" />
      </q-card>
    </div>

    <div v-else class="communities-shell">
      <header class="communities-head">
        <div class="communities-head__text">
          <div class="home-eyebrow">Communities</div>
          <h1 class="page-title">
            <template v-if="isSelf">Communities you belong to</template>
            <template v-else>Communities @{{ username }} belongs to</template>
          </h1>
          <p class="page-intro">
            <template v-if="isSelf">Every community this account owns, moderates or follows, with a feed drawn from all of them.</template>
            <template v-else>The communities this account owns, moderates or follows, straight from the Hive blockchain.</template>
          </p>
        </div>
        <div class="communities-head__actions">
          <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="load({ force: true })" />
          <q-btn v-if="isSelf" outline no-caps color="primary" icon="rss_feed" label="My full feed" to="/created/my" />
          <q-btn v-else-if="!loading && cards.length" outline no-caps color="primary" icon="forum" label="Hive communities" to="/browse" />
        </div>
      </header>

      <section v-if="loading && !cards.length" class="communities-stats" aria-label="Loading community summary">
        <q-card v-for="i in 4" :key="i" flat bordered class="communities-stat">
          <q-skeleton type="text" width="45%" />
          <q-skeleton type="text" width="70%" />
        </q-card>
      </section>

      <section v-else-if="cards.length" class="communities-stats" aria-label="Community summary">
        <div class="communities-stat">
          <span class="communities-stat__label">Communities</span>
          <strong class="communities-stat__value">{{ formatNumber(cards.length) }}</strong>
          <small class="communities-stat__hint">{{ roleSummary }}</small>
        </div>
        <div class="communities-stat">
          <span class="communities-stat__label">Subscribers</span>
          <strong class="communities-stat__value">{{ formatNumber(totals.subscribers) }}</strong>
          <small class="communities-stat__hint">combined across all communities</small>
        </div>
        <div class="communities-stat">
          <span class="communities-stat__label">Active authors</span>
          <strong class="communities-stat__value">{{ formatNumber(totals.authors) }}</strong>
          <small class="communities-stat__hint">with recent posts in these communities</small>
        </div>
        <div class="communities-stat">
          <span class="communities-stat__label">Pending payouts</span>
          <strong class="communities-stat__value">{{ formatHbd(totals.pendingRewards) }}</strong>
          <small class="communities-stat__hint">awaiting the next payout window</small>
        </div>
      </section>

      <div v-if="!loading && !cards.length" class="communities-empty">
        <q-card flat bordered class="communities-state">
          <q-icon name="forum" size="2.2em" aria-hidden="true" />
          <h2 class="communities-state__title">No community subscriptions</h2>
          <p>
            <template v-if="isSelf">Join a community from its page and it will show up here with its own card and feed.</template>
            <template v-else>@{{ username }} has not joined any Hive communities yet.</template>
          </p>
          <q-btn outline no-caps color="primary" icon="explore" label="Browse Hive posts" to="/browse" />
        </q-card>
      </div>

      <template v-else>
        <div class="communities-layout">
          <aside class="communities-sidebar" aria-label="Community filters">
            <section class="communities-filter">
              <div class="home-eyebrow">Filter</div>
              <div class="communities-filter__chips" role="group" aria-label="Filter communities by role">
                <button
                  v-for="option in roleOptions"
                  :key="option.value"
                  type="button"
                  class="communities-chip"
                  :class="{ 'communities-chip--active': role === option.value }"
                  :aria-pressed="role === option.value"
                  :disabled="option.count === 0"
                  @click="role = option.value"
                >
                  {{ option.label }}
                  <span class="communities-chip__count">{{ option.count }}</span>
                </button>
              </div>
            </section>

            <section v-if="cards.length" class="communities-filter">
              <div class="home-eyebrow">Search</div>
              <q-input
                v-model="query"
                dense
                outlined
                clearable
                label="Find a community"
                aria-label="Filter communities by name"
                autocomplete="off"
              >
                <template #prepend>
                  <q-icon name="search" size="18px" aria-hidden="true" />
                </template>
              </q-input>
            </section>

            <section class="communities-filter">
              <div class="home-eyebrow">Sort</div>
              <div class="communities-filter__list" role="group" aria-label="Sort communities">
                <button
                  v-for="option in sortOptions"
                  :key="option.value"
                  type="button"
                  class="communities-sort"
                  :class="{ 'communities-sort--active': sort === option.value }"
                  :aria-pressed="sort === option.value"
                  @click="sort = option.value"
                >
                  <q-icon :name="option.icon" size="15px" aria-hidden="true" />
                  {{ option.label }}
                </button>
              </div>
            </section>
          </aside>

          <div class="communities-main">
            <section aria-labelledby="communities-cards-title">
              <div class="communities-section__head">
                <div>
                  <div class="home-eyebrow">Directory</div>
                  <h2 id="communities-cards-title" class="communities-section__title">
                    {{ visibleCards.length }} {{ visibleCards.length === 1 ? 'community' : 'communities' }}
                  </h2>
                </div>
                <span v-if="filtersActive" class="communities-section__hint">
                  <q-btn flat dense no-caps icon="filter_alt_off" label="Clear filter" @click="clearFilters" />
                </span>
              </div>

              <div v-if="visibleCards.length" class="communities-grid">
                <community-card v-for="card in visibleCards" :key="card.name" :card="card" />
              </div>
              <q-card v-else flat bordered class="communities-state">
                <q-icon name="search_off" size="1.8em" aria-hidden="true" />
                <p>No community matches this filter.</p>
                <q-btn flat no-caps color="primary" label="Clear filter" @click="clearFilters" />
              </q-card>
            </section>

            <home-recent-posts v-if="isSelf" :account="username" />

            <community-feed
              :tag="feedTag"
              :observer="isSelf ? null : username"
              :directory="feedDirectory"
              :heading="feedHeading"
              :empty-message="feedEmptyMessage"
              class="communities-feed"
            />
          </div>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script>
import accountHeader from 'components/accountHeader.vue'
import CommunityCard from 'components/community/CommunityCard.vue'
import CommunityFeed from 'components/community/CommunityFeed.vue'
import HomeRecentPosts from 'components/HomeRecentPosts.vue'
import { buildCommunityCards } from 'src/services/community'
import { fetchAccountSubscriptions, fetchCommunityInfoBatch } from 'src/services/chainData'
import { setPageMeta } from 'src/utils/pageMeta'

const ROLE_ORDER = ['owner', 'admin', 'mod', 'member', 'guest']

const ROLE_LABELS = {
  owner: 'Owns',
  admin: 'Admins',
  mod: 'Moderates',
  member: 'Member of',
  guest: 'Guest of'
}

const SORT_OPTIONS = [
  { value: 'role', label: 'My role', icon: 'workspace_premium' },
  { value: 'subscribers', label: 'Subscribers', icon: 'groups' },
  { value: 'authors', label: 'Active authors', icon: 'edit_note' },
  { value: 'rewards', label: 'Pending rewards', icon: 'payments' },
  { value: 'name', label: 'Name', icon: 'sort_by_alpha' }
]

export default {
  name: 'AccountCommunitiesPage',
  components: {
    accountHeader,
    CommunityCard,
    CommunityFeed,
    HomeRecentPosts
  },
  data () {
    return {
      username: this.$route.params.account || this.$route.params.username,
      loading: false,
      error: '',
      cards: [],
      role: 'all',
      query: '',
      sort: 'role',
      sortOptions: SORT_OPTIONS
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    isSelf () {
      return Boolean(this.loggedInUser) && this.loggedInUser === this.username
    },
    feedTag () {
      return 'my'
    },
    feedDirectory () {
      return this.cards.map(card => [card.name, card.title, card.role, ''])
    },
    feedHeading () {
      return this.isSelf ? 'Your community feed' : 'Community feed'
    },
    feedEmptyMessage () {
      return this.isSelf
        ? 'No posts from your communities yet — join one and it will appear here.'
        : 'No community posts found right now.'
    },
    roleOptions () {
      const counts = {}
      for (const card of this.cards) {
        counts[card.role] = (counts[card.role] || 0) + 1
      }
      return [
        { value: 'all', label: 'All', count: this.cards.length },
        ...ROLE_ORDER
          .filter(role => counts[role])
          .map(role => ({ value: role, label: ROLE_LABELS[role], count: counts[role] }))
      ]
    },
    roleSummary () {
      const parts = []
      for (const role of ROLE_ORDER) {
        const count = this.roleOptions.find(option => option.value === role)?.count || 0
        if (count) parts.push(ROLE_LABELS[role].toLowerCase() + ' ' + count)
      }
      return parts.length ? parts.join(' · ') : 'no subscriptions yet'
    },
    totals () {
      return this.cards.reduce((acc, card) => ({
        subscribers: acc.subscribers + card.subscribers,
        authors: acc.authors + card.authors,
        pendingRewards: acc.pendingRewards + card.pendingRewards
      }), { subscribers: 0, authors: 0, pendingRewards: 0 })
    },
    filtersActive () {
      return this.role !== 'all' || Boolean(this.query.trim())
    },
    visibleCards () {
      const needle = this.query.trim().toLowerCase()
      const filtered = this.cards.filter(card => {
        if (this.role !== 'all' && card.role !== this.role) return false
        if (!needle) return true
        return card.title.toLowerCase().includes(needle) ||
          card.name.toLowerCase().includes(needle) ||
          card.about.toLowerCase().includes(needle)
      })
      const sorted = [...filtered]
      switch (this.sort) {
        case 'subscribers':
          sorted.sort((a, b) => b.subscribers - a.subscribers || a.title.localeCompare(b.title))
          break
        case 'authors':
          sorted.sort((a, b) => b.authors - a.authors || a.title.localeCompare(b.title))
          break
        case 'rewards':
          sorted.sort((a, b) => b.pendingRewards - a.pendingRewards || a.title.localeCompare(b.title))
          break
        case 'name':
          sorted.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
          break
        default:
          break
      }
      return sorted
    }
  },
  watch: {
    '$route.params.account' () {
      this.syncUsername()
    },
    '$route.params.username' () {
      this.syncUsername()
    }
  },
  methods: {
    syncUsername () {
      const next = this.$route.params.account || this.$route.params.username
      if (!next || next === this.username) return
      this.username = next
      this.cards = []
      this.role = 'all'
      this.query = ''
      this.load()
    },
    formatNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0'
      return number.toLocaleString('en-US', { maximumFractionDigits: 0 })
    },
    formatHbd (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0 HBD'
      return number.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' HBD'
    },
    clearFilters () {
      this.role = 'all'
      this.query = ''
    },
    async load ({ force = false } = {}) {
      this.loading = true
      this.error = ''
      try {
        const subscriptions = await fetchAccountSubscriptions(this.username, { force })
        const stats = await this.loadStats(subscriptions, force)
        if (!this.isCurrentAccount()) return
        this.cards = buildCommunityCards(subscriptions, stats)
        if (this.isSelf) {
          this.$hiveStore.user.communities = subscriptions.map(row => [row.name, row.title, row.role, row.guestTitle])
        }
      } catch (error) {
        console.error('Failed to load community subscriptions', error)
        if (!this.isCurrentAccount()) return
        this.error = 'Could not load the communities for @' + this.username + '.'
      } finally {
        if (this.isCurrentAccount()) {
          this.loading = false
          this.updatePageMeta()
        }
      }
    },
    isCurrentAccount () {
      return this.username === (this.$route.params.account || this.$route.params.username)
    },
    async loadStats (subscriptions, force) {
      if (!subscriptions.length) return {}
      const titles = new Map(subscriptions.map(row => [row.name, row.title]))
      try {
        return await fetchCommunityInfoBatch(subscriptions.map(row => row.name), {
          force,
          titleFor: name => titles.get(name) || name
        })
      } catch {
        // Cards still render from subscription rows without live stats.
        return {}
      }
    },
    updatePageMeta () {
      const name = this.username
      const cards = this.cards
      const count = cards.length
      const title = '@' + name + ' communities — Hive community directory'
      const description = count
        ? '@' + name + ' belongs to ' + count + ' Hive ' + (count === 1 ? 'community' : 'communities') +
          ', including ' + cards.slice(0, 3).map(card => card.title).join(', ') + ' — with a merged community feed.'
        : '@' + name + ' community subscriptions and community posts on the Hive blockchain.'
      setPageMeta({
        title,
        description,
        url: '/@' + name + '/communities',
        image: 'https://images.hive.blog/u/' + name + '/avatar',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          description,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: count,
            itemListElement: cards.slice(0, 10).map((card, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: card.title,
              url: 'https://hive.ausbit.dev/c/' + card.name
            }))
          }
        }
      })
    }
  },
  mounted () {
    if (this.globalProps && this.globalProps.empty) this.$hiveStore.getGlobalProps()
    if (this.account === undefined) this.$hiveStore.getAccount(this.username)
    this.load()
  }
}
</script>

<style scoped>
.communities-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.communities-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.communities-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.communities-head__text {
  min-width: 0;
}

.communities-head__text .page-intro {
  margin-left: 0;
}

.communities-head__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.communities-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-3);
}

.communities-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.028);
}

.communities-stat__label {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.communities-stat__value {
  color: #e4eaed;
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.communities-stat__hint {
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.35;
}

.communities-layout {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
}

.communities-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  position: sticky;
  top: calc(var(--space-4) + 12px);
}

.communities-filter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02);
}

.communities-filter__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.communities-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: transparent;
  color: #b0bec5;
  font: inherit;
  font-size: 0.74rem;
  cursor: pointer;
}

.communities-chip:hover:not(:disabled) {
  border-color: rgba(79, 195, 247, 0.4);
  color: #e4eaed;
}

.communities-chip--active {
  border-color: rgba(79, 195, 247, 0.45);
  background: rgba(79, 195, 247, 0.14);
  color: #81d4fa;
}

.communities-chip:disabled {
  opacity: 0.35;
  cursor: default;
}

.communities-chip__count {
  color: #78909c;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.communities-filter__list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.communities-sort {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.4rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #b0bec5;
  font: inherit;
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}

.communities-sort:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #e4eaed;
}

.communities-sort--active {
  border-color: rgba(79, 195, 247, 0.35);
  background: rgba(79, 195, 247, 0.1);
  color: #81d4fa;
}

.communities-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.communities-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.communities-section__title {
  margin: 0.15rem 0 0;
  color: #e4eaed;
  font-size: 1.08rem;
  font-weight: 600;
  line-height: 1.25;
}

.communities-section__hint {
  color: #78909c;
  font-size: 0.74rem;
}

.communities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 390px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.communities-feed {
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}

.communities-empty,
.communities-state {
  min-width: 0;
}

.communities-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.communities-state p {
  margin: 0;
  max-width: 52ch;
  font-size: 0.86rem;
  line-height: 1.5;
}

.communities-state__title {
  margin: 0;
  color: #e4eaed;
  font-size: 1.05rem;
  font-weight: 600;
}

@media (max-width: 1023px) {
  .communities-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .communities-sidebar {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .communities-filter {
    flex: 1 1 220px;
  }
}

@media (max-width: 599px) {
  .communities-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .communities-sidebar {
    flex-direction: column;
  }

  .communities-filter {
    flex-basis: auto;
  }

  .communities-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
