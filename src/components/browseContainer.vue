<template>
  <div class="browse-container">
    <div class="browse-toolbar">
      <div class="browse-toolbar__summary">
        <span v-if="loading && posts.length === 0">Loading posts…</span>
        <span v-else>
          Showing <strong>{{ filteredPosts.length }}</strong> {{ filteredPosts.length === 1 ? 'post' : 'posts' }}
        </span>
        <span v-if="filteredPosts.length !== posts.length" class="browse-toolbar__filtered">
          · {{ posts.length - filteredPosts.length }} hidden by filters
        </span>
        <span v-if="loadedRange" class="browse-toolbar__range" title="Date range of the posts loaded on this page">· {{ loadedRange }}</span>
      </div>

      <div class="browse-toolbar__actions">
        <q-btn flat dense round icon="refresh" aria-label="Refresh posts" title="Refresh posts" :loading="loading" @click="refresh" />

        <q-btn
          flat
          dense
          no-caps
          icon="filter_alt"
          :label="$q.screen.gt.xs ? 'Filters' : ''"
          aria-label="Filter posts"
          :class="{ 'browse-filter--active': hasActiveFilters }"
        >
          <q-badge v-if="hasActiveFilters" color="primary" floating>{{ activeFilterCount }}</q-badge>
          <q-popup-proxy>
            <q-card class="browse-filter-card">
              <q-card-section>
                <div class="browse-filter-card__head">
                  <div>
                    <div class="browse-filter-card__title">Filter posts</div>
                    <div class="browse-filter-card__hint">Applies to the posts loaded so far.</div>
                  </div>
                  <q-btn flat dense round icon="close" aria-label="Close filters" v-close-popup />
                </div>

                <q-list dense class="browse-filter-list">
                  <q-item>
                    <q-item-section>
                      <q-item-label>Hide voted posts</q-item-label>
                      <q-item-label v-if="!loggedInUser" caption>Log in to filter voted posts</q-item-label>
                    </q-item-section>
                    <q-item-section side><q-toggle v-model="filter.hideVoted" dense color="primary" :disable="!loggedInUser" /></q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section><q-item-label>Hide reblogs</q-item-label></q-item-section>
                    <q-item-section side><q-toggle v-model="filter.hideReblogs" dense color="primary" /></q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section><q-item-label>Hide pinned posts</q-item-label></q-item-section>
                    <q-item-section side><q-toggle v-model="filter.hidePinned" dense color="primary" /></q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section><q-item-label>Hide muted posts</q-item-label></q-item-section>
                    <q-item-section side><q-toggle v-model="filter.hideHidden" dense color="primary" /></q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section><q-item-label>Hide moderated posts</q-item-label></q-item-section>
                    <q-item-section side><q-toggle v-model="filter.hideGray" dense color="primary" /></q-item-section>
                  </q-item>
                  <q-item>
                    <q-item-section><q-item-label>Hide rewards outside range</q-item-label></q-item-section>
                    <q-item-section side><q-toggle v-model="filter.hideRewardsFilter" dense color="primary" /></q-item-section>
                  </q-item>
                </q-list>

                <div class="browse-filter-card__range">
                  <q-input
                    v-model.number="filter.hideRewardsBelow"
                    type="number"
                    dense
                    outlined
                    label="Min HBD"
                    :disable="!filter.hideRewardsFilter"
                  />
                  <q-input
                    v-model.number="filter.hideRewardsAbove"
                    type="number"
                    dense
                    outlined
                    label="Max HBD"
                    :disable="!filter.hideRewardsFilter"
                  />
                </div>

                <div class="browse-filter-card__actions">
                  <q-btn flat no-caps color="primary" label="Reset filters" @click="resetFilters" />
                  <q-btn unelevated no-caps color="primary" label="Done" v-close-popup />
                </div>
              </q-card-section>
            </q-card>
          </q-popup-proxy>
        </q-btn>

        <q-select
          v-if="$q.screen.lt.sm"
          v-model="styleType"
          :options="styleOptions"
          dense
          outlined
          options-dense
          emit-value
          map-options
          aria-label="Post layout"
          class="browse-layout-select"
        />
        <q-btn-toggle
          v-else
          v-model="styleType"
          :options="styleOptions"
          dense
          no-caps
          outline
          toggle-color="primary"
          aria-label="Post layout"
          class="browse-layout-toggle"
        />
      </div>
    </div>

    <div v-if="loading && posts.length === 0" class="browse-grid browse-grid--cards" aria-label="Loading posts">
      <q-card v-for="i in 6" :key="i" flat bordered class="browse-skeleton">
        <q-skeleton height="170px" square />
        <q-card-section>
          <q-skeleton type="text" width="45%" />
          <q-skeleton type="text" width="90%" />
          <q-skeleton type="text" width="75%" />
          <q-skeleton type="text" width="55%" />
        </q-card-section>
      </q-card>
    </div>

    <div v-else-if="error && posts.length === 0" class="browse-state">
      <q-icon name="error_outline" size="2.4em" color="orange" aria-hidden="true" />
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" icon="refresh" label="Try again" @click="refresh" />
    </div>

    <div v-else-if="filteredPosts.length === 0" class="browse-state">
      <q-icon name="search_off" size="2.4em" aria-hidden="true" />
      <p>{{ posts.length === 0 ? 'No posts found.' : 'No posts match the current filters.' }}</p>
      <div class="row q-gutter-sm justify-center">
        <q-btn v-if="hasActiveFilters" outline no-caps color="primary" icon="filter_alt_off" label="Reset filters" @click="resetFilters" />
        <q-btn v-if="hasMore" outline no-caps color="primary" icon="expand_more" label="Load more posts" :loading="loadingMore" @click="loadMore" />
        <q-btn flat no-caps color="primary" icon="refresh" label="Refresh" @click="refresh" />
      </div>
    </div>

    <template v-else>
      <div v-if="styleType === 'table'" class="browse-table-card">
        <browse-table :filteredPosts="filteredPosts" :loading="loading" />
      </div>
      <div v-else class="browse-grid" :class="'browse-grid--' + styleType">
        <post-preview
          v-for="post in filteredPosts"
          :key="postKey(post)"
          :post="post"
          :style-type="styleType"
        />
      </div>

      <div v-if="error" class="browse-inline-error">
        <q-icon name="error_outline" color="orange" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadMore" />
      </div>

      <div class="browse-more">
        <q-btn
          v-if="hasMore"
          outline
          no-caps
          color="primary"
          icon="expand_more"
          :label="loadingMore ? 'Loading…' : 'Load more posts'"
          :loading="loadingMore"
          @click="loadMore"
        />
        <div v-else class="browse-end">
          <q-icon name="check_circle" size="16px" aria-hidden="true" /> You’re all caught up.
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.browse-container {
  width: 100%;
  min-width: 0;
}

