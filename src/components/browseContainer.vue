<template>
  <div class="browse-container">
    <div v-if="cachedAt && error && !loading" class="browse-notice">
      <data-notice
        variant="stale"
        :message="'Showing saved posts — live refresh failed. ' + error"
        :updated-at="cachedAt"
        action-label="Retry"
        @action="refresh"
      />
    </div>

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

        <feed-filters
          :filter="filter"
          :ignored-tags="moderationIgnoredTags"
          :logged-in-user="loggedInUser || ''"
          @update:filter="filter = $event"
          @add-tag="addIgnoredTag"
          @remove-tag="removeIgnoredTag"
          @reset="resetFilters"
        />

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
          :moderation-surface="moderationSurface"
        />
      </div>

      <div v-if="error" class="browse-inline-error">
        <q-icon name="error_outline" color="orange" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadMore" />
      </div>

      <infinite-scroll
        :can-load="hasMore"
        :disabled="Boolean(error)"
        :loading="loadingMore"
        @load="loadMore"
      >
        <template #done>
          <div class="browse-end">
            <q-icon name="check_circle" size="16px" aria-hidden="true" /> You’re all caught up.
          </div>
        </template>
      </infinite-scroll>
    </template>
  </div>
</template>

<style scoped>
.browse-container {
  width: 100%;
  min-width: 0;
}

.browse-notice {
  margin-bottom: var(--space-2);
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
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.browse-toolbar__summary strong {
  color: var(--c-text);
}

.browse-toolbar__filtered {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--c-link-hover);
}

.browse-toolbar__range {
  color: var(--c-text-faint);
}

.browse-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
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
  color: var(--c-text-muted);
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
  color: var(--c-warning);
  font-size: 0.82rem;
}

.browse-more {
  margin-top: var(--space-4);
}

