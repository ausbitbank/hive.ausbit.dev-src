<template>
  <q-page class="community-index-page">
    <div class="community-index-shell">
      <header class="community-index-head">
        <div class="community-index-head__text">
          <div class="home-eyebrow">Communities</div>
          <h1 class="page-title">Discover Hive communities</h1>
          <p class="page-intro">
            Browse and search every Hive community by topic, subscribers and recent activity — no account or subscription needed.
          </p>
        </div>
        <div class="community-index-head__actions">
          <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="refresh" />
          <q-btn
            v-if="loggedInUser"
            outline
            no-caps
            color="primary"
            icon="groups"
            label="My communities"
            :to="'/@' + loggedInUser + '/communities'"
          />
        </div>
      </header>

      <section v-if="loading && !cards.length" class="community-index-stats" aria-label="Loading community summary">
        <q-card v-for="i in 4" :key="i" flat bordered class="community-index-stat">
          <q-skeleton type="text" width="45%" />
          <q-skeleton type="text" width="70%" />
        </q-card>
      </section>

      <section v-else-if="cards.length" class="community-index-stats" aria-label="Loaded community summary">
        <div class="community-index-stat">
          <span class="community-index-stat__label">Loaded communities</span>
          <strong class="community-index-stat__value">{{ formatNumber(summary.communities) }}</strong>
          <small class="community-index-stat__hint">{{ hasMore ? 'more load as you scroll' : 'end of the directory' }}</small>
        </div>
        <div class="community-index-stat">
          <span class="community-index-stat__label">Subscribers</span>
          <strong class="community-index-stat__value">{{ formatNumber(summary.subscribers) }}</strong>
          <small class="community-index-stat__hint">combined across loaded communities</small>
        </div>
        <div class="community-index-stat">
          <span class="community-index-stat__label">Active authors</span>
          <strong class="community-index-stat__value">{{ formatNumber(summary.authors) }}</strong>
          <small class="community-index-stat__hint">recent authors in loaded communities</small>
        </div>
        <div class="community-index-stat">
          <span class="community-index-stat__label">Pending payouts</span>
          <strong class="community-index-stat__value">{{ formatHbd(summary.pendingRewards) }}</strong>
          <small class="community-index-stat__hint">awaiting the next payout window</small>
        </div>
      </section>

      <div class="community-index-layout">
        <aside class="community-index-sidebar" aria-label="Community filters">
          <section class="community-index-filter">
            <div class="home-eyebrow">Search</div>
            <q-input
              v-model="query"
              dense
              outlined
              clearable
              debounce="0"
              label="Search communities"
              aria-label="Search Hive communities by title or description"
              autocomplete="off"
              @update:model-value="scheduleSearch"
            >
              <template #prepend>
                <q-icon name="search" size="18px" aria-hidden="true" />
              </template>
            </q-input>
            <p class="community-index-filter__hint">
              Matches community titles and descriptions. Paste a <code>hive-123456</code> name to jump straight to it.
            </p>
          </section>

          <section class="community-index-filter">
            <div class="home-eyebrow">Categories</div>
            <div class="community-index-chips" role="group" aria-label="Browse communities by category">
              <button
                type="button"
                class="community-index-chip"
                :class="{ 'community-index-chip--active': !query.trim() }"
                :aria-pressed="!query.trim()"
                @click="selectCategory(null)"
              >
                All
              </button>
              <button
                v-for="category in categories"
                :key="category.value"
                type="button"
                class="community-index-chip"
                :class="{ 'community-index-chip--active': activeCategory?.value === category.value }"
                :aria-pressed="activeCategory?.value === category.value"
                @click="selectCategory(category)"
              >
                {{ category.label }}
              </button>
            </div>
            <p class="community-index-filter__hint">Categories search community titles and descriptions.</p>
          </section>

          <section class="community-index-filter">
            <div class="home-eyebrow">Sort</div>
            <div class="community-index-sorts" role="group" aria-label="Sort communities">
              <button
                v-for="option in sortOptions"
                :key="option.value"
                type="button"
                class="community-index-sort"
                :class="{ 'community-index-sort--active': sort === option.value }"
                :aria-pressed="sort === option.value"
                @click="changeSort(option.value)"
              >
                <q-icon :name="option.icon" size="15px" aria-hidden="true" />
                {{ option.label }}
              </button>
            </div>
            <p v-if="sort === 'active'" class="community-index-filter__hint">
              Active authors sorts the communities loaded so far. Load more to widen the sample.
            </p>
          </section>

          <section class="community-index-filter">
            <div class="home-eyebrow">Safety</div>
            <q-toggle
              v-model="hideNsfw"
              dense
              color="primary"
              label="Hide NSFW communities"
              left-label
            />
          </section>
        </aside>

        <div class="community-index-main">
          <div class="community-index-section__head">
            <div>
              <div class="home-eyebrow">Directory</div>
              <h2 class="community-index-section__title">
                {{ visibleCards.length }} {{ visibleCards.length === 1 ? 'community' : 'communities' }}
              </h2>
              <small class="community-index-section__hint">
                <template v-if="query.trim()">matching “{{ query.trim() }}” · </template>
                <template v-if="hasMore">more load as you scroll</template>
                <template v-else>all results loaded</template>
              </small>
            </div>
            <q-btn
              v-if="filtersActive"
              flat
              dense
              no-caps
              icon="filter_alt_off"
              label="Clear filters"
              @click="clearFilters"
            />
          </div>

          <q-card v-if="error && !cards.length" flat bordered class="community-index-state">
            <q-icon name="error_outline" size="2.2em" color="orange" aria-hidden="true" />
            <h2 class="community-index-state__title">Communities unavailable</h2>
            <p>{{ error }}</p>
            <q-btn outline no-caps color="primary" icon="refresh" label="Try again" @click="refresh" />
          </q-card>

          <div v-else-if="loading && !cards.length" class="community-index-grid" aria-label="Loading communities">
            <q-card v-for="i in 6" :key="i" flat bordered class="community-index-skeleton">
              <div class="community-index-skeleton__row">
                <q-skeleton type="rect" width="52px" height="52px" />
                <div class="community-index-skeleton__text">
                  <q-skeleton type="text" width="55%" />
                  <q-skeleton type="text" width="35%" />
                </div>
              </div>
              <q-skeleton type="text" />
              <q-skeleton type="text" width="80%" />
            </q-card>
          </div>

          <q-card v-else-if="!visibleCards.length" flat bordered class="community-index-state">
            <q-icon name="search_off" size="1.8em" aria-hidden="true" />
            <h2 class="community-index-state__title">{{ query.trim() ? 'No matching communities' : 'No communities found' }}</h2>
            <p v-if="hideNsfw && cards.length">
              NSFW communities are hidden by your safety filter.
            </p>
            <p v-else-if="query.trim()">
              Nothing matched “{{ query.trim() }}”. Try a shorter title, a different category, or a <code>hive-123456</code> community name.
            </p>
            <p v-else>
              The community directory did not return any results. Try refreshing in a moment.
            </p>
            <div class="community-index-state__actions">
              <q-btn v-if="filtersActive" flat no-caps color="primary" icon="filter_alt_off" label="Clear filters" @click="clearFilters" />
              <q-btn v-if="hasMore" outline no-caps color="primary" icon="expand_more" label="Load more" :loading="loadingMore" @click="loadMore" />
              <q-btn outline no-caps color="primary" icon="refresh" label="Refresh" @click="refresh" />
            </div>
          </q-card>

          <template v-else>
            <q-banner v-if="error" dense rounded class="community-index-banner">
              {{ error }}
              <template #action>
                <q-btn flat dense no-caps color="primary" label="Retry" @click="loadMore" />
              </template>
            </q-banner>

            <infinite-scroll :can-load="hasMore" :loading="loadingMore" @load="loadMore">
              <div class="community-index-grid">
                <community-card v-for="card in visibleCards" :key="card.name" :card="card" />
              </div>
              <template #done>
                <span class="community-index-end">
                  All {{ cards.length }} loaded {{ cards.length === 1 ? 'community' : 'communities' }} shown.
                </span>
              </template>
            </infinite-scroll>
          </template>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import CommunityCard from 'components/community/CommunityCard.vue'
