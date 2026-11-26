<template>
  <div class="dw-tags">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Discovery</div>
        <h2 class="home-panel__title">Trending tags</h2>
      </div>
    </q-card-section>

    <dashboard-widget-state
      v-if="state === 'loading'"
      state="loading"
    />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'Trending tags are unavailable right now.'"
      @retry="reload"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale'" class="dw-tags__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>Showing the last loaded tags.</span>
      </q-card-section>

      <q-card-section v-if="!summary.hasData" class="home-panel__state">
        <q-icon name="tag" size="22px" aria-hidden="true" />
        <span>No trending tags right now.</span>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="reload" />
      </q-card-section>

      <q-card-section v-else class="dw-tags__body">
        <ul class="dw-tags__list" role="list">
          <li v-for="row in summary.rows" :key="row.name">
            <router-link :to="row.link" class="dw-tags__row">
              <span class="dw-tags__name">#{{ row.name }}</span>
              <span class="dw-tags__stats">
                <span :title="row.posts + ' posts'" class="dw-tags__stat">
                  <q-icon name="article" size="12px" aria-hidden="true" />{{ row.posts }}
                </span>
                <span :title="row.comments + ' comments'" class="dw-tags__stat is-comments">
                  <q-icon name="comment" size="12px" aria-hidden="true" />{{ row.comments }}
                </span>
              </span>
              <span v-if="showRewards" class="dw-tags__payout">{{ row.payoutLabel }}</span>
            </router-link>
          </li>
        </ul>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link to="/trending">All trending posts</router-link>
        <span class="dw-tags__source">{{ sourceLabel }}</span>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="refresh"
          aria-label="Refresh trending tags"
          title="Refresh trending tags"
          :loading="loading"
          @click="reload"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-tags {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-tags__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-tags__body {
  padding: 0.35rem 1rem 0.25rem;
}

.dw-tags__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-tags__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.4rem 0.15rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text);
  text-decoration: none;
}

.dw-tags__list li:first-child .dw-tags__row {
  border-top: 0;
}

.dw-tags__row:hover {
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  text-decoration: none;
}

.dw-tags__name {
  flex: 1;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-tags__stats {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.45rem;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-tags__stat {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.dw-tags__payout {
  flex: none;
  min-width: 4.5rem;
  color: var(--c-text-soft);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.dw-tags__source {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

@media (max-width: 479px) {
  .dw-tags__stat.is-comments {
    display: none;
  }

  .dw-tags__payout {
    min-width: 0;
    font-size: 0.64rem;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchRankedPosts } from 'src/services/chainData'
import { postTags } from 'src/services/posts'
import { trendingTagsSummary } from 'src/services/trendingTagsSummary'
import { isValidTag } from 'src/utils/hiveTag'

function payoutOf (post) {
  const paid = Number(post && post.payout)
  const pending = parseFloat(post && post.pending_payout_value)
  const values = [paid, pending].filter(value => Number.isFinite(value) && value > 0)
  return values.length ? Math.max(...values) : 0
}

/** Fallback when `get_trending_tags` is disabled: aggregate the trending feed. */
function aggregateTagRows (posts) {
  const map = new Map()
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!post || !post.author) continue
    const payout = payoutOf(post)
    const comments = Number(post.children ?? post.replies) || 0
    for (const tag of postTags(post, 3)) {
      let row = map.get(tag)
      if (!row) {
        row = { name: tag, posts: 0, comments: 0, total_payouts: 0 }
        map.set(tag, row)
      }
      row.posts += 1
      row.comments += comments
      row.total_payouts += payout
    }
  }
  return [...map.values()].sort((a, b) =>
    b.posts - a.posts ||
    b.total_payouts - a.total_payouts ||
    a.name.localeCompare(b.name)
  )
}

export default {
  name: 'WidgetTrendingTags',
  components: { DashboardWidgetState },
  props: {
    limit: { type: Number, default: 8 },
    showRewards: { type: Boolean, default: true }
  },
  data () {
    return {
      tags: [],
      source: '',
      loading: false,
      loaded: false,
      loadError: '',
      requestToken: 0
    }
  },
  computed: {
    summary () {
      // Tag rows come from post metadata and `get_trending_tags`, neither of
      // which filters chain-invalid tags (e.g. `banksia.io`).
      const tags = (Array.isArray(this.tags) ? this.tags : [])
        .filter(tag => isValidTag(String((tag && tag.name) || '')))
      return trendingTagsSummary({ tags, limit: this.limit })
    },
    sourceLabel () {
      if (this.source === 'feed') return 'From trending posts'
      return 'Chain tag ranks'
    },
    state () {
      if (!this.loaded) return this.loadError ? 'error' : 'loading'
      return this.loadError ? 'stale' : 'ready'
    }
  },
  watch: {
    limit () {
      this.reload()
    }
  },
  mounted () {
    this.load()
  },
  beforeUnmount () {
    this.requestToken += 1
  },
  methods: {
    reload () {
      this.load({ force: true })
    },
    async load ({ force = false } = {}) {
      const token = ++this.requestToken
      this.loading = true
      this.loadError = ''
      let source = 'chain'
      let tags = null

      try {
        const requested = Math.max(1, Math.floor(Number(this.limit) || 8) * 2)
        const limit = Math.min(20, requested)
        try {
          const response = await this.$hive.api.callAsync('condenser_api.get_trending_tags', ['', limit])
          if (Array.isArray(response) && response.length) tags = response
        } catch (error) {
          console.error('Failed to load trending tags', error)
        }

        if (!tags) {
          source = 'feed'
          const posts = await fetchRankedPosts({ sort: 'trending', tag: '', limit: 20 }, { force })
          tags = aggregateTagRows(posts)
        }

        if (token !== this.requestToken) return
        this.tags = Array.isArray(tags) ? tags : []
        this.source = source
        this.loaded = true
      } catch (error) {
        if (token !== this.requestToken) return
        console.error('Failed to load trending tags', error)
        this.loadError = 'Could not load trending tags right now.'
      } finally {
        if (token === this.requestToken) this.loading = false
      }
    }
  }
}
</script>
