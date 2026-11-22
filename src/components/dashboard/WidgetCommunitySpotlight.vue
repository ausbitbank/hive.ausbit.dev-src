<template>
  <div class="dw-spot">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Discover</div>
        <h2 class="home-panel__title">Community spotlight</h2>
      </div>
      <span
        v-if="summary.card && summary.card.nsfw"
        class="dw-spot__nsfw"
        title="This community is marked NSFW"
      >
        <q-icon name="visibility_off" size="12px" aria-hidden="true" />
        NSFW
      </span>
    </q-card-section>

    <dashboard-widget-state
      v-if="state === 'loading'"
      state="loading"
    />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'Communities are unavailable right now.'"
      @retry="reload"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale'" class="dw-spot__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>Showing the last loaded community.</span>
      </q-card-section>

      <q-card-section v-if="!summary.hasCard" class="home-panel__state">
        <q-icon name="travel_explore" size="22px" aria-hidden="true" />
        <span>No community to spotlight right now.</span>
        <router-link to="/communities" class="home-panel__link">Browse communities</router-link>
      </q-card-section>

      <q-card-section v-else class="dw-spot__body">
        <router-link :to="summary.card.link" class="dw-spot__card">
          <span class="dw-spot__title">{{ summary.card.title }}</span>

          <span v-if="summary.card.about" class="dw-spot__about">{{ summary.card.about }}</span>

          <dl class="dw-spot__stats">
            <div>
              <dt>Subscribers</dt>
              <dd>{{ formatNumber(summary.card.subscribers) }}</dd>
            </div>
            <div>
              <dt>Authors</dt>
              <dd>{{ formatNumber(summary.card.authors) }}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{{ formatHbd(summary.card.pendingRewards) }}</dd>
            </div>
          </dl>

          <span class="dw-spot__cta">
            Visit c/{{ summary.card.name }}
            <q-icon name="arrow_forward" size="13px" aria-hidden="true" />
          </span>
        </router-link>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link to="/communities">Browse communities</router-link>
        <span class="dw-spot__hint">Rotates daily (UTC)</span>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="refresh"
          aria-label="Refresh community spotlight"
          title="Refresh community spotlight"
          :loading="loading"
          @click="reload"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-spot {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-spot__nsfw {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.2rem;
  padding: 0.14rem 0.45rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-warning) 14%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.dw-spot__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-spot__body {
  padding-top: 0.55rem;
}

.dw-spot__card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text);
  text-decoration: none;
}

.dw-spot__card:hover {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  text-decoration: none;
}

.dw-spot__title {
  overflow: hidden;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-spot__about {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  line-height: 1.45;
}

.dw-spot__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3rem;
  margin: 0;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.dw-spot__stats > div {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.dw-spot__stats dt {
  color: var(--c-text-faint);
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-spot__stats dd {
  overflow: hidden;
  margin: 0;
  color: var(--c-text);
  font-size: 0.76rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-spot__cta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.2rem;
  color: var(--c-link);
  font-size: 0.68rem;
  font-weight: 600;
}

.dw-spot__hint {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

@media (max-width: 479px) {
  .dw-spot__about {
    -webkit-line-clamp: 2;
  }

  .dw-spot__hint {
    display: none;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { apiListCommunities } from 'src/services/api'
import { buildDirectoryCards } from 'src/services/communityDirectory'
import { communitySpotlightSummary } from 'src/services/communitySpotlight'
import { tidyNumber } from 'src/services/wallet'

export default {
  name: 'WidgetCommunitySpotlight',
  components: { DashboardWidgetState },
  props: {
    hideNsfw: { type: Boolean, default: true }
  },
  data () {
    return {
      cards: [],
      loading: false,
      loaded: false,
      loadError: '',
      requestToken: 0
    }
  },
  computed: {
    summary () {
      return communitySpotlightSummary({
        communities: this.cards,
        hideNsfw: this.hideNsfw
      })
    },
    state () {
      if (!this.loaded) return this.loadError ? 'error' : 'loading'
      return this.loadError ? 'stale' : 'ready'
    }
  },
  mounted () {
    this.load()
  },
  beforeUnmount () {
    this.requestToken += 1
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
    reload () {
      this.load({ force: true })
    },
    async load () {
      const token = ++this.requestToken
      this.loading = true
      this.loadError = ''
      try {
        const records = await apiListCommunities({ last: '', limit: 20, query: null, sort: 'rank' })
        if (token !== this.requestToken) return
        this.cards = buildDirectoryCards(Array.isArray(records) ? records : [])
        this.loaded = true
      } catch (error) {
        if (token !== this.requestToken) return
        console.error('Failed to load community spotlight', error)
        this.loadError = 'Could not load communities right now.'
      } finally {
        if (token === this.requestToken) this.loading = false
      }
    }
  }
}
</script>
