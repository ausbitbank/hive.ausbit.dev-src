<template>
  <div class="dw-cg">
    <q-card-section class="home-panel__head dw-cg__head">
      <div>
        <div class="home-eyebrow">Community</div>
        <h2 class="home-panel__title">
          <template v-if="summary.name">{{ summary.name }}</template>
          <template v-else>Community growth</template>
        </h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh community growth"
        title="Refresh community growth"
        :loading="loading"
        :disable="!communityName"
        @click="load(true)"
      />
    </q-card-section>

    <q-card-section v-if="!communityName" class="home-panel__state">
      <q-icon name="groups" size="24px" aria-hidden="true" />
      <span>Choose a community in widget settings.</span>
      <router-link to="/communities" class="home-panel__link">Browse communities</router-link>
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
      <p v-if="state === 'stale'" class="dw-cg__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </p>

      <div v-if="!summary.hasData" class="dw-cg__empty">
        <q-icon name="search_off" size="22px" aria-hidden="true" />
        <div>
          <strong>No community totals.</strong>
          <span>Hive returned no subscriber or author counts for {{ communityName }}.</span>
        </div>
      </div>

      <template v-else>
        <q-card-section class="dw-cg__grid" :class="{ 'dw-cg__grid--single': visibleCount === 1 }">
          <article class="dw-cg__stat">
            <div class="dw-cg__stat-head">
              <span class="dw-cg__label">Subscribers</span>
              <span
                v-if="!summary.isNew && summary.subscriberDelta !== null"
                class="dw-cg__delta"
                :class="deltaClass(summary.subscriberDelta)"
              >{{ summary.subscriberDeltaLabel }}</span>
            </div>
            <span class="dw-cg__value">{{ countLabel(summary.subscribers) }}</span>
            <span v-if="!summary.isNew && summary.subscriberRatePerDay !== null" class="dw-cg__hint">
              {{ summary.subscriberRateLabel }} since tracking
            </span>
          </article>

          <article v-if="showAuthors" class="dw-cg__stat">
            <div class="dw-cg__stat-head">
              <span class="dw-cg__label">Active authors</span>
              <span
                v-if="!summary.isNew && summary.authorDelta !== null"
                class="dw-cg__delta"
                :class="deltaClass(summary.authorDelta)"
              >{{ summary.authorDeltaLabel }}</span>
            </div>
            <span class="dw-cg__value">{{ countLabel(summary.authors) }}</span>
            <span v-if="!summary.isNew && summary.authorRatePerDay !== null" class="dw-cg__hint">
              {{ summary.authorRateLabel }} since tracking
            </span>
          </article>

          <article v-if="showPending" class="dw-cg__stat">
            <div class="dw-cg__stat-head">
              <span class="dw-cg__label">Pending rewards</span>
              <span
                v-if="!summary.isNew && summary.pendingDelta !== null"
                class="dw-cg__delta"
                :class="deltaClass(summary.pendingDelta)"
              >{{ summary.pendingDeltaLabel }}</span>
            </div>
            <span class="dw-cg__value">{{ pendingLabel }}</span>
            <span class="dw-cg__hint">sum_pending from Hivemind</span>
          </article>
        </q-card-section>

        <div v-if="summary.isNew" class="dw-cg__new">
          <q-icon name="hourglass_top" size="20px" aria-hidden="true" />
          <div>
            <strong>Tracking starts now</strong>
            <span>This browser saved {{ summary.name }}'s current totals as a baseline. Deltas and daily rates appear after the next refresh.</span>
          </div>
        </div>

        <div v-else class="dw-cg__tracked">
          <span>{{ summary.daysTrackedLabel }}</span>
          <span>{{ visibleCount }} metric{{ visibleCount === 1 ? '' : 's' }} tracked</span>
        </div>
      </template>

      <q-card-section class="home-panel__footer dw-cg__footer">
        <router-link :to="communityPath">Open {{ communityName }}</router-link>
        <span>Local baseline · no history read</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-cg {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-cg__head {
  align-items: flex-start;
}

.dw-cg__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-cg__empty {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.95rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dw-cg__empty .q-icon {
  color: var(--c-text-faint);
  flex: none;
}

.dw-cg__empty strong {
  display: block;
  color: var(--c-text);
}

.dw-cg__empty span {
  display: block;
}

.dw-cg__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 0.4rem;
  padding: 0.7rem 1rem 0.5rem;
}

.dw-cg__grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.dw-cg__stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-cg__stat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dw-cg__label {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-cg__value {
  overflow: hidden;
  color: var(--c-text);
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-cg__delta {
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-cg__delta.is-up {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-cg__delta.is-down {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: var(--c-negative);
}

.dw-cg__delta.is-flat {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-muted);
}

.dw-cg__hint {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.35;
}

.dw-cg__new {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0 1rem 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  line-height: 1.4;
}

.dw-cg__new .q-icon {
  color: var(--c-link);
  flex: none;
}

.dw-cg__new strong {
  display: block;
  color: var(--c-text);
}

.dw-cg__new span {
  display: block;
}

.dw-cg__tracked {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0 1rem 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-cg__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 599px) {
  .dw-cg__grid {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-cg__new {
    margin-left: 0.7rem;
    margin-right: 0.7rem;
  }

  .dw-cg__tracked {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}

@media (max-width: 340px) {
  .dw-cg__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchCommunity } from 'src/services/chainData'
import { communityGrowthSummary } from 'src/services/communityGrowth'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const BASELINE_PREFIX = 'community:growth:'
const BASELINE_TTL_MS = 365 * 24 * 60 * 60 * 1000

function countValue (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null
}

function pendingValue (value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export default {
  name: 'WidgetCommunityGrowth',
  components: { DashboardWidgetState },
  props: {
    community: { type: String, default: '' },
    showAuthors: { type: Boolean, default: true },
    showPending: { type: Boolean, default: true }
  },
  data () {
    return {
      record: null,
      baseline: null,
      loading: false,
      loaded: false,
      loadError: '',
      growthCommunity: ''
    }
  },
  computed: {
    communityName () {
      return String(this.community || '').trim().replace(/^#/, '')
    },
    communityPath () {
      return this.communityName ? '/c/' + this.communityName : '/communities'
    },
    summary () {
      return communityGrowthSummary({
        community: this.record,
        baseline: this.baseline,
        now: Date.now()
      })
    },
    state () {
      if (!this.communityName) return 'idle'
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      return this.loaded ? 'ready' : 'loading'
    },
    visibleCount () {
      return 1 + (this.showAuthors ? 1 : 0) + (this.showPending ? 1 : 0)
    },
    pendingLabel () {
      const value = this.summary.pendingRewards
      if (value === null) return '—'
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' HBD'
    }
  },
  watch: {
    communityName (value) {
      if (!value || (this.growthCommunity && value !== this.growthCommunity)) this.reset()
      if (value) this.load(false)
    }
  },
  mounted () {
    if (this.communityName) this.load(false)
  },
  methods: {
    countLabel (value) {
      return value === null ? '—' : Number(value).toLocaleString('en-US')
    },
    deltaClass (value) {
      if (value === null) return 'is-muted'
      if (value > 0) return 'is-up'
      if (value < 0) return 'is-down'
      return 'is-flat'
    },
    reset () {
      this.record = null
      this.baseline = null
      this.loaded = false
      this.loading = false
      this.loadError = ''
      this.growthCommunity = ''
    },
    baselineName (name) {
      return BASELINE_PREFIX + name
    },
    readBaseline (name, now) {
      const stored = loadSnapshot(this.baselineName(name), { now, ttlMs: BASELINE_TTL_MS })
      const data = stored?.data
      if (!data) return null
      const firstAt = Number(data.firstAt)
      const firstSubscribers = countValue(data.firstSubscribers)
      if (!Number.isFinite(firstAt) || firstAt <= 0 || firstSubscribers === null) return null
      return {
        firstAt,
        firstSubscribers,
        firstAuthors: countValue(data.firstAuthors),
        firstPendingRewards: pendingValue(data.firstPendingRewards),
        lastAt: Number.isFinite(Number(data.lastAt)) && Number(data.lastAt) > 0 ? Number(data.lastAt) : firstAt,
        lastSubscribers: countValue(data.lastSubscribers) ?? firstSubscribers,
        lastAuthors: countValue(data.lastAuthors) ?? countValue(data.firstAuthors),
        lastPendingRewards: pendingValue(data.lastPendingRewards) ?? pendingValue(data.firstPendingRewards)
      }
    },
    saveBaseline (name, data, now) {
      saveSnapshot(this.baselineName(name), data, { now, ttlMs: BASELINE_TTL_MS })
    },
    async load (force = false) {
      const name = this.communityName
      if (!name) return
      this.loading = true
      this.loadError = ''
      try {
        const record = await fetchCommunity(name, null, { force })
        if (this.communityName !== name) return
        if (!record || typeof record !== 'object') {
          throw new Error('Empty community response')
        }

        const subscribers = countValue(record.subscribers)
        const authors = countValue(record.num_authors ?? record.authors)
        const pendingRewards = pendingValue(record.sum_pending ?? record.pendingRewards)
        if (subscribers === null && authors === null && pendingRewards === null) {
          throw new Error('No community totals in the response')
        }

        const now = Date.now()
        const existing = this.readBaseline(name, now)
        let next = null
        if (existing) {
          next = {
            firstAt: existing.firstAt,
            firstSubscribers: existing.firstSubscribers,
            firstAuthors: existing.firstAuthors,
            firstPendingRewards: existing.firstPendingRewards,
            lastAt: now,
            lastSubscribers: subscribers === null ? existing.lastSubscribers : subscribers,
            lastAuthors: authors === null ? existing.lastAuthors : authors,
            lastPendingRewards: pendingRewards === null ? existing.lastPendingRewards : pendingRewards
          }
        } else if (subscribers !== null) {
          next = {
            firstAt: now,
            firstSubscribers: subscribers,
            firstAuthors: authors,
            firstPendingRewards: pendingRewards,
            lastAt: now,
            lastSubscribers: subscribers,
            lastAuthors: authors,
            lastPendingRewards: pendingRewards
          }
        }

        this.growthCommunity = name
        this.record = { ...record, name }
        this.baseline = next
        if (next) this.saveBaseline(name, next, now)
        this.loaded = true
      } catch (error) {
        if (this.communityName !== name) return
        console.error('Failed to load community growth for ' + name, error)
        this.loadError = this.loaded
          ? 'Community totals could not refresh — showing the last known values.'
          : 'Could not load community totals for ' + name + '.'
      } finally {
        if (this.communityName === name) this.loading = false
      }
    }
  }
}
</script>
