<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">{{ feed.eyebrow }}</div>
        <h2 class="home-panel__title">{{ feed.heading }}</h2>
      </div>
      <div class="home-panel__actions">
        <div v-if="showSort" class="home-sort" role="group" aria-label="Post sort">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            type="button"
            class="home-sort__btn"
            :class="{ 'is-active': feed.sort === option.value }"
            :aria-pressed="feed.sort === option.value"
            :title="'Show ' + option.label.toLowerCase() + ' posts'"
            @click="changeSort(option.value)"
          >
            <q-icon :name="option.icon" size="15px" aria-hidden="true" />
            <span>{{ option.label }}</span>
          </button>
        </div>
        <q-select
          v-if="showAccountSort"
          v-model="accountSort"
          :options="accountSortOptions"
          emit-value
          map-options
          dense
          outlined
          options-dense
          label="Feed"
          aria-label="Account feed type"
          class="home-sort__select"
        />
        <router-link :to="viewAllLink" class="home-panel__link home-panel__link--button">
          View all
          <q-icon name="arrow_forward" size="14px" aria-hidden="true" />
        </router-link>
      </div>
    </q-card-section>

    <div v-if="staleAt" class="home-panel__notice">
      <data-notice
        variant="stale"
        :message="offline ? 'Offline — showing saved posts.' : 'Post refresh failed — showing saved posts.'"
        :updated-at="staleAt"
        action-label="Retry"
        @action="loadPosts"
      />
    </div>

    <q-card-section v-if="loading" class="home-panel__body">
      <div v-for="i in 5" :key="i" class="home-post-skeleton">
        <q-skeleton type="rect" width="58px" height="44px" />
        <div class="home-post-skeleton__body">
          <q-skeleton type="text" width="85%" />
          <q-skeleton type="text" width="45%" />
        </div>
      </div>
    </q-card-section>

    <q-card-section v-else-if="error" class="home-panel__state">
      <q-icon name="error_outline" size="24px" color="orange" aria-hidden="true" />
      <span>{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadPosts" />
    </q-card-section>

    <q-card-section v-else-if="posts.length === 0" class="home-panel__state">
      <q-icon name="article" size="24px" aria-hidden="true" />
      <span>No posts found right now.</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" @click="loadPosts" />
    </q-card-section>

    <q-card-section v-else class="home-panel__body home-post-list">
      <div v-if="view === 'cards'" class="home-post-cards">
        <post-preview
          v-for="post in posts"
          :key="post.post_id || (post.author + '/' + post.permlink)"
          :post="post"
          style-type="cards"
        />
      </div>
      <template v-else>
        <home-post-row
          v-for="(post, index) in posts"
          :key="post.post_id || (post.author + '/' + post.permlink)"
          :post="post"
          :rank="view === 'list' ? index + 1 : 0"
          :compact="view === 'compact'"
          :show-body="showBody"
        />
      </template>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.home-post-list {
  padding-top: 0.2rem;
  padding-bottom: 0.3rem;
}

.home-post-skeleton {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0;
}

.home-post-skeleton__body {
  flex: 1;
}

.home-post-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: var(--space-3);
}

.home-sort__select {
  min-width: 150px;
}
</style>

<script>
import HomePostRow from 'components/HomePostRow.vue'
import PostPreview from 'components/postPreview.vue'
import DataNotice from 'components/ui/DataNotice.vue'
import { RANKED_FEED_SORTS, fetchFeedPosts, resolveAccountFeed, resolvePostsFeed } from 'src/services/postFeed'
import { ACCOUNT_FEED_SORTS } from 'src/services/feedReference'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SNAPSHOT_PREFIX = 'home:posts:feed:'
const QUICK_SORTS = ['trending', 'created', 'hot']
const QUICK_ICONS = {
  trending: 'local_fire_department',
  created: 'fiber_new',
  hot: 'whatshot'
}
const SORT_OPTIONS = RANKED_FEED_SORTS
  .filter(option => QUICK_SORTS.includes(option.value))
  .map(option => ({ ...option, icon: QUICK_ICONS[option.value] }))

