<template>
  <div class="dw-creator">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Creator</div>
        <h2 class="home-panel__title">
          <template v-if="accountLabel">@{{ accountLabel }}</template>
          <template v-else>Creator stats</template>
        </h2>
      </div>
      <span class="dw-creator__window">Last {{ windowDays }} days</span>
    </q-card-section>

    <dashboard-widget-state
      :state="viewState"
      :error="stateError"
      guest-title="Log in to see your creator stats"
      guest-text="Author and curation rewards, pending payouts and your best recent post."
      @retry="refresh"
    />

    <template v-if="viewState === 'ready' || viewState === 'stale'">
      <q-card-section v-if="!summary.hasData && !historyError" class="home-panel__state">
        <q-icon name="insights" size="24px" aria-hidden="true" />
        <span>No posts or rewards in the last {{ summary.windowDays }} days.</span>
        <router-link to="/compose" class="home-panel__link">Write a post</router-link>
      </q-card-section>

      <q-card-section v-else class="dw-creator__body">
        <dl class="dw-creator__tiles">
          <div>
            <dt>Author rewards</dt>
            <dd>{{ authorLabel }}</dd>
            <small v-if="!pricesReady">HIVE + HBD + HP</small>
          </div>
          <div>
            <dt>Curation rewards</dt>
            <dd>{{ curationLabel }}</dd>
            <small v-if="!pricesReady">paid as HP</small>
          </div>
          <div>
            <dt>Pending payouts</dt>
            <dd>{{ pendingLabel }}</dd>
            <small v-if="summary.pending.count">
              {{ summary.pending.count }} {{ summary.pending.count === 1 ? 'post' : 'posts' }} awaiting
            </small>
          </div>
          <div>
            <dt>Posts / votes / comments</dt>
            <dd class="dw-creator__counts">
              {{ summary.counts.posts }} / {{ summary.counts.votes }} / {{ summary.counts.comments }}
            </dd>
            <small>in this window</small>
          </div>
        </dl>

        <p
          v-if="showCurationApr && summary.curationApr !== null"
          class="dw-creator__apr"
          :title="curationHint"
        >
          <q-icon name="trending_up" size="14px" aria-hidden="true" />
          <span>Curation {{ summary.curationAprLabel }}</span>
        </p>
        <p v-else-if="showCurationApr" class="dw-creator__note">
          Curation APR needs staked HP and curation rewards in this window.
        </p>

        <router-link
          v-if="showTopPost && summary.topPost"
          :to="topPostPath"
          class="dw-creator__post"
        >
          <span class="dw-creator__post-main">
            <span class="dw-creator__post-label">Top post</span>
            <span class="dw-creator__post-title">{{ summary.topPost.title }}</span>
            <span class="dw-creator__post-meta">
              <span title="Votes">
                <q-icon name="thumb_up_alt" size="13px" aria-hidden="true" />{{ summary.topPost.votes }}
              </span>
              <span title="Comments">
                <q-icon name="comment" size="13px" aria-hidden="true" />{{ summary.topPost.comments }}
              </span>
            </span>
          </span>
          <span class="dw-creator__post-payout">
            <span class="dw-creator__post-amount">{{ topPostPayoutLabel }}</span>
            <span class="dw-creator__post-state">{{ summary.topPost.pending ? 'pending' : 'paid' }}</span>
          </span>
        </router-link>

        <p v-if="summary.counts.posts === 0" class="dw-creator__note">
          No posts in the last {{ summary.windowDays }} days.
        </p>
        <p v-if="postsError" class="dw-creator__note">{{ postsError }} Showing the last loaded posts.</p>
        <p v-if="historyError" class="dw-creator__note">{{ historyError }}</p>
        <p v-else-if="summary.truncated" class="dw-creator__note">
          Reward history is capped at the newest 1,000 operations.
        </p>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link to="/compose">Write a post</router-link>
        <router-link v-if="accountLabel" :to="blogPath">@{{ accountLabel }} blog</router-link>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="refresh"
          aria-label="Refresh creator stats"
          title="Refresh creator stats"
          :loading="loading || postsLoading || historyLoading"
          @click="refresh"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-creator__window {
  flex: none;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-creator__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.7rem;
}

.dw-creator__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 0;
}

.dw-creator__tiles > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-creator__tiles dt {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-creator__tiles dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dw-creator__tiles small {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  line-height: 1.3;
}

.dw-creator__counts {
  letter-spacing: 0.01em;
}

.dw-creator__apr {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  margin: 0;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 9%, transparent);
  color: var(--c-link-hover);
  font-size: 0.72rem;
  font-weight: 600;
}

