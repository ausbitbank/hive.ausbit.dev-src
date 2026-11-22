<template>
  <div class="dw-pulse">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Community</div>
        <h2 class="home-panel__title">{{ heading }}</h2>
      </div>
      <span
        v-if="viewMode === 'single' && summary.community.nsfw"
        class="dw-pulse__badge"
        title="This community is marked NSFW"
      >
        <q-icon name="visibility_off" size="13px" aria-hidden="true" />
        NSFW
      </span>
    </q-card-section>

    <dashboard-widget-state
      :state="viewState"
      :error="loadError"
      guest-title="Log in to see your communities"
      guest-text="Your role and the pulse of the communities you belong to."
      @retry="load"
    />

    <template v-if="viewState === 'ready' || viewState === 'stale'">
      <q-card-section v-if="viewMode === 'single' && !summary.hasCommunity" class="home-panel__state">
        <q-icon name="search_off" size="24px" aria-hidden="true" />
        <span>c/{{ effectiveCommunity }} was not found.</span>
        <router-link to="/communities" class="home-panel__link">Browse communities</router-link>
      </q-card-section>

      <q-card-section v-else-if="viewMode === 'single'" class="dw-pulse__body">
        <dl class="dw-pulse__tiles">
          <div>
            <dt>Subscribers</dt>
            <dd>{{ formatNumber(summary.community.subscribers) }}</dd>
          </div>
          <div>
            <dt>Active authors</dt>
            <dd>{{ formatNumber(summary.community.authors) }}</dd>
          </div>
          <div>
            <dt>Pending rewards</dt>
            <dd>{{ formatHbd(summary.community.pendingRewards) }}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd>{{ roleValue }}</dd>
          </div>
        </dl>

        <router-link v-if="showTopPost && summary.topPost" :to="topPostPath" class="dw-pulse__post">
          <span class="dw-pulse__post-main">
            <span class="dw-pulse__post-label">Top post</span>
            <span class="dw-pulse__post-title">{{ summary.topPost.title }}</span>
            <span class="dw-pulse__post-meta">
              <span title="Votes">
                <q-icon name="thumb_up_alt" size="13px" aria-hidden="true" />{{ summary.topPost.votes }}
              </span>
              <span title="Comments">
                <q-icon name="comment" size="13px" aria-hidden="true" />{{ summary.topPost.comments }}
              </span>
              <span class="dw-pulse__post-author">@{{ summary.topPost.author }}</span>
            </span>
          </span>
          <span class="dw-pulse__post-payout">{{ formatHbd(summary.topPost.payoutHbd) }}</span>
        </router-link>
        <p v-else-if="showTopPost" class="dw-pulse__note">No recent posts to show.</p>

        <p v-if="summary.community.about" class="dw-pulse__about">{{ summary.community.about }}</p>
      </q-card-section>

      <q-card-section v-else class="dw-pulse__body">
        <div v-if="mineCards.length" class="dw-pulse__cards">
          <router-link
            v-for="card in mineCards"
            :key="card.name"
            :to="card.link"
            class="dw-pulse__card"
          >
            <span class="dw-pulse__card-head">
              <span class="dw-pulse__card-title">{{ card.title }}</span>
              <span v-if="card.roleLabel" class="dw-pulse__role">{{ card.roleLabel }}</span>
            </span>
            <span class="dw-pulse__card-stats">
              <span>{{ formatNumber(card.subscribers) }} subscribers</span>
              <span>{{ formatNumber(card.authors) }} authors</span>
            </span>
          </router-link>
        </div>

        <div v-else class="home-panel__state">
          <q-icon name="groups" size="24px" aria-hidden="true" />
          <span>No community subscriptions yet.</span>
          <router-link to="/communities" class="home-panel__link">Browse communities</router-link>
        </div>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <template v-if="viewMode === 'single'">
          <router-link v-if="summary.hasCommunity" :to="communityLink">
            Open c/{{ summary.community.name }}
          </router-link>
          <router-link v-else to="/communities">Browse communities</router-link>
          <span v-if="usingDefault && summary.hasCommunity">Default community — set one in widget settings</span>
          <span v-else-if="summary.hasCommunity && !summary.roleLabel">Public community view</span>
        </template>
        <template v-else>
          <router-link to="/communities">Discover communities</router-link>
          <span>{{ mineCards.length }} of {{ summary.communities.length }} shown</span>
        </template>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="refresh"
          aria-label="Refresh community pulse"
          title="Refresh community pulse"
          :loading="loading"
          @click="load({ force: true })"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-pulse__badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.2rem;
  padding: 0.16rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-warning) 14%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.dw-pulse__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.7rem;
}

.dw-pulse__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 0;
}

.dw-pulse__tiles > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-pulse__tiles dt {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-pulse__tiles dd {
  overflow: hidden;
  margin: 0;
  color: var(--c-text);
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-pulse__post {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text);
  text-decoration: none;
}

.dw-pulse__post:hover {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  text-decoration: none;
}

.dw-pulse__post-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dw-pulse__post-label {
  color: var(--c-text-faint);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-pulse__post-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.3;
}

.dw-pulse__post-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.1rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.dw-pulse__post-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.dw-pulse__post-author {
  color: var(--c-text-faint);
}

.dw-pulse__post-payout {
  flex: none;
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-pulse__cards {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dw-pulse__card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text);
  text-decoration: none;
}

.dw-pulse__card:hover {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  text-decoration: none;
}

.dw-pulse__card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
}