.browse-end {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-text-faint);
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
import { fetchAccountPosts, fetchRankedPosts } from 'src/services/chainData'
import { defaultFeedFilters, activeFeedFilterCount, applyFeedFilters } from 'src/services/feedFilters'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'
import { trimPostsForSnapshot } from 'src/services/postSnapshot'
import { loadFeedState, saveFeedState } from 'src/services/feedState'
import { isValidTag } from 'src/utils/hiveTag'
import { normalizeIgnoredTag } from 'src/services/tagFilters'
import moderation from 'src/mixins/moderation'
import DataNotice from 'components/ui/DataNotice.vue'
import FeedFilters from 'components/feed/FeedFilters.vue'

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
  mixins: [moderation],
  props: {
    callMethod: String,
    responseLimit: Number,
    sortMethod: String,
    Pstart_author: String,
    Pstart_permlink: String,
    Ppage: Number,
    showToolbar: Boolean,
    showTag: String,
    showAccount: String,
    moderationSurface: { type: String, default: 'feed' }
  },
  components: {
    FeedFilters,
    postPreview: defineAsyncComponent(() => import('components/postPreview.vue')),
    browseTable: defineAsyncComponent(() => import('components/browseTable.vue')),
    infiniteScroll: defineAsyncComponent(() => import('components/ui/InfiniteScroll.vue')),
    DataNotice
  },
  data () {
    return {
      posts: [],
      loading: false,
      loadingMore: false,
      error: null,
      cachedAt: null,
      hasMore: true,
      restoredFeed: false,
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
      filter: defaultFeedFilters()
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    feedKey () {
      return [
        this.loggedInUser || '',
        this.method,
        this.sort,
        this.account || '',
        this.tag || '',
        this.limit
      ].join(':')
    },
    activeFilterCount () {
      return activeFeedFilterCount(this.filter, this.moderationIgnoredTags)
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
      return applyFeedFilters(this.posts, {
        filter: this.filter,
        viewer: this.loggedInUser || '',
        ignoredTags: this.moderationIgnoredTags
      })
    }
  },
  watch: {
    callMethod (value) {
      const previousKey = this.feedKey
      this.method = value || 'bridge.get_ranked_posts'
      this.switchFeed(previousKey)
    },
    sortMethod (value) {
      const previousKey = this.feedKey
      this.sort = value || 'created'
      this.switchFeed(previousKey)
    },
    showAccount (value) {
      const previousKey = this.feedKey
      this.account = value || null
      this.switchFeed(previousKey)
    },
    showTag (value) {
      const previousKey = this.feedKey
      this.tag = value || null
      this.switchFeed(previousKey)
    },
    '$route.query.style' (value) {
      const style = normalizeStyle(value)
      if (style !== this.styleType) this.styleType = style
    },
    styleType (value) {
      this.syncStyleQuery(value)
    }
  },
  created () {
    // A remount after Back should restore every loaded page, not just the
    // first snapshot page. The in-memory cache only lives for this session.
    if (!this.restoreFeedState()) this.restoreSnapshot()
  },
  mounted () {
    // Cached feeds are already painted at the previous scroll height. Refresh
    // stays explicit so a returning reader does not lose the loaded tail.
    if (!this.restoredFeed) this.getPosts(false)
  },
  beforeUnmount () {
    this.rememberFeed()
  },
  methods: {
    snapshotKey () {
      return 'browse:' + this.method + ':' + this.sort + ':' +
        (this.account || '') + ':' + (this.tag || '') + ':' + this.limit
    },
    rememberFeed (key = this.feedKey) {
      if (!key) return false
      return saveFeedState(key, {
        posts: this.posts,
        hasMore: this.hasMore,
        cachedAt: this.cachedAt
      })
    },
    restoreFeedState () {
      const cached = loadFeedState(this.feedKey)
      if (!cached) return false
      this.posts = cached.posts
      this.cachedAt = cached.cachedAt
      this.hasMore = cached.hasMore
      this.loading = false
      this.restoredFeed = true
      return true
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(this.snapshotKey())
      const posts = snapshot?.data?.posts
      if (!Array.isArray(posts) || !posts.length) return false
      this.posts = posts
      this.cachedAt = snapshot.savedAt
      this.loading = false
      this.hasMore = posts.length >= this.limit
      return true
    },
    saveSnapshot () {
      const posts = trimPostsForSnapshot(this.posts, { limit: this.limit, bodyLimit: 800 })
      if (posts.length) saveSnapshot(this.snapshotKey(), { posts })
    },
    switchFeed (previousKey = null) {
      if (previousKey) this.rememberFeed(previousKey)
      this.restoredFeed = false
      this.posts = []
      this.cachedAt = null
      this.hasMore = true
      if (this.restoreFeedState()) return
      this.restoreSnapshot()
      this.getPosts(false)
    },
    async getPosts (append = false, { force = false } = {}) {
      if (append && (this.loading || this.loadingMore || !this.hasMore)) return

      const last = this.posts[this.posts.length - 1]
      if (append && !last) return

      if (append) {
        this.loadingMore = true
      } else {
        // Keep snapshot rows visible while the live page refreshes.
        this.loading = this.posts.length === 0
      }
      this.error = null

      if (this.method === 'bridge.get_ranked_posts' && this.tag && !isValidTag(this.tag)) {
        this.posts = []
        this.cachedAt = null
        this.hasMore = false
        this.loading = false
        this.loadingMore = false
        this.error = '#' + this.tag + ' is not a valid Hive tag. Hive tags use lowercase letters, numbers, hyphens and underscores, so there is no tag feed to show.'
        return
      }

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
          this.cachedAt = null
          this.saveSnapshot()
        }
        this.hasMore = list.length >= this.limit
      } catch (error) {
        this.error = error?.cause?.data || error?.message || 'Failed to load posts'
        if (!append && !this.posts.length) this.posts = []
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
      this.filter = defaultFeedFilters()
      this.moderationClearIgnoredTags()
    },
    addIgnoredTag (value) {
      const tag = normalizeIgnoredTag(value)
      if (!tag) return
      this.moderationIgnoreTag(tag)
    },
    removeIgnoredTag (tag) {
      this.moderationUnignoreTag(tag)
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