.dw-creator__post {
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

.dw-creator__post:hover {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  text-decoration: none;
}

.dw-creator__post-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dw-creator__post-label {
  color: var(--c-text-faint);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-creator__post-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.3;
}

.dw-creator__post-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.1rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.dw-creator__post-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.dw-creator__post-payout {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  text-align: right;
}

.dw-creator__post-amount {
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-creator__post-state {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-creator__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.4;
}

@media (max-width: 599px) {
  .dw-creator__tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dw-creator__tiles dd {
    font-size: 0.78rem;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import {
  fetchAccountHistory,
  fetchAccountPosts
} from 'src/services/chainData'
import { creatorStatsSummary } from 'src/services/creatorStats'
import { formatUsd, tidyNumber } from 'src/services/wallet'

const HISTORY_LIMIT = 1000

export default {
  name: 'WidgetCreatorStats',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    windowDays: { type: Number, default: 7 },
    showCurationApr: { type: Boolean, default: true },
    showTopPost: { type: Boolean, default: true }
  },
  data () {
    return {
      posts: [],
      history: [],
      postsLoading: false,
      postsError: '',
      historyLoading: false,
      historyError: '',
      historyTruncated: false,
      requestToken: 0,
      forceNext: false
    }
  },
  computed: {
    accountLabel () {
      return this.summary.accountName || this.accountName
    },
    summary () {
      return creatorStatsSummary({
        posts: this.posts,
        history: this.history,
        account: this.accountRecord,
        globalProps: this.globalProps,
        prices: this.prices,
        windowDays: this.windowDays,
        historyTruncated: this.historyTruncated
      })
    },
    hiveUsd () {
      const value = Number(this.prices?.hive?.usd)
      return Number.isFinite(value) && value > 0 ? value : 0
    },
    hbdUsd () {
      const value = Number(this.prices?.hive_dollar?.usd)
      if (Number.isFinite(value) && value > 0) return value
      return this.hiveUsd > 0 ? 1 : 0
    },
    pricesReady () {
      return this.hiveUsd > 0
    },
    authorUsd () {
      const rewards = this.summary.rewards
      return (rewards.authorHive + rewards.authorHp) * this.hiveUsd + rewards.authorHbd * this.hbdUsd
    },
    curationUsd () {
      return this.summary.rewards.curationHive * this.hiveUsd
    },
    authorLabel () {
      if (this.pricesReady) return formatUsd(this.authorUsd)
      return this.amountParts([
        [this.summary.rewards.authorHive, 'HIVE'],
        [this.summary.rewards.authorHbd, 'HBD'],
        [this.summary.rewards.authorHp, 'HP']
      ])
    },
    curationLabel () {
      if (this.pricesReady) return formatUsd(this.curationUsd)
      return this.amountParts([[this.summary.rewards.curationHp, 'HP']])
    },
    pendingLabel () {
      const pending = this.summary.pending
      if (!pending.count && !pending.hbd) return '—'
      if (this.pricesReady && pending.usd > 0) return formatUsd(pending.usd)
      return tidyNumber(pending.hbd) + ' HBD'
    },
    topPostPayoutLabel () {
      const post = this.summary.topPost
      if (!post || post.payoutHbd <= 0) return 'No payout yet'
      return tidyNumber(post.payoutHbd) + ' HBD'
    },
    topPostPath () {
      const post = this.summary.topPost
      if (!post || !post.author || !post.permlink) return '/'
      return '/@' + post.author + '/' + post.permlink
    },
    blogPath () {
      return '/@' + (this.accountLabel || this.targetAccount) + '/blog'
    },
    curationHint () {
      return 'Estimated by annualising curation rewards in the last ' +
        this.summary.windowDays + ' days against your current staked HP.'
    },
    viewState () {
      if (!this.targetAccount) return 'guest'
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      if (!this.loaded) return 'loading'
      if (this.postsError) return this.posts.length ? 'stale' : 'error'
      if (this.postsLoading && !this.posts.length) return 'loading'
      return 'ready'
    },
    stateError () {
      return this.loadError || this.postsError
    }
  },
  methods: {
    applyAccountData (result) {
      const force = this.forceNext
      this.forceNext = false
      this.loadCreator(result.accountName || this.targetAccount, { force })
    },
    refresh () {
      if (!this.targetAccount) return
      this.forceNext = true
      this.reload()
    },
    amountParts (pairs) {
      const parts = pairs
        .filter(([value]) => Number(value) > 0)
        .map(([value, unit]) => tidyNumber(value) + ' ' + unit)
      return parts.length ? parts.join(' · ') : '—'
    },
    async loadCreator (name, { force = false } = {}) {
      if (!name) {
        this.posts = []
        this.history = []
        return
      }
      const token = ++this.requestToken
      this.postsLoading = true
      this.postsError = ''
      this.historyLoading = true
      this.historyError = ''
      this.historyTruncated = false

      const postsRequest = fetchAccountPosts({
        sort: 'blog',
        account: name,
        observer: name,
        // bridge.get_account_posts caps this at 20; a larger value is rejected
        // by the node before any rows are returned.
        limit: 20
      }, { force })
        .then(list => {
          if (token !== this.requestToken) return
          this.posts = Array.isArray(list) ? list : []
        })
        .catch(error => {
          if (token !== this.requestToken) return
          console.error('Failed to load creator posts', error)
          this.postsError = 'Could not load recent posts.'
        })
        .finally(() => {
          if (token === this.requestToken) this.postsLoading = false
        })

      const historyRequest = fetchAccountHistory(name, { limit: HISTORY_LIMIT, force })
        .then(list => {
          if (token !== this.requestToken) return
          this.history = list
          this.historyTruncated = list.length >= HISTORY_LIMIT
        })
        .catch(error => {
          if (token !== this.requestToken) return
          console.error('Failed to load creator reward history', error)
          this.history = []
          this.historyError = 'Reward history unavailable — showing post activity only.'
        })
        .finally(() => {
          if (token === this.requestToken) this.historyLoading = false
        })

      await Promise.all([postsRequest, historyRequest])
    }
  }
}
</script>
