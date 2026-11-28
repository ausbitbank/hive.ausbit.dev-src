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
        <q-btn
          v-if="merged"
          flat
          dense
          no-caps
          color="primary"
          icon="tune"
          :label="'Sources'"
          :aria-label="'Configure community feed sources, ' + sources.length + ' of ' + sourceCount + ' selected'"
          @click="openSources"
        >
          <q-badge v-if="remainingSources" color="primary" floating>{{ sources.length }}/{{ sourceCount }}</q-badge>
        </q-btn>
        <q-btn flat dense round icon="refresh" aria-label="Refresh community feed" title="Refresh" :loading="loading" @click="loadFeed({ force: true })" />
      </div>
    </div>

    <q-dialog v-model="sourcesOpen">
      <q-card class="community-sources">
        <q-card-section class="community-sources__head">
          <div>
            <div class="home-eyebrow">Community feed</div>
            <h2 class="community-sources__title">Sources and pinned posts</h2>
          </div>
          <q-btn flat dense round icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="community-sources__body">
          <div class="community-sources__modes" role="radiogroup" aria-label="Source selection mode">
            <button
              v-for="option in sourceModes"
              :key="option.value"
              type="button"
              class="community-sources__mode"
              :class="{ 'community-sources__mode--active': sourceMode === option.value }"
              role="radio"
              :aria-checked="sourceMode === option.value"
              @click="setSourceMode(option.value)"
            >
              <strong>{{ option.label }}</strong>
              <small>{{ option.hint }}</small>
            </button>
          </div>

          <q-toggle
            v-model="hidePinned"
            label="Hide pinned community posts"
            aria-label="Hide pinned community posts from the merged feed"
            @update:model-value="savePrefs"
          />

          <div v-if="sourceMode === 'selected'" class="community-sources__picker">
            <q-input
              v-model="sourceQuery"
              dense
              outlined
              clearable
              label="Filter your communities"
              aria-label="Filter the community source list"
              @clear="sourceQuery = ''"
            >
              <template #prepend><q-icon name="search" size="18px" aria-hidden="true" /></template>
            </q-input>
            <div class="community-sources__list">
              <q-checkbox
                v-for="source in filteredSources"
                :key="source.name"
                :model-value="selectedNames.includes(source.name)"
                :label="source.title + ' (c/' + source.name + ')'"
                dense
                @update:model-value="toggleSource(source.name)"
              />
              <p v-if="!filteredSources.length" class="community-sources__empty">No community matches that filter.</p>
            </div>
            <div class="community-sources__bulk">
              <q-btn flat dense no-caps label="Select all" @click="selectAllSources" />
              <q-btn flat dense no-caps label="Clear" @click="selectedNames = []; savePrefs()" />
            </div>
          </div>

          <p class="community-sources__note">
            {{ sources.length }} of {{ sourceCount }} communities feed this view.
            Loading many sources makes one Hive request per community, so "Top 12" is the quick default.
          </p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn color="primary" no-caps label="Done" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

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

    <q-card v-else-if="!visiblePosts.length" flat bordered class="community-feed__state">
      <q-icon :name="allPostsFiltered ? 'filter_alt_off' : 'forum'" size="24px" aria-hidden="true" />
      <p>{{ allPostsFiltered ? 'All posts loaded here match your ignored tags.' : emptyMessage }}</p>
      <div class="row q-gutter-sm justify-center">
        <q-btn v-if="allPostsFiltered && hasMore" outline no-caps color="primary" icon="expand_more" label="Load more posts" :loading="loadingMore" @click="loadMore" />
        <q-btn outline no-caps color="primary" icon="explore" label="Browse Hive posts" to="/created" />
      </div>
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
          v-for="post in visiblePosts"
          :key="postKey(post)"
          :post="post"
          :style-type="styleType"
          moderation-surface="community"
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
            Using {{ sources.length }} of {{ sourceCount }} communities.
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
import { matchingIgnoredTag } from 'src/services/tagFilters'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'
import moderation from 'src/mixins/moderation'

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
  mixins: [moderation],
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
      staleAt: null,
      sourcesOpen: false,
      sourceMode: 'auto',
      selectedNames: [],
      hidePinned: false,
      sourceQuery: '',
      sourceModes: [
        { value: 'auto', label: 'Top 12', hint: 'The quick default' },
        { value: 'all', label: 'All communities', hint: 'One request per community' },
        { value: 'selected', label: 'Choose', hint: 'Pick specific communities' }
      ]
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
    visiblePosts () {
      if (!this.moderationIgnoredTags.length) return this.posts
      return this.posts.filter(post => !matchingIgnoredTag(post, this.moderationIgnoredTags))
    },
    allPostsFiltered () {
      return this.posts.length > 0 && this.visiblePosts.length === 0
    },
    sources () {
      if (!this.merged) return []
      if (this.sourceMode === 'selected') {
        return this.availableSources.filter(source => this.selectedNames.includes(source.name))
      }
      if (this.sourceMode === 'all') return this.availableSources
      return this.availableSources.slice(0, FEED_SOURCES)
    },
    availableSources () {
      return [...this.sourceRows]
        .filter(row => Array.isArray(row) && row[0])
        .map((row, index) => ({ name: row[0], title: row[1] || row[0], role: row[2] || '', index }))
        .sort((a, b) => communityRoleWeight(b.role) - communityRoleWeight(a.role) || a.index - b.index)
    },
    filteredSources () {
      const needle = String(this.sourceQuery || '').trim().toLowerCase()
      if (!needle) return this.availableSources
      return this.availableSources.filter(source =>
        source.name.toLowerCase().includes(needle) || source.title.toLowerCase().includes(needle)
      )
    },
    sourcesKey () {
      // Reload when the resolved source list, pinned setting or sort changes.
      return this.sources.map(source => source.name).join('|') + ':' + (this.hidePinned ? '1' : '0')
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
    this.loadPrefs()
    this.loadFeed()
  },
  methods: {
    prefsKey () {
      return 'communities:feed:prefs:' + (this.observer || this.loggedInUser || 'guest')
    },
    loadPrefs () {
      const prefs = this.$q.localStorage.getItem(this.prefsKey())
      if (!prefs || typeof prefs !== 'object') return
      if (['auto', 'all', 'selected'].includes(prefs.sourceMode)) this.sourceMode = prefs.sourceMode
      if (Array.isArray(prefs.selectedNames)) this.selectedNames = prefs.selectedNames.filter(Boolean)
      this.hidePinned = Boolean(prefs.hidePinned)
    },
    savePrefs () {
      this.$q.localStorage.set(this.prefsKey(), {
        sourceMode: this.sourceMode,
        selectedNames: this.selectedNames,
        hidePinned: this.hidePinned
      })
    },
    openSources () {
      this.sourcesOpen = true
    },
    setSourceMode (mode) {
      this.sourceMode = mode
      if (mode === 'selected' && !this.selectedNames.length) {
        this.selectedNames = this.availableSources.slice(0, FEED_SOURCES).map(source => source.name)
      }
      this.savePrefs()
    },
    toggleSource (name) {
      if (this.selectedNames.includes(name)) {
        this.selectedNames = this.selectedNames.filter(item => item !== name)
      } else {
        this.selectedNames = [...this.selectedNames, name]
      }
      this.savePrefs()
    },
    selectAllSources () {
      this.selectedNames = this.availableSources.map(source => source.name)
      this.savePrefs()
    },
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
      const merged = mergeCommunityFeeds(feeds, { limit: MERGED_LIMIT, includePinned: !this.hidePinned })
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
  color: var(--c-text);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.25;
}

.community-feed__hint {
  max-width: 70ch;
  margin: 0;
  color: var(--c-text-subtle);
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
  color: var(--c-text-muted);
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
  color: var(--c-warning);
  font-size: 0.82rem;
}

.community-feed__end {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-text-faint);
  font-size: 0.76rem;
}

.community-feed__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.community-sources {
  width: min(560px, 94vw);
  border-radius: var(--radius-card);
}

.community-sources__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.community-sources__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.community-sources__body {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.community-sources__modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.community-sources__mode {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.5rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--c-text-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.community-sources__mode strong {
  font-size: 0.78rem;
}

.community-sources__mode small {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

.community-sources__mode--active {
  border-color: color-mix(in srgb, var(--c-link) 50%, transparent);
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-text);
}

.community-sources__picker {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.community-sources__list {
  display: flex;
  flex-direction: column;
  max-height: 34vh;
  overflow-y: auto;
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.community-sources__empty {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.community-sources__bulk {
  display: flex;
  gap: 0.3rem;
}

.community-sources__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.4;
}

@media (max-width: 599px) {
  .community-feed__head {
    align-items: flex-start;
  }

  .community-sources__modes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
