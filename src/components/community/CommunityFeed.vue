<template>
  <section class="community-feed" aria-labelledby="community-feed-title">
    <div class="community-feed__head">
      <div class="community-feed__heading">
        <div class="home-eyebrow">{{ eyebrow }}</div>
        <h2 id="community-feed-title" class="community-feed__title">{{ title }}</h2>
        <p class="community-feed__hint">{{ hint }}</p>
      </div>

      <div class="community-feed__actions">
        <q-btn-toggle
          v-model="sort"
          :options="sortOptions"
          dense
          no-caps
          outline
          toggle-color="primary"
          aria-label="Community feed sort"
        />
        <q-btn flat dense round icon="refresh" aria-label="Refresh community feed" title="Refresh" :loading="loading" @click="loadFeed({ force: true })" />
      </div>
    </div>

    <data-notice
      v-if="staleAt && posts.length"
      variant="stale"
      :message="offline ? 'Offline — showing saved community posts.' : 'Feed refresh failed — showing saved community posts.'"
      :updated-at="staleAt"
      action-label="Retry"
      @action="loadFeed({ force: true })"
    />

    <div v-if="loading && posts.length === 0" class="community-feed__grid" aria-label="Loading community posts">
      <q-card v-for="i in 6" :key="i" flat bordered class="community-feed__skeleton">
        <q-skeleton height="150px" square />
        <q-card-section>
          <q-skeleton type="text" width="40%" />
          <q-skeleton type="text" width="92%" />
          <q-skeleton type="text" width="70%" />
        </q-card-section>
      </q-card>
    </div>

    <q-card v-else-if="error && posts.length === 0" flat bordered class="community-feed__state">
      <q-icon name="error_outline" size="24px" color="orange" aria-hidden="true" />
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" icon="refresh" label="Try again" @click="loadFeed({ force: true })" />
    </q-card>

    <q-card v-else-if="!posts.length" flat bordered class="community-feed__state">
      <q-icon name="forum" size="24px" aria-hidden="true" />
      <p>{{ emptyMessage }}</p>
      <q-btn outline no-caps color="primary" icon="explore" label="Browse Hive posts" to="/browse" />
    </q-card>

    <infinite-scroll
      v-else
      :can-load="hasMore"
      :disabled="Boolean(error)"
      :loading="loadingMore"
      @load="loadMore"
    >
      <div class="community-feed__grid">
        <post-preview
          v-for="post in posts"
          :key="postKey(post)"
          :post="post"
          :style-type="styleType"
        />
      </div>

      <div v-if="error" class="community-feed__inline-error" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadMore" />
      </div>

      <template v-if="!merged" #done>
        <div class="community-feed__end">
          <q-icon name="check_circle" size="16px" aria-hidden="true" /> You’re all caught up.
        </div>
      </template>
      <template v-else #done>
        <div class="community-feed__more">
          <span v-if="remainingSources" class="community-feed__end">
            The merged feed samples {{ sources.length }} of {{ sourceCount }} communities.
          </span>
          <span v-else class="community-feed__end">
            <q-icon name="check_circle" size="16px" aria-hidden="true" /> That’s the latest from your communities.
          </span>
          <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" @click="loadFeed({ force: true })" />
        </div>
      </template>
    </infinite-scroll>
  </section>
</template>

<script>
import PostPreview from 'components/postPreview.vue'
import DataNotice from 'components/ui/DataNotice.vue'
import InfiniteScroll from 'components/ui/InfiniteScroll.vue'
import { fetchRankedPosts } from 'src/services/chainData'
import { communityRoleWeight, mergeCommunityFeeds } from 'src/services/community'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SORTS = [
  { label: 'Trending', value: 'trending' },
  { label: 'New', value: 'created' },
  { label: 'Hot', value: 'hot' }
]

const SNAPSHOT_PREFIX = 'communities:feed:'
const PAGE_SIZE = 20
const FEED_SOURCES = 12
const PER_SOURCE_LIMIT = 8
const MERGED_LIMIT = 30
const MAX_POSTS = 300

