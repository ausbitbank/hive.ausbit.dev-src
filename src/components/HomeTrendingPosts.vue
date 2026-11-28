<template>
  <q-card flat bordered class="home-card home-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">{{ header.eyebrow }}</div>
        <h2 class="home-panel__title">
          <q-avatar v-if="avatar" size="28px" class="home-panel__avatar" aria-hidden="true">
            <img :src="avatar" alt="" @error="avatarFailed = true">
          </q-avatar>
          <span>{{ header.heading }}</span>
        </h2>
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
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh posts"
          title="Refresh posts"
          :loading="refreshing"
          @click="refreshPosts"
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

    <q-card-section v-if="needsLogin" class="home-panel__state">
      <q-icon name="lock_person" size="24px" aria-hidden="true" />
      <span>Log in to see posts across your communities.</span>
    </q-card-section>

    <q-card-section v-else-if="loading" class="home-panel__body">
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

    <q-card-section v-else-if="visiblePosts.length === 0" class="home-panel__state">
      <q-icon :name="allPostsFiltered ? 'filter_alt_off' : 'article'" size="24px" aria-hidden="true" />
      <span>{{ allPostsFiltered ? 'All posts in this feed match your ignored tags.' : emptyMessage }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" @click="loadPosts" />
    </q-card-section>

    <q-card-section v-else class="home-panel__body home-post-list">
      <div v-if="view === 'cards'" class="home-post-cards">
        <post-preview
          v-for="post in visiblePosts"
          :key="post.post_id || (post.author + '/' + post.permlink)"
          :post="post"
          style-type="cards"
        />
      </div>
      <template v-else>
        <home-post-row
          v-for="(post, index) in visiblePosts"
          :key="post.post_id || (post.author + '/' + post.permlink)"
          :post="post"
          :rank="view === 'list' ? index + 1 : 0"
          :compact="view === 'compact'"
          :show-body="showBody"
        />
      </template>
    </q-card-section>

    <q-card-section v-if="!needsLogin && !loading && !error" class="home-panel__footer">
      <span>{{ pollingLabel }}</span>
      <span v-if="updatedLabel">Updated {{ updatedLabel }}</span>
      <span v-else>&nbsp;</span>
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

.home-panel__avatar {
  flex: none;
  margin-right: 0.1rem;
}

.home-panel__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
import { matchingIgnoredTag } from 'src/services/tagFilters'
import { ACCOUNT_FEED_SORTS, feedAvatar, feedHeader } from 'src/services/feedReference'
import { fetchCommunity } from 'src/services/chainData'
import { pollWhileVisible } from 'src/services/polling'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'
import { getHomeSnapshot, snapshotFeed, whenHomeSnapshot } from 'src/services/homeSnapshot'
import moderation from 'src/mixins/moderation'
import moment from 'src/utils/time'

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
  mixins: [moderation],
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
      refreshing: false,
      error: '',
      staleAt: null,
      community: null,
      avatarFailed: false,
      updatedAt: 0,
      nowTick: Date.now(),
      poller: null,
      clockTimer: null,
      requestToken: 0,
      communityToken: 0
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
        { reference: this.reference, source: this.feedSource, tag: this.tag },
        { loggedInUser: this.loggedInUser || '' }
      )
    },
    feedSource () {
      // Quick-sort sources follow the in-card switcher; an explicit mode such
      // as "My communities" is not a sort and must survive it.
      return QUICK_SORTS.includes(this.source) ? this.sort : this.source
    },
    isAccountFeed () {
      return Boolean(String(this.account || '').trim())
    },
    needsLogin () {
      return Boolean(this.feed?.requiresAccount) && !this.loggedInUser
    },
    emptyMessage () {
      return this.feed?.kind === 'communities'
        ? 'No posts from your communities yet. Join a community to fill this feed.'
        : 'No posts found right now.'
    },
    visiblePosts () {
      if (!this.moderationIgnoredTags.length) return this.posts
      return this.posts.filter(post => !matchingIgnoredTag(post, this.moderationIgnoredTags))
    },
    allPostsFiltered () {
      return this.posts.length > 0 && this.visiblePosts.length === 0
    },
    showAccountSort () {
      return this.isAccountFeed && !String(this.reference || '').trim()
    },
    accountSortOptions () {
      return ACCOUNT_FEED_SORTS
    },
    feedKey () {
      // The merged community feed depends on the signed-in account, not on the
      // feed path alone.
      return this.feed.key + ':' + this.limit + (this.feed.requiresAccount ? ':' + this.loggedInUser : '')
    },
    communityKey () {
      return this.feed?.kind === 'community' ? this.feed.community : ''
    },
    header () {
      return feedHeader(this.feed, this.community)
    },
    avatar () {
      return this.avatarFailed ? '' : feedAvatar(this.feed)
    },
    pollingLabel () {
      const seconds = Number(this.pollSeconds)
      return seconds > 0 ? 'Refreshes every ' + seconds + 's' : 'Manual refresh'
    },
    updatedLabel () {
      if (!this.updatedAt) return ''
      return moment.utc(this.updatedAt).from(moment.utc(this.nowTick))
    },
    showSort () {
      return Boolean(this.showSortToggle && !this.isAccountFeed && !String(this.reference || '').trim() && this.feed.sortable)
    },
    sortOptions () {
      return SORT_OPTIONS
    },
    viewAllLink () {
      if (this.feed?.kind === 'communities' && this.loggedInUser) {
        return '/@' + this.loggedInUser + '/communities'
      }
      return this.feed.link
    }
  },
  created () {
    if (QUICK_SORTS.includes(this.source)) this.sort = this.source
    if (this.applySnapshot()) return
    whenHomeSnapshot({ timeoutMs: 400 }).then(snapshot => {
      if (!this.posts.length) this.applySnapshot(snapshot)
    })
  },
  watch: {
    source (value) {
      if (QUICK_SORTS.includes(value)) this.sort = value
    },
    feedSort (value) {
      this.accountSort = value
    },
    feedKey () {
      // Do not show the previous feed's rows under the new heading while the
      // first page loads.
      this.posts = []
      this.updatedAt = 0
      this.staleAt = null
      this.applySnapshot()
      this.loadPosts()
    },
    communityKey () {
      this.loadCommunity()
    },
    pollSeconds () {
      this.restartPolling()
      if (Number(this.pollSeconds) > 0) this.refreshPosts()
    }
  },
  mounted () {
    this.loadCommunity()
    this.loadPosts()
    this.restartPolling()
    this.startClock()
  },
  beforeUnmount () {
    this.requestToken += 1
    this.communityToken += 1
    this.stopPolling()
    this.stopClock()
  },
  methods: {
    applySnapshot (snapshot = getHomeSnapshot()) {
      if (this.needsLogin) return false
      const feed = snapshotFeed(this.feed?.key)
      if (!snapshot || !feed?.posts?.length) return false
      this.posts = feed.posts
      this.updatedAt = snapshot.generatedAt
      this.nowTick = snapshot.generatedAt
      this.loading = false
      return true
    },
    restartPolling () {
      this.stopPolling()
      const seconds = Number(this.pollSeconds)
      if (!seconds || seconds < 5) return
      this.poller = pollWhileVisible(() => this.loadPosts({ force: true }), seconds * 1000, { immediate: false })
      this.poller.start()
    },
    stopPolling () {
      if (this.poller) {
        this.poller.stop()
        this.poller = null
      }
    },
    startClock () {
      this.stopClock()
      this.clockTimer = setInterval(() => {
        this.nowTick = Date.now()
      }, 30000)
    },
    stopClock () {
      if (this.clockTimer) {
        clearInterval(this.clockTimer)
        this.clockTimer = null
      }
    },
    changeSort (value) {
      if (value === this.sort) return
      this.sort = value
    },
    snapshotKey () {
      return SNAPSHOT_PREFIX + this.feed.key + ':' + this.limit +
        (this.feed.requiresAccount ? ':' + this.loggedInUser : '')
    },
    async loadCommunity () {
      const token = ++this.communityToken
      this.community = null
      this.avatarFailed = false
      const name = this.feed?.kind === 'community' ? this.feed.community : ''
      if (!name) return
      try {
        const info = await fetchCommunity(name)
        if (token !== this.communityToken) return
        this.community = info || null
      } catch {
        // The #hive-xxxxx heading is a useful fallback; metadata is optional.
      }
    },
    refreshPosts () {
      return this.loadPosts({ force: true })
    },
    async loadPosts ({ force = false } = {}) {
      if (this.needsLogin) {
        this.posts = []
        this.loading = false
        this.refreshing = false
        this.error = ''
        this.staleAt = null
        return
      }
      const token = ++this.requestToken
      this.error = ''
      if (this.posts.length) this.refreshing = true
      else this.loading = true
      try {
        const posts = await fetchFeedPosts(this.feed, {
          limit: this.limit,
          observer: this.loggedInUser || '',
          force
        })
        if (token !== this.requestToken) return
        this.posts = posts
        this.staleAt = null
        this.updatedAt = Date.now()
        this.nowTick = this.updatedAt
        saveSnapshot(this.snapshotKey(), { posts: this.posts })
      } catch (error) {
        if (token !== this.requestToken) return
        console.error('Failed to load home posts', error)
        if (this.posts.length) {
          this.staleAt = this.staleAt || Date.now()
        } else if (!this.restoreSnapshot()) {
          this.error = 'Could not load posts.'
        }
      } finally {
        if (token === this.requestToken) {
          this.loading = false
          this.refreshing = false
        }
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