export default {
  name: 'homeTrendingPosts',
  components: { HomePostRow, PostPreview, DataNotice },
  props: {
    // Initial global sort: trending | created | hot.
    source: { type: String, default: 'trending' },
    // Restrict to one community/tag ('' = the whole network).
    tag: { type: String, default: '' },
    // An exact Hive listing path: /@ausbitbank/feed, /c/hive-dev, /shorts/threads.
    reference: { type: String, default: '' },
    // Account feed mode: browse one account's blog, posts, feed, replies or comments.
    account: { type: String, default: '' },
    // Account feed type when `account` is set.
    feedSort: { type: String, default: 'blog' },
    // Number of posts to show.
    limit: { type: Number, default: 6 },
    // Show the Trending/New/Hot switcher. A reference hides it because the
    // path already names the filter.
    showSortToggle: { type: Boolean, default: true },
    // list | compact | cards
    view: { type: String, default: 'list', validator: value => ['list', 'compact', 'cards'].includes(value) },
    // Show a read-in-place body excerpt (comments and short posts).
    showBody: { type: Boolean, default: false },
    // Optional refresh interval in seconds (0 = off).
    pollSeconds: { type: Number, default: 0 }
  },
  data () {
    return {
      sort: 'trending',
      accountSort: this.feedSort,
      posts: [],
      loading: true,
      error: '',
      staleAt: null,
      pollTimer: null
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    feed () {
      if (this.isAccountFeed) {
        return resolveAccountFeed(
          { reference: this.reference, account: this.account, sort: this.accountSort },
          { loggedInUser: this.loggedInUser || '' }
        )
      }
      return resolvePostsFeed(
        { reference: this.reference, source: this.sort, tag: this.tag },
        { loggedInUser: this.loggedInUser || '' }
      )
    },
    isAccountFeed () {
      return Boolean(String(this.account || '').trim())
    },
    showAccountSort () {
      return this.isAccountFeed && !String(this.reference || '').trim()
    },
    accountSortOptions () {
      return ACCOUNT_FEED_SORTS
    },
    feedKey () {
      return this.feed.key + ':' + this.limit
    },
    showSort () {
      return Boolean(this.showSortToggle && !this.isAccountFeed && !String(this.reference || '').trim() && this.feed.sortable)
    },
    sortOptions () {
      return SORT_OPTIONS
    },
    viewAllLink () {
      return this.feed.link
    }
  },
  created () {
    if (QUICK_SORTS.includes(this.source)) this.sort = this.source
  },
  watch: {
    source (value) {
      if (QUICK_SORTS.includes(value)) this.sort = value
    },
    feedSort (value) {
      this.accountSort = value
    },
    feedKey () {
      this.loadPosts()
    },
    pollSeconds () {
      this.restartPolling()
    }
  },
  mounted () {
    this.loadPosts()
    this.restartPolling()
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    restartPolling () {
      this.stopPolling()
      const seconds = Number(this.pollSeconds)
      if (!seconds || seconds < 5) return
      this.pollTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        this.loadPosts()
      }, seconds * 1000)
    },
    stopPolling () {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    changeSort (value) {
      if (value === this.sort) return
      this.sort = value
    },
    snapshotKey () {
      return SNAPSHOT_PREFIX + this.feed.key + ':' + this.limit
    },
    async loadPosts () {
      this.loading = true
      this.error = ''
      try {
        const posts = await fetchFeedPosts(this.feed, { limit: this.limit, observer: this.loggedInUser || '' })
        this.posts = posts
        this.staleAt = null
        saveSnapshot(this.snapshotKey(), { posts: this.posts })
      } catch (error) {
        console.error('Failed to load home posts', error)
        if (this.posts.length) {
          this.staleAt = this.staleAt || Date.now()
        } else if (!this.restoreSnapshot()) {
          this.error = 'Could not load posts.'
        }
      } finally {
        this.loading = false
      }
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(this.snapshotKey())
      const posts = snapshot?.data?.posts
      if (!Array.isArray(posts) || !posts.length) return false
      this.posts = posts
      this.staleAt = snapshot.savedAt
      this.error = ''
      return true
    }
  }
}
</script>