export default {
  name: 'CommunityFeed',
  components: {
    PostPreview,
    DataNotice,
    InfiniteScroll
  },
  props: {
    /**
     * Feed tag for `bridge.get_ranked_posts`. `my` merges the subscriptions
     * in `directory`; any other value reads that single community's feed.
     */
    tag: { type: String, default: 'my' },
    /** Account used as the Hivemind observer for personalised sorts. */
    observer: { type: String, default: null },
    /** Subscription rows (`[name, title, role, guestTitle]`) for the merged feed. */
    directory: { type: Array, default: () => [] },
    heading: { type: String, default: 'Community feed' },
    eyebrow: { type: String, default: 'Latest posts' },
    emptyMessage: { type: String, default: 'No community posts found right now.' },
    styleType: {
      type: String,
      default: 'cards',
      validator: value => ['cards', 'list'].includes(value)
    }
  },
  data () {
    return {
      sort: 'trending',
      sortOptions: SORTS,
      posts: [],
      loaded: false,
      loading: true,
      loadingMore: false,
      exhausted: false,
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
    title () {
      return this.heading
    },
    merged () {
      return this.tag === 'my'
    },
    hint () {
      return this.merged
        ? 'The newest and most engaged posts from the communities this account belongs to, one community at a time.'
        : 'Fresh posts from this community, read straight from the Hive blockchain.'
    },
    hasMore () {
      if (this.merged) return false
      return this.posts.length > 0 && !this.exhausted && this.posts.length < MAX_POSTS
    },
    sources () {
      if (!this.merged) return []
      return [...this.sourceRows]
        .filter(row => Array.isArray(row) && row[0])
        .map((row, index) => ({ name: row[0], title: row[1] || row[0], role: row[2] || '', index }))
        .sort((a, b) => communityRoleWeight(b.role) - communityRoleWeight(a.role) || a.index - b.index)
        .slice(0, FEED_SOURCES)
    },
    sourcesKey () {
      return this.sourceRows.filter(row => Array.isArray(row) && row[0]).map(row => row[0]).length
    },
    remainingSources () {
      return Math.max(0, this.sourceCount - this.sources.length)
    },
    sourceCount () {
      const rows = Array.isArray(this.directory) && this.directory.length
        ? this.directory
        : (Array.isArray(this.$hiveStore.user.communities) ? this.$hiveStore.user.communities : [])
      return rows.filter(row => Array.isArray(row) && row[0]).length
    },
    sourceRows () {
      return Array.isArray(this.directory) && this.directory.length
        ? this.directory
        : (Array.isArray(this.$hiveStore.user.communities) ? this.$hiveStore.user.communities : [])
    }
  },
  watch: {
    sort () {
      this.reload()
    },
    sourcesKey (next, previous) {
      if (next === previous) return
      // The page resolves its directory asynchronously, so the first load runs
      // with whatever rows already exist and reloads once the directory lands.
      this.reload()
    }
  },
  mounted () {
    this.loadFeed()
  },
  methods: {
    reload () {
      this.exhausted = false
      this.loadFeed()
    },
    postKey (post) {
      return post.post_id || (post.author + '/' + post.permlink)
    },
    snapshotKey () {
      return SNAPSHOT_PREFIX + this.tag + ':' + this.sort
    },
    async loadFeed ({ force = false } = {}) {
      this.loading = true
      this.loadingMore = false
      this.error = ''
      try {
        const posts = this.merged ? await this.loadMerged(force) : await this.fetchPage({})
        this.posts = posts
        this.staleAt = null
        this.loaded = true
        saveSnapshot(this.snapshotKey(), { posts: this.posts })
      } catch (error) {
        console.error('Failed to load community feed', error)
        this.loaded = true
        if (this.posts.length) {
          this.staleAt = this.staleAt || Date.now()
        } else if (!this.restoreSnapshot()) {
          this.error = 'Could not load community posts.'
        }
      } finally {
        this.loading = false
      }
    },
    async loadMore () {
      if (this.merged || this.loading || this.loadingMore || !this.hasMore) return
      this.loadingMore = true
      this.error = ''
      try {
        // Paging always resumes from the last visible post, never from a stale
        // marker, so a retry cannot skip or repeat a page.
        const last = this.posts[this.posts.length - 1]
        const batch = await this.fetchPage(last?.author ? { author: last.author, permlink: last.permlink } : {})
        const seen = new Set(this.posts.map(post => this.postKey(post)))
        const fresh = batch.filter(post => !seen.has(this.postKey(post)))
        if (fresh.length) {
          this.posts = [...this.posts, ...fresh]
          this.exhausted = this.posts.length >= MAX_POSTS
          saveSnapshot(this.snapshotKey(), { posts: this.posts })
        } else {
          // A page with nothing new means this community feed is exhausted.
          this.exhausted = true
        }
      } catch (error) {
        console.error('Failed to load more community posts', error)
        this.error = 'More posts could not be loaded.'
      } finally {
        this.loadingMore = false
      }
    },
    async fetchPage ({ author = '', permlink = '' } = {}) {
      const params = {
        sort: this.sort,
        tag: this.tag,
        limit: PAGE_SIZE,
        observer: this.observer || null
      }
      if (author) {
        params.start_author = author
        params.start_permlink = permlink
      }
      const response = await fetchRankedPosts(params)
      return Array.isArray(response) ? response : []
    },
    async loadMerged (force) {
      const sources = this.sources
      if (!sources.length) return []
      const feeds = await Promise.all(sources.map(async source => {
        try {
          const posts = await fetchRankedPosts({
            sort: this.sort,
            tag: source.name,
            limit: PER_SOURCE_LIMIT,
            observer: this.observer || null
          }, { force })
          return { name: source.name, title: source.title, posts: Array.isArray(posts) ? posts : [] }
        } catch {
          return { name: source.name, title: source.title, posts: [] }
        }
      }))
      const merged = mergeCommunityFeeds(feeds, { limit: MERGED_LIMIT })
      if (!merged.length) throw new Error('No community posts returned')
      return merged
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

<style scoped>
.community-feed {
  min-width: 0;
}

.community-feed__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.community-feed__heading {
  min-width: 0;
}

.community-feed__title {
  margin: 0.18rem 0 0.2rem;
  color: #e4eaed;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.25;
}

.community-feed__hint {
  max-width: 70ch;
  margin: 0;
  color: #90a4ae;
  font-size: 0.82rem;
  line-height: 1.45;
}

.community-feed__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.community-feed__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.community-feed__skeleton {
  overflow: hidden;
}

.community-feed__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.community-feed__state p {
  margin: 0;
}

.community-feed__inline-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: var(--space-3);
  color: #ffb74d;
  font-size: 0.82rem;
}

.community-feed__end {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #78909c;
  font-size: 0.76rem;
}

.community-feed__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .community-feed__head {
    align-items: flex-start;
  }
}
</style>
