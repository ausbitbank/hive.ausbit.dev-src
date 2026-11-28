<template>
  <div class="dw-fg">
    <q-card-section class="home-panel__head dw-fg__head">
      <div>
        <div class="home-eyebrow">Audience</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }}</template>
          <template v-else>Follower growth</template>
        </h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh follower growth"
        title="Refresh follower growth"
        :loading="loading || countLoading"
        @click="refresh"
      />
    </q-card-section>

    <dashboard-widget-state
      :state="displayState"
      :error="stateError"
      guest-title="Log in to track follower growth"
      guest-text="Followers, following and growth measured from a baseline saved in this browser."
      @retry="refresh"
    />

    <template v-if="displayState === 'ready' || displayState === 'stale'">
      <p v-if="staleNotice" class="dw-fg__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ staleNotice }}</span>
      </p>

      <div v-if="!summary.hasCounts" class="dw-fg__empty">
        <q-icon name="person_off" size="22px" aria-hidden="true" />
        <div>
          <strong>Follower counts unavailable.</strong>
          <span>Hive returned no follower count for @{{ accountName }}.</span>
        </div>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="refresh" />
      </div>

      <template v-else>
        <q-card-section class="dw-fg__grid" :class="{ 'dw-fg__grid--single': !showFollowing }">
          <article class="dw-fg__stat">
            <div class="dw-fg__stat-head">
              <span class="dw-fg__label">Followers</span>
              <span
                v-if="!summary.isNew && summary.followerDelta !== null"
                class="dw-fg__delta"
                :class="deltaClass(summary.followerDelta)"
              >{{ summary.followerDeltaLabel }}</span>
            </div>
            <span class="dw-fg__value">{{ countLabel(summary.followers) }}</span>
            <span v-if="!summary.isNew && summary.followerRatePerDay !== null" class="dw-fg__hint">
              {{ summary.followerRateLabel }} since tracking
            </span>
          </article>

          <article v-if="showFollowing" class="dw-fg__stat">
            <div class="dw-fg__stat-head">
              <span class="dw-fg__label">Following</span>
              <span
                v-if="!summary.isNew && summary.followingDelta !== null"
                class="dw-fg__delta"
                :class="deltaClass(summary.followingDelta)"
              >{{ summary.followingDeltaLabel }}</span>
            </div>
            <span class="dw-fg__value">{{ countLabel(summary.following) }}</span>
            <span v-if="!summary.isNew && summary.followingRatePerDay !== null" class="dw-fg__hint">
              {{ summary.followingRateLabel }} since tracking
            </span>
          </article>
        </q-card-section>

        <div v-if="summary.isNew" class="dw-fg__new">
          <q-icon name="hourglass_top" size="20px" aria-hidden="true" />
          <div>
            <strong>Tracking starts now</strong>
            <span>This browser saved @{{ accountName }}'s current counts as a baseline. Deltas and daily rates appear after the next refresh.</span>
          </div>
        </div>

        <div v-else class="dw-fg__tracked">
          <span>{{ summary.daysTrackedLabel }}</span>
          <span v-if="summary.followerRatePerDay !== null">{{ summary.followerRateLabel }}</span>
        </div>
      </template>

      <q-card-section class="home-panel__footer dw-fg__footer">
        <div class="dw-fg__links">
          <router-link :to="followersPath">Followers</router-link>
          <router-link v-if="showFollowing" :to="followingPath">Following</router-link>
        </div>
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          color="primary"
          icon="refresh"
          label="Refresh"
          :loading="loading || countLoading"
          @click="refresh"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-fg {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-fg__head {
  align-items: flex-start;
}

.dw-fg__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-fg__empty {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.95rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dw-fg__empty .q-icon {
  color: var(--c-text-faint);
  flex: none;
}

.dw-fg__empty strong {
  display: block;
  color: var(--c-text);
}

.dw-fg__empty span {
  display: block;
}

.dw-fg__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 0.4rem;
  padding: 0.7rem 1rem 0.5rem;
}

.dw-fg__grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.dw-fg__stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-fg__stat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dw-fg__label {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-fg__value {
  color: var(--c-text);
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-fg__delta {
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-fg__delta.is-up {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-fg__delta.is-down {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: color-mix(in srgb, var(--c-negative) 85%, var(--c-text));
}

.dw-fg__delta.is-flat {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-muted);
}

.dw-fg__delta.is-muted {
  color: var(--c-text-faint);
}

.dw-fg__hint {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.35;
}

.dw-fg__new {
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

.dw-fg__new .q-icon {
  color: var(--c-link);
  flex: none;
}

.dw-fg__new strong {
  display: block;
  color: var(--c-text);
}

.dw-fg__new span {
  display: block;
}

.dw-fg__tracked {
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

.dw-fg__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dw-fg__links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 599px) {
  .dw-fg__grid {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-fg__new {
    margin-left: 0.7rem;
    margin-right: 0.7rem;
  }

  .dw-fg__tracked {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}

@media (max-width: 340px) {
  .dw-fg__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { fetchFollowCount } from 'src/services/chainData'
import { followerGrowthSummary } from 'src/services/followerGrowth'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const BASELINE_PREFIX = 'followers:'
const BASELINE_TTL_MS = 365 * 24 * 60 * 60 * 1000

function countValue (value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null
}

export default {
  name: 'WidgetFollowerGrowth',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    showFollowing: { type: Boolean, default: true }
  },
  data () {
    return {
      followCount: null,
      baseline: null,
      countLoading: false,
      countLoaded: false,
      countError: '',
      growthAccount: ''
    }
  },
  computed: {
    summary () {
      return followerGrowthSummary({
        followCount: this.followCount,
        baseline: this.baseline,
        now: Date.now()
      })
    },
    displayState () {
      if (!this.targetAccount) return 'guest'
      if (this.loadError && !this.loaded) return 'error'
      if (this.loading && !this.loaded) return 'loading'
      if (this.countError && !this.countLoaded) return 'error'
      if (!this.countLoaded) return 'loading'
      if (this.loadError || this.countError) return 'stale'
      return 'ready'
    },
    staleNotice () {
      return this.countError || this.loadError || ''
    },
    stateError () {
      if (this.countError) return this.countError
      if (this.loadError) return this.loadError
      if (this.targetAccount) return 'Could not load follower counts for @' + this.targetAccount + '.'
      return ''
    },
    followersPath () {
      return '/@' + this.accountName + '/followers'
    },
    followingPath () {
      return '/@' + this.accountName + '/following'
    }
  },
  watch: {
    targetAccount (value) {
      // Clear the previous account's counts as soon as the account changes so
      // a switch never flashes one account's followers under another name.
      if (!value || (this.growthAccount && value !== this.growthAccount)) this.resetGrowth()
    }
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
    refresh () {
      this._forceCount = true
      this.reload()
    },
    applyAccountData (result) {
      const name = result.accountName || this.targetAccount
      if (!name) return
      if (this.growthAccount && this.growthAccount !== name) this.resetGrowth()
      this.growthAccount = name
      const force = this._forceCount === true
      this._forceCount = false
      this.loadGrowth(name, { force })
    },
    resetGrowth () {
      this.followCount = null
      this.baseline = null
      this.countLoaded = false
      this.countLoading = false
      this.countError = ''
      this.growthAccount = ''
    },
    baselineName (name) {
      return BASELINE_PREFIX + name
    },
    readBaseline (name, now) {
      const stored = loadSnapshot(this.baselineName(name), { now, ttlMs: BASELINE_TTL_MS })
      const data = stored?.data
      if (!data) return null
      const firstAt = Number(data.firstAt)
      const firstFollowers = countValue(data.firstFollowers)
      const firstFollowing = countValue(data.firstFollowing)
      if (!Number.isFinite(firstAt) || firstAt <= 0 || firstFollowers === null || firstFollowing === null) {
        return null
      }
      const lastAt = Number(data.lastAt)
      return {
        firstAt,
        firstFollowers,
        firstFollowing,
        lastAt: Number.isFinite(lastAt) && lastAt > 0 ? lastAt : firstAt,
        lastFollowers: countValue(data.lastFollowers) ?? firstFollowers,
        lastFollowing: countValue(data.lastFollowing) ?? firstFollowing
      }
    },
    saveBaseline (name, data, now) {
      saveSnapshot(this.baselineName(name), data, { now, ttlMs: BASELINE_TTL_MS })
    },
    async loadGrowth (name, { force = false } = {}) {
      if (!name) return
      this.countLoading = true
      this.countError = ''
      try {
        const result = await fetchFollowCount(name, { force })
        if (this.growthAccount !== name) return
        if (!result || typeof result !== 'object') {
          throw new Error('Empty follow count response')
        }

        const followers = countValue(result.follower_count)
        const following = countValue(result.following_count)
        if (followers === null && following === null) {
          throw new Error('No follower counts in the response')
        }

        const now = Date.now()
        const existing = this.readBaseline(name, now)
        let next = null
        if (existing) {
          next = {
            firstAt: existing.firstAt,
            firstFollowers: existing.firstFollowers,
            firstFollowing: existing.firstFollowing,
            lastAt: now,
            lastFollowers: followers === null ? existing.lastFollowers : followers,
            lastFollowing: following === null ? existing.lastFollowing : following
          }
        } else if (followers !== null && following !== null) {
          next = {
            firstAt: now,
            firstFollowers: followers,
            firstFollowing: following,
            lastAt: now,
            lastFollowers: followers,
            lastFollowing: following
          }
        }

        this.followCount = {
          follower_count: followers,
          following_count: following
        }
        this.baseline = next
        if (next) this.saveBaseline(name, next, now)
        this.countLoaded = true
      } catch (error) {
        if (this.growthAccount !== name) return
        console.error('Failed to load follower counts for @' + name, error)
        this.countError = this.countLoaded
          ? 'Follower counts could not refresh — showing the last known values.'
          : 'Could not load follower counts for @' + name + '.'
      } finally {
        if (this.growthAccount === name) this.countLoading = false
      }
    }
  }
}
</script>
