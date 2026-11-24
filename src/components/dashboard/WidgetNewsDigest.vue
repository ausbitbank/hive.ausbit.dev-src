<template>
  <div class="dw-news">
    <q-card-section class="home-panel__head dw-news__head">
      <div>
        <div class="home-eyebrow">Curated digest</div>
        <h2 class="home-panel__title">Hive news</h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh the news digest"
        title="Refresh the news digest"
        :loading="loading"
        :disable="!curatedAccounts.length"
        @click="load(true)"
      />
    </q-card-section>

    <q-card-section v-if="!curatedAccounts.length" class="home-panel__state">
      <q-icon name="newspaper" size="24px" aria-hidden="true" />
      <span>Add curated accounts in widget settings.</span>
      <router-link to="/search" class="home-panel__link">Find accounts</router-link>
    </q-card-section>

    <dashboard-widget-state
      v-else-if="state === 'loading'"
      state="loading"
    />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError"
      @retry="load(true)"
    />

    <template v-else>
      <p v-if="summary.partial" class="dw-news__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ summary.failures.length }} source{{ summary.failures.length === 1 ? '' : 's' }} could not refresh; showing the other accounts.</span>
      </p>

      <div v-if="!summary.hasData" class="dw-news__empty">
        <q-icon name="article" size="22px" aria-hidden="true" />
        <div>
          <strong>No recent posts.</strong>
          <span>The curated accounts have nothing new, or their feeds could not be read.</span>
        </div>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="load(true)" />
      </div>

      <ul v-else class="dw-news__list">
        <li v-for="post in summary.posts" :key="post.id" class="dw-news__item">
          <router-link :to="postPath(post)" class="dw-news__title">{{ post.title }}</router-link>
          <div class="dw-news__meta">
            <span class="dw-news__source">@{{ post.source }}</span>
            <span>{{ relativeTime(post.created) }}</span>
            <span>{{ post.votes }} votes · {{ post.comments }} comments</span>
            <span v-if="showPayout" class="dw-news__payout">
              {{ payoutLabel(post) }}
            </span>
          </div>
        </li>
      </ul>

      <q-card-section class="home-panel__footer dw-news__footer">
        <span class="dw-news__sources">Curated: {{ curatedAccounts.map(name => '@' + name).join(', ') }}</span>
        <span>{{ summary.total }} post{{ summary.total === 1 ? '' : 's' }} merged</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-news {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-news__head {
  align-items: flex-start;
}

.dw-news__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-news__empty {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.95rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dw-news__empty .q-icon {
  color: var(--c-text-faint);
  flex: none;
}

.dw-news__empty strong {
  display: block;
  color: var(--c-text);
}

.dw-news__empty span {
  display: block;
}

.dw-news__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0 1rem;
  list-style: none;
}

.dw-news__item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.5rem 0;
  border-top: 1px solid var(--border-subtle);
}

.dw-news__item:first-child {
  border-top: 0;
  padding-top: 0.25rem;
}

.dw-news__title {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  text-decoration: none;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dw-news__title:hover {
  color: var(--c-link);
  text-decoration: underline;
}

.dw-news__meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.15rem 0.5rem;
  color: var(--c-text-faint);
  font-size: 0.67rem;
  font-variant-numeric: tabular-nums;
}

.dw-news__source {
  color: var(--c-link-soft);
  font-weight: 600;
}

.dw-news__payout {
  color: var(--c-text-subtle);
}

.dw-news__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.dw-news__sources {
  overflow: hidden;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .dw-news__list {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchAccountPosts } from 'src/services/chainData'
import { newsDigestSummary, normaliseNewsAccounts } from 'src/services/newsDigest'
import { tidyNumber } from 'src/services/wallet'
import { relativeTime } from 'src/services/witnesses'

const FEED_LIMIT = 3

export default {
  name: 'WidgetNewsDigest',
  components: { DashboardWidgetState },
  props: {
    accounts: { type: Array, default: () => [] },
    limit: { type: Number, default: 6 },
    showPayout: { type: Boolean, default: true }
  },
  data () {
    return {
      feeds: [],
      loading: false,
      loaded: false,
      loadError: ''
    }
  },
  computed: {
    curatedAccounts () {
      return normaliseNewsAccounts(this.accounts)
    },
    summary () {
      return newsDigestSummary({
        accounts: this.curatedAccounts,
        feeds: this.feeds,
        limit: this.limit
      })
    },
    state () {
      if (!this.curatedAccounts.length) return 'empty'
      if (this.loading && this.loaded) return this.loaded ? 'ready' : 'loading'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      return this.loaded ? 'ready' : 'loading'
    }
  },
  watch: {
    curatedAccounts (value) {
      if (value.length) this.load(false)
    }
  },
  mounted () {
    if (this.curatedAccounts.length) this.load(false)
    else this.loaded = true
  },
  methods: {
    relativeTime,
    postPath (post) {
      return '/@' + post.author + '/' + post.permlink
    },
    payoutLabel (post) {
      const value = Number(post.payoutHbd)
      if (!Number.isFinite(value) || value <= 0) return post.pending ? 'pending' : '—'
      return tidyNumber(value, 2) + ' HBD' + (post.pending ? ' pending' : '')
    },
    async load (force = false) {
      const accounts = this.curatedAccounts
      if (!accounts.length) return
      this.loading = true
      this.loadError = ''
      const results = await Promise.allSettled(
        accounts.map(account => fetchAccountPosts({
          sort: 'blog',
          account,
          observer: account,
          limit: FEED_LIMIT
        }, { force }))
      )
      this.feeds = results.map((result, index) => ({
        account: accounts[index],
        posts: result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [],
        error: result.status === 'rejected'
          ? (result.reason?.message || 'Feed read failed')
          : ''
      }))
      if (this.feeds.every(feed => feed.error)) {
        this.loadError = 'None of the curated feeds could be read right now.'
      }
      this.loaded = true
      this.loading = false
    }
  }
}
</script>