.dw-pulse__card-title {
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-pulse__role {
  flex: none;
  color: var(--c-link-hover);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dw-pulse__card-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-pulse__about {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  line-height: 1.4;
}

.dw-pulse__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

@media (max-width: 599px) {
  .dw-pulse__tiles dd {
    font-size: 0.78rem;
  }

  .dw-pulse__about {
    display: none;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import {
  fetchAccountSubscriptions,
  fetchCommunity,
  fetchCommunityInfoBatch,
  fetchRankedPosts
} from 'src/services/chainData'
import { communityPulseSummary } from 'src/services/communityPulse'
import { tidyNumber } from 'src/services/wallet'

/** The default layout's community; the footer calls out when this is used. */
const DEFAULT_COMMUNITY = 'hive-139531'

function isNotFound (error) {
  const message = String(
    error?.message ||
    error?.cause?.message ||
    error?.data?.message ||
    ''
  )
  return /could not find|not found|unknown community|does not exist/i.test(message)
}

export default {
  name: 'WidgetCommunityPulse',
  components: { DashboardWidgetState },
  props: {
    community: { type: String, default: '' },
    mode: {
      type: String,
      default: 'single',
      validator: value => ['single', 'mine'].includes(value)
    },
    showTopPost: { type: Boolean, default: true }
  },
  data () {
    return {
      record: null,
      posts: [],
      subscriptions: [],
      infoByName: {},
      loading: false,
      loaded: false,
      loadError: '',
      updatedAt: 0,
      requestToken: 0
    }
  },
  computed: {
    username () {
      return this.$hiveStore?.user?.username || ''
    },
    viewMode () {
      return this.mode === 'mine' ? 'mine' : 'single'
    },
    settingCommunity () {
      return String(this.community || '').trim().replace(/^@/, '')
    },
    effectiveCommunity () {
      return this.settingCommunity || DEFAULT_COMMUNITY
    },
    usingDefault () {
      return !this.settingCommunity
    },
    singleRole () {
      return this.record?.context?.role || this.record?.role || ''
    },
    mineCommunities () {
      return this.subscriptions.map(subscription => {
        const record = this.infoByName[subscription.name] || null
        return {
          name: subscription.name,
          title: record?.title || subscription.title || subscription.name,
          role: subscription.role || '',
          guestTitle: subscription.guestTitle || '',
          subscribers: record?.subscribers,
          num_authors: record?.num_authors,
          sum_pending: record?.sum_pending
        }
      })
    },
    summary () {
      return communityPulseSummary({
        community: this.record,
        posts: this.posts,
        role: this.viewMode === 'single' ? this.singleRole : '',
        mode: this.viewMode,
        communities: this.mineCommunities
      })
    },
    mineCards () {
      return this.summary.communities.slice(0, 3)
    },
    heading () {
      if (this.viewMode === 'mine') return 'Your communities'
      return this.summary.community.title || 'Community pulse'
    },
    communityLink () {
      return '/c/' + this.summary.community.name
    },
    topPostPath () {
      const post = this.summary.topPost
      if (!post || !post.author || !post.permlink) return this.communityLink
      return '/@' + post.author + '/' + post.permlink
    },
    roleValue () {
      if (!this.username) return 'Sign in to see'
      return this.summary.roleLabel || 'Not a member'
    },
    viewState () {
      if (this.viewMode === 'mine' && !this.username) return 'guest'
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      return this.loaded ? 'ready' : 'loading'
    }
  },
  watch: {
    viewMode () {
      this.load()
    },
    effectiveCommunity () {
      if (this.viewMode === 'single') this.load()
    },
    username () {
      this.load()
    }
  },
  mounted () {
    this.load()
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
      return tidyNumber(number) + ' HBD'
    },
    async load ({ force = false } = {}) {
      const mode = this.viewMode
      if (mode === 'mine' && !this.username) {
        this.loaded = false
        this.loading = false
        return
      }
      const token = ++this.requestToken
      this.loading = true
      this.loadError = ''
      try {
        if (mode === 'single') await this.loadSingle(force, token)
        else await this.loadMine(force, token)
        if (token !== this.requestToken) return
        this.loaded = true
        this.updatedAt = Date.now()
      } catch (error) {
        if (token !== this.requestToken) return
        console.error('Failed to load the community pulse', error)
        this.loadError = mode === 'single'
          ? 'Could not load this community right now.'
          : 'Could not load your communities right now.'
      } finally {
        if (token === this.requestToken) this.loading = false
      }
    },
    async loadSingle (force, token) {
      const name = this.effectiveCommunity
      const observer = this.username
      let record
      try {
        record = await fetchCommunity(name, observer || null, { force })
      } catch (error) {
        // An unknown community is a not-found state; anything else is an error.
        if (!isNotFound(error)) throw error
        record = null
      }
      if (token !== this.requestToken) return
      this.record = record || null
      this.posts = []
      if (!this.record) return

      try {
        const posts = await fetchRankedPosts({
          sort: 'trending',
          tag: name,
          limit: 1,
          observer: observer || null
        }, { force })
        if (token !== this.requestToken) return
        this.posts = Array.isArray(posts) ? posts : []
      } catch (error) {
        if (token !== this.requestToken) return
        console.error('Failed to load the community top post', error)
        this.posts = []
      }
    },
    async loadMine (force, token) {
      const rows = await fetchAccountSubscriptions(this.username, { force })
      if (token !== this.requestToken) return
      const subscriptions = Array.isArray(rows) ? rows : []
      const titles = new Map(subscriptions.map(row => [row.name, row.title]))
      this.record = null
      this.posts = []
      this.subscriptions = subscriptions
      const info = subscriptions.length
        ? await fetchCommunityInfoBatch(subscriptions.map(row => row.name), {
          force,
          limit: 12,
          titleFor: name => titles.get(name) || name
        })
        : {}
      if (token !== this.requestToken) return
      this.infoByName = info
    }
  }
}
</script>
