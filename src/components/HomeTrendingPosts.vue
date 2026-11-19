<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Community</div>
        <h2 class="home-panel__title">Posts on Hive</h2>
      </div>
      <div class="home-panel__actions">
        <div v-if="showSortToggle" class="home-sort" role="group" aria-label="Post sort">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            type="button"
            class="home-sort__btn"
            :class="{ 'is-active': sort === option.value }"
            :aria-pressed="sort === option.value"
            :title="'Show ' + option.label.toLowerCase() + ' posts'"
            @click="changeSort(option.value)"
          >
            <q-icon :name="option.icon" size="15px" aria-hidden="true" />
            <span>{{ option.label }}</span>
          </button>
        </div>
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
      <home-post-row
        v-for="(post, index) in posts"
        :key="post.post_id || (post.author + '/' + post.permlink)"
        :post="post"
        :rank="index + 1"
      />
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
</style>

<script>
import HomePostRow from 'components/HomePostRow.vue'
import DataNotice from 'components/ui/DataNotice.vue'
import { fetchRankedPosts } from 'src/services/chainData'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SNAPSHOT_PREFIX = 'home:posts:ranked:'
const SORTS = [
  { label: 'Trending', value: 'trending', icon: 'local_fire_department' },
  { label: 'New', value: 'created', icon: 'fiber_new' },
  { label: 'Hot', value: 'hot', icon: 'whatshot' }
]

const ROUTES = {
  trending: '/trending',
  created: '/created',
  hot: '/hot'
}

const SOURCES = ['trending', 'created', 'hot']

export default {
  name: 'homeTrendingPosts',
  components: { HomePostRow, DataNotice },
  props: {
    // Initial feed: trending | created | hot.
    source: { type: String, default: 'trending' },
    // Restrict to one community/tag ('' = the whole network).
    tag: { type: String, default: '' },
    // Number of posts to show.
    limit: { type: Number, default: 6 },
    // Show the Trending/New/Hot switcher. A widget configured for a source
    // hides it; the front page keeps it.
    showSortToggle: { type: Boolean, default: true }
  },
  data () {
    return {
      sort: 'trending',
      sortOptions: SORTS,
      posts: [],
      loading: true,
      error: '',
      staleAt: null
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    viewAllLink () {
      return ROUTES[this.sort] || '/trending'
    }
  },
  created () {
    this.sort = SOURCES.includes(this.source) ? this.source : 'trending'
  },
  watch: {
    tag () {
      this.loadPosts()
    }
  },
  mounted () {
    this.loadPosts()
  },
  methods: {
    changeSort (value) {
      if (value === this.sort) return
      this.sort = value
      this.loadPosts()
    },
    snapshotKey () {
      return SNAPSHOT_PREFIX + (this.tag ? 'tag:' + this.tag + ':' : '') + this.sort
    },
    async loadPosts () {
      this.loading = true
      this.error = ''
      try {
        const response = await fetchRankedPosts({
          observer: this.loggedInUser || null,
          limit: this.limit,
          sort: this.sort,
          tag: this.tag || '',
          start_author: null,
          start_permlink: null
        })
        this.posts = Array.isArray(response) ? response : []
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