.browse-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.browse-toolbar__summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  color: #90a4ae;
  font-size: 0.8rem;
}

.browse-toolbar__summary strong {
  color: #e4eaed;
}

.browse-toolbar__filtered {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: #81d4fa;
}

.browse-toolbar__range {
  color: #78909c;
}

.browse-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.browse-filter--active {
  color: #81d4fa;
}

.browse-filter-card {
  width: min(360px, 92vw);
}

.browse-filter-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 0.35rem;
}

.browse-filter-card__title {
  font-weight: 600;
}

.browse-filter-card__hint {
  color: #90a4ae;
  font-size: 0.72rem;
}

.browse-filter-list {
  margin: 0 -0.5rem;
}

.browse-filter-card__range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.browse-filter-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.browse-layout-select {
  min-width: 126px;
}

.browse-layout-toggle :deep(.q-btn) {
  padding: 0 0.55rem;
}

.browse-grid {
  width: 100%;
  min-width: 0;
}

.browse-grid--cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.browse-grid--list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.browse-skeleton {
  overflow: hidden;
}

.browse-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.browse-state p {
  margin: 0;
}

.browse-inline-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: var(--space-3);
  color: #ffb74d;
  font-size: 0.82rem;
}

.browse-more {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--space-4);
}

.browse-end {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #78909c;
  font-size: 0.8rem;
}

.browse-table-card {
  overflow-x: auto;
}