import InfiniteScroll from 'components/ui/InfiniteScroll.vue'
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_SORTS,
  buildDirectoryCards,
  directoryCategory,
  isHiveCommunityName,
  sortDirectoryCards,
  summarizeDirectory
} from 'src/services/communityDirectory'
import { fetchCommunity, fetchCommunityDirectoryPage } from 'src/services/chainData'
import { setPageMeta } from 'src/utils/pageMeta'

const PAGE_SIZE = 36
const SEARCH_DELAY_MS = 320
const SORT_VALUES = COMMUNITY_SORTS.map(option => option.value)

export default {
  name: 'CommunityIndexPage',
  components: {
    CommunityCard,
    InfiniteScroll
  },
  data () {
    return {
      query: '',
      sort: 'rank',
      hideNsfw: false,
      categories: COMMUNITY_CATEGORIES,
      sortOptions: COMMUNITY_SORTS,
      cards: [],
      cursor: '',
      hasMore: true,
      loading: false,
      loadingMore: false,
      error: '',
      loadToken: 0,
      searchTimer: null
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    serverSort () {
      return this.sort === 'active' ? 'rank' : this.sort
    },
    activeCategory () {
      return directoryCategory(this.query)
    },
    filtersActive () {
      return Boolean(this.query.trim()) || this.hideNsfw
    },
    summary () {
      return summarizeDirectory(this.cards)
    },
    visibleCards () {
      const list = this.hideNsfw
        ? this.cards.filter(card => !card.nsfw)
        : this.cards
      return sortDirectoryCards(list, this.sort)
    }
  },
  watch: {
    '$route.query' (value) {
      const nextQuery = String(value?.q || '').trim()
      const nextSort = SORT_VALUES.includes(value?.sort) ? value.sort : 'rank'
      if (nextQuery === this.query && nextSort === this.sort) return
      this.query = nextQuery
      this.sort = nextSort
      this.load({ reset: true })
    }
  },
  methods: {
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
    scheduleSearch () {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null
        this.search()
      }, SEARCH_DELAY_MS)
    },
    search () {
      const next = String(this.query || '').trim()
      this.syncUrl(next)
      this.load({ reset: true })
    },
    selectCategory (category) {
      const next = category ? category.query : ''
      if (String(this.query || '').trim().toLowerCase() === next) return
      clearTimeout(this.searchTimer)
      this.query = next
      this.syncUrl(next)
      this.load({ reset: true })
    },
    changeSort (value) {
      if (this.sort === value) return
      this.sort = value
      this.syncUrl(this.query.trim())
      this.load({ reset: true })
    },
    clearFilters () {
      clearTimeout(this.searchTimer)
      this.query = ''
      this.hideNsfw = false
      this.syncUrl('')
      this.load({ reset: true })
    },
    syncUrl (nextQuery) {
      const query = { ...this.$route.query }
      if (nextQuery) query.q = nextQuery
      else delete query.q
      if (this.sort !== 'rank') query.sort = this.sort
      else delete query.sort

      const currentQuery = String(this.$route.query.q || '').trim()
      const currentSort = SORT_VALUES.includes(this.$route.query.sort) ? this.$route.query.sort : 'rank'
      if (currentQuery === String(query.q || '').trim() && currentSort === (query.sort || 'rank')) return
      this.$router.replace({ name: 'communities', query }).catch(() => {})
    },
    refresh () {
      this.load({ reset: true, force: true })
    },
    loadMore () {
      this.load()
    },
    async load ({ reset = false, force = false } = {}) {
      if (!reset && (!this.hasMore || this.loading || this.loadingMore)) return
      const token = ++this.loadToken

      if (reset) {
        this.cards = []
        this.cursor = ''
        this.hasMore = true
        this.loading = true
        this.loadingMore = false
        this.error = ''
      } else {
        this.loadingMore = true
        this.error = ''
      }

      try {
        const needle = this.query.trim()
        const exactName = reset && isHiveCommunityName(needle) ? needle.toLowerCase() : ''
        const [page, exact] = await Promise.all([
          fetchCommunityDirectoryPage({
            sort: this.serverSort,
            query: needle,
            last: reset ? '' : this.cursor,
            limit: PAGE_SIZE,
            force
          }),
          exactName
            ? fetchCommunity(exactName, null, { force }).catch(() => null)
            : Promise.resolve(null)
        ])
        if (token !== this.loadToken) return

        const rows = exact?.name
          ? [exact, ...page.filter(row => row.name !== exact.name)]
          : page
        const batch = buildDirectoryCards(rows)
        const seen = new Set(reset ? [] : this.cards.map(card => card.name))
        const fresh = batch.filter(card => !seen.has(card.name))

        this.cards = reset ? fresh : [...this.cards, ...fresh]
        this.cursor = page.length ? page[page.length - 1].name : this.cursor
        this.hasMore = page.length >= PAGE_SIZE
        this.updatePageMeta()
      } catch (error) {
        if (token !== this.loadToken) return
        console.error('Failed to load the community directory', error)
        this.error = this.cards.length
          ? 'Could not load more communities.'
          : 'Could not load the Hive community directory.'
      } finally {
        if (token === this.loadToken) {
          this.loading = false
          this.loadingMore = false
        }
      }
    },
    updatePageMeta () {
      const count = this.cards.length
      const title = 'Hive communities — discover and browse the Hive community directory'
      const description = 'Browse and search Hive communities by topic, subscribers and recent activity. ' +
        'Find a community to read or post in, with no account or subscription needed.'
      setPageMeta({
        title,
        description,
        url: '/communities',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          description,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: count,
            itemListElement: this.cards.slice(0, 10).map((card, index) => ({
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
    this.query = String(this.$route.query.q || '').trim()
    this.sort = SORT_VALUES.includes(this.$route.query.sort) ? this.$route.query.sort : 'rank'
    if (this.globalProps && this.globalProps.empty) this.$hiveStore.getGlobalProps()
    this.updatePageMeta()
    this.load({ reset: true })
  },
  beforeUnmount () {
    clearTimeout(this.searchTimer)
  }
}
</script>

<style scoped>
.community-index-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.community-index-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.community-index-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.community-index-head__text {
  min-width: 0;
}

.community-index-head__text .page-intro {
  margin-left: 0;
}

.community-index-head__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.community-index-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-3);
}

.community-index-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.028);
}

.community-index-stat__label {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.community-index-stat__value {
  color: #e4eaed;
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.community-index-stat__hint {
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.35;
}

.community-index-layout {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
}

.community-index-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  position: sticky;
  top: calc(var(--space-4) + 12px);
}

.community-index-filter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02);
}

