<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">From the author</div>
        <h2 class="home-panel__title">@{{ account }}</h2>
      </div>
      <router-link :to="'/@' + account + '/blog'" class="home-panel__link">Blog</router-link>
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
      <div v-for="i in 4" :key="i" class="home-recent-skeleton">
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
import { fetchAccountPosts } from 'src/services/chainData'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SNAPSHOT_KEY = 'home:posts:recent:'

export default {
  name: 'homeRecentPosts',
  components: { HomePostRow, DataNotice },
  props: {
    account: { type: String, default: 'ausbitbank' }
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
    snapshotKey () {
      return SNAPSHOT_KEY + this.account
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
        const response = await fetchAccountPosts({
          sort: 'blog',
          account: this.account,
          observer: this.loggedInUser || this.account,
          limit: 4,
          start_author: null,
          start_permlink: null
        })
        this.posts = Array.isArray(response) ? response : []
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