@media (max-width: 599px) {
  .browse-toolbar {
    align-items: flex-start;
  }

  .browse-toolbar__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { postPayoutValue } from 'src/services/posts'
import { fetchAccountPosts, fetchRankedPosts } from 'src/services/chainData'

const DEFAULT_FILTERS = () => ({
  hideVoted: false,
  hideReblogs: false,
  hidePinned: false,
  hideHidden: true,
  hideGray: true,
  hideRewardsFilter: false,
  hideRewardsAbove: 50,
  hideRewardsBelow: 0
})

const STYLE_ALIASES = {
  preview: 'cards',
  media: 'cards',
  full: 'list',
  compact: 'list',
  cards: 'cards',
  list: 'list',
  table: 'table'
}

function normalizeStyle (value) {
  return STYLE_ALIASES[value] || 'cards'
}

export default {
  name: 'browseContainer',
  props: {
    callMethod: String,
    responseLimit: Number,
    sortMethod: String,
    Pstart_author: String,
    Pstart_permlink: String,
    Ppage: Number,
    showToolbar: Boolean,
    showTag: String,
    showAccount: String
  },
  components: {
    postPreview: defineAsyncComponent(() => import('components/postPreview.vue')),
    browseTable: defineAsyncComponent(() => import('components/browseTable.vue'))
  },
  data () {
    return {
      posts: [],
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: true,
      limit: Number(this.$route.query.limit) || this.responseLimit || 20,
      styleType: normalizeStyle(this.$route.query.style),
      styleOptions: [
        { label: 'Cards', value: 'cards', icon: 'grid_view' },
        { label: 'List', value: 'list', icon: 'view_list' },
        { label: 'Table', value: 'table', icon: 'table_rows' }
      ],
      method: this.callMethod || 'bridge.get_ranked_posts',
      sort: this.sortMethod || 'created',
      account: this.showAccount || null,
      tag: this.showTag || null,
      filter: DEFAULT_FILTERS()
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    activeFilterCount () {
      const defaults = DEFAULT_FILTERS()
      return ['hideVoted', 'hideReblogs', 'hidePinned', 'hideHidden', 'hideGray', 'hideRewardsFilter']
        .filter(key => this.filter[key] !== defaults[key])
        .length
    },
    hasActiveFilters () {
      return this.activeFilterCount > 0
    },
    loadedRange () {
      const times = this.posts
        .map(post => Date.parse(post.created))
        .filter(time => Number.isFinite(time))
      if (!times.length) return ''
      const oldest = moment.utc(Math.min(...times))
      const newest = moment.utc(Math.max(...times))
      const oldestLabel = oldest.format('D MMM YYYY')
      const newestLabel = newest.format('D MMM YYYY')
      return oldestLabel === newestLabel ? oldestLabel : oldestLabel + ' – ' + newestLabel
    },
    filteredPosts () {
      let list = this.posts

      if (this.filter.hideVoted && this.loggedInUser) {
        list = list.filter(post => !(post.active_votes || []).some(vote => vote.voter === this.loggedInUser))
      }
      if (this.filter.hideReblogs) {
        list = list.filter(post => !(post.reblogged_by && post.reblogged_by.length))
      }
      if (this.filter.hidePinned) {
        list = list.filter(post => !(post.stats && post.stats.is_pinned))
      }
      if (this.filter.hideHidden) {
        list = list.filter(post => !(post.stats && (post.stats.hidden || post.stats.hide)))
      }
      if (this.filter.hideGray) {
        list = list.filter(post => !(post.stats && post.stats.gray))
      }
      if (this.filter.hideRewardsFilter) {
        const min = Number(this.filter.hideRewardsBelow)
        const max = Number(this.filter.hideRewardsAbove)
        if (Number.isFinite(min) && min > 0) {
          list = list.filter(post => postPayoutValue(post) >= min)
        }
        if (Number.isFinite(max) && max > 0) {
          list = list.filter(post => postPayoutValue(post) <= max)
        }
      }

      return list
    }
  },
  watch: {
    callMethod (value) {
      this.method = value || 'bridge.get_ranked_posts'
      this.refresh()
    },
    sortMethod (value) {
      this.sort = value || 'created'
      this.refresh()
    },
    showAccount (value) {
      this.account = value || null
      this.refresh()
    },
    showTag (value) {
      this.tag = value || null
      this.refresh()
    },
    '$route.query.style' (value) {
      const style = normalizeStyle(value)
      if (style !== this.styleType) this.styleType = style
    },
    styleType (value) {
      this.syncStyleQuery(value)
    }
  },
  mounted () {
    this.getPosts(false)
  },
  methods: {
    async getPosts (append = false, { force = false } = {}) {
      if (append && (this.loading || this.loadingMore || !this.hasMore)) return

      const last = this.posts[this.posts.length - 1]
      if (append && !last) return

      if (append) {
        this.loadingMore = true
      } else {
        this.loading = true
      }
      this.error = null

      const params = {
        observer: this.loggedInUser || undefined,
        limit: this.limit,
        sort: this.sort,
        start_author: append ? last.author : undefined,
        start_permlink: append ? last.permlink : undefined
      }

      if (this.method === 'bridge.get_account_posts') params.account = this.account
      if (this.method === 'bridge.get_ranked_posts') params.tag = this.tag || undefined

      try {
        const response = this.method === 'bridge.get_account_posts'
          ? await fetchAccountPosts(params, { force })
          : await fetchRankedPosts(params, { force })
        const list = Array.isArray(response) ? response : []

        if (append) {
          const seen = new Set(this.posts.map(post => post.author + '/' + post.permlink))
          this.posts = this.posts.concat(list.filter(post => !seen.has(post.author + '/' + post.permlink)))
        } else {
          this.posts = list
        }
        this.hasMore = list.length >= this.limit
      } catch (error) {
        this.error = error?.cause?.data || error?.message || 'Failed to load posts'
        if (!append) this.posts = []
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },
    refresh () {
      this.getPosts(false, { force: true })
    },
    loadMore () {
      this.getPosts(true)
    },
    resetFilters () {
      this.filter = DEFAULT_FILTERS()
    },
    syncStyleQuery (value) {
      if (this.$route.query.style === value) return
      const query = { ...this.$route.query, style: value }
      this.$router.replace({ path: this.$route.path, query }).catch(() => {})
    },
    postKey (post) {
      return (post.post_id || (post.author + '/' + post.permlink)) + '-' + ((post.reblogged_by && post.reblogged_by[0]) || '')
    }
  }
}
</script>