.community-index-filter__hint {
  margin: 0;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.4;
}

.community-index-filter__hint code {
  color: #b0bec5;
  font-size: 0.66rem;
}

.community-index-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.community-index-chip {
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

.community-index-chip:hover {
  border-color: rgba(79, 195, 247, 0.4);
  color: #e4eaed;
}

.community-index-chip--active {
  border-color: rgba(79, 195, 247, 0.45);
  background: rgba(79, 195, 247, 0.14);
  color: #81d4fa;
}

.community-index-sorts {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.community-index-sort {
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

.community-index-sort:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #e4eaed;
}

.community-index-sort--active {
  border-color: rgba(79, 195, 247, 0.35);
  background: rgba(79, 195, 247, 0.1);
  color: #81d4fa;
}

.community-index-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.community-index-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.community-index-section__title {
  margin: 0.15rem 0 0;
  color: #e4eaed;
  font-size: 1.08rem;
  font-weight: 600;
  line-height: 1.25;
}

.community-index-section__hint {
  display: block;
  margin-top: 0.15rem;
  color: #78909c;
  font-size: 0.72rem;
  line-height: 1.4;
}

.community-index-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 390px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.community-index-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem;
}

.community-index-skeleton__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.community-index-skeleton__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
}

.community-index-banner {
  border: 1px solid rgba(255, 183, 77, 0.35);
  background: rgba(255, 183, 77, 0.08);
  color: #ffcc80;
}

.community-index-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.community-index-state p {
  margin: 0;
  max-width: 52ch;
  font-size: 0.86rem;
  line-height: 1.5;
}

.community-index-state code {
  color: #b0bec5;
}

.community-index-state__title {
  margin: 0;
  color: #e4eaed;
  font-size: 1.05rem;
  font-weight: 600;
}

.community-index-state__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: center;
}

.community-index-end {
  color: #78909c;
  font-size: 0.76rem;
}

@media (max-width: 1023px) {
  .community-index-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .community-index-sidebar {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .community-index-filter {
    flex: 1 1 220px;
  }
}

@media (max-width: 599px) {
  .community-index-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .community-index-sidebar {
    flex-direction: column;
  }

  .community-index-filter {
    flex-basis: auto;
  }

  .community-index-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
