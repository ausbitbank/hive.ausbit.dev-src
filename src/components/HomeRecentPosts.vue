<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">{{ eyebrow }}</div>
        <h2 class="home-panel__title">{{ heading }}</h2>
      </div>
      <router-link :to="feed.link" class="home-panel__link">{{ linkLabel }}</router-link>
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
      <div v-for="i in Math.min(limit, 8)" :key="i" class="home-recent-skeleton">
        <q-skeleton type="rect" width="42px" height="38px" />
        <div class="home-recent-skeleton__body">
          <q-skeleton type="text" width="90%" />
          <q-skeleton type="text" width="50%" />
        </div>
      </div>
    </q-card-section>

    <q-card-section v-else-if="error" class="home-panel__state">
      <q-icon name="error_outline" size="22px" color="orange" aria-hidden="true" />
      <span>{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadPosts" />
    </q-card-section>

    <q-card-section v-else-if="posts.length === 0" class="home-panel__state">
      <span>No recent posts.</span>
    </q-card-section>

    <q-card-section v-else class="home-panel__body home-post-list">
      <home-post-row v-for="post in posts" :key="post.post_id || (post.author + '/' + post.permlink)" :post="post" compact />
    </q-card-section>
  </q-card>
</template>

<style scoped>
.home-recent-skeleton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.home-recent-skeleton__body {
  flex: 1;
}
</style>

<script>
import HomePostRow from 'components/HomePostRow.vue'
import DataNotice from 'components/ui/DataNotice.vue'
import { fetchFeedPosts, resolveAccountFeed } from 'src/services/postFeed'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SNAPSHOT_KEY = 'home:posts:recent:'

export default {
  name: 'homeRecentPosts',
  components: { HomePostRow, DataNotice },
  props: {
    // Whose recent posts to show. Empty means the signed-in user, falling back
    // to the site author for guests.
    account: { type: String, default: '' },
    // An exact Hive listing path such as /@ausbitbank/feed, /c/hive-dev or
    // /shorts/threads. Overrides the account and feed type when set.
    reference: { type: String, default: '' },
    // Account feed type: blog | posts | feed | replies | comments.
    sort: { type: String, default: 'blog' },
    // Guest fallback when `account` is empty.
    fallbackAccount: { type: String, default: 'ausbitbank' },
    // Number of posts to show.
    limit: { type: Number, default: 4 },
    // Dashboard mode: show the feed type as the eyebrow instead of the page's
    // generic "From the author", so the header describes the filter.
    showFeedLabel: { type: Boolean, default: false }
  },
  data () {
    return {
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
    feed () {
      return resolveAccountFeed(
        { reference: this.reference, account: this.account, sort: this.sort },
        { loggedInUser: this.loggedInUser || '', fallbackAccount: this.fallbackAccount }
      )
    },
    feedKey () {
      return this.feed.key + ':' + this.limit
    },
    eyebrow () {
      return this.showFeedLabel ? this.feed.eyebrow : 'From the author'
    },
    heading () {
      return this.feed.kind === 'account' ? '@' + this.feed.account : this.feed.heading
    },
    linkLabel () {
      if (this.showFeedLabel) return 'View all'
      return this.feed.kind === 'account' ? 'Blog' : this.feed.linkLabel
    },
    snapshotKey () {
      return SNAPSHOT_KEY + this.feed.key + ':' + this.limit
    }
  },
  watch: {
    feedKey () {
      this.loadPosts()
    }
  },
  mounted () {
    this.loadPosts()
  },
  methods: {
    async loadPosts () {
      this.loading = true
      this.error = ''
      try {
        const posts = await fetchFeedPosts(this.feed, {
          limit: this.limit,
          observer: this.loggedInUser || this.feed.account || ''
        })
        this.posts = posts
        this.staleAt = null
        saveSnapshot(this.snapshotKey, { posts: this.posts })
      } catch (error) {
        console.error('Failed to load recent posts', error)
        if (this.posts.length) {
          this.staleAt = this.staleAt || Date.now()
        } else if (!this.restoreSnapshot()) {
          this.error = 'Could not load recent posts.'
        }
      } finally {
        this.loading = false
      }
    },
    restoreSnapshot () {
      const snapshot = loadSnapshot(this.snapshotKey)
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
