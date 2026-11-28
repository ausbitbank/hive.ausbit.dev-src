<template>
  <div class="dw-vitals">
    <q-card-section class="home-panel__head dw-vitals__head">
      <div>
        <div class="home-eyebrow">Your account</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }}</template>
          <template v-else>Account vitals</template>
        </h2>
      </div>
    </q-card-section>

    <dashboard-widget-state
      :state="displayState"
      :error="loadError"
      guest-title="Log in to see your account vitals"
      guest-text="Voting power, resource credits, vote value and effective Hive Power for your account."
      @retry="refresh"
    />

    <template v-if="displayState === 'ready' || displayState === 'stale'">
      <p v-if="staleNotice" class="dw-vitals__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ staleNotice }}</span>
      </p>

      <q-card-section class="dw-vitals__grid">
        <article class="dw-vitals__stat">
          <div class="dw-vitals__stat-head">
            <span class="dw-vitals__label">Voting power</span>
            <span class="dw-vitals__value">{{ vitals.votingPower.label }}</span>
          </div>
          <div
            class="dw-vitals__bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(vitals.votingPower.percent || 0)"
            :aria-label="'Voting power ' + vitals.votingPower.label"
          >
            <span :class="'is-' + vitals.votingPower.status" :style="{ width: (vitals.votingPower.percent || 0) + '%' }"></span>
          </div>
          <div class="dw-vitals__meta">
            <span class="dw-vitals__status" :class="'is-' + vitals.votingPower.status">{{ votingPowerStatusLabel }}</span>
            <span class="dw-vitals__hint">
              {{ vitals.votingPower.status === 'full' ? 'Fully recharged' : 'Full in ' + vitals.votingPower.fullInLabel }}
            </span>
          </div>
        </article>

        <article class="dw-vitals__stat">
          <div class="dw-vitals__stat-head">
            <span class="dw-vitals__label">Downvote power</span>
            <span class="dw-vitals__value">{{ vitals.downvote.label }}</span>
          </div>
          <div
            class="dw-vitals__bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(vitals.downvote.percent || 0)"
            :aria-label="'Downvote power ' + vitals.downvote.label"
          >
            <span :style="{ width: (vitals.downvote.percent || 0) + '%' }"></span>
          </div>
          <span class="dw-vitals__hint">
            {{ vitals.downvote.percent === null ? 'Unavailable for this account' : 'Based on effective HP' }}
          </span>
        </article>

        <article class="dw-vitals__stat">
          <div class="dw-vitals__stat-head">
            <span class="dw-vitals__label">Resource credits</span>
            <span class="dw-vitals__value">{{ vitals.rc.label }}</span>
          </div>
          <div
            class="dw-vitals__bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(vitals.rc.percent || 0)"
            :aria-label="'Resource credits ' + vitals.rc.label"
          >
            <span :class="'is-' + vitals.rc.status" :style="{ width: (vitals.rc.percent || 0) + '%' }"></span>
          </div>
          <div class="dw-vitals__meta">
            <span class="dw-vitals__status" :class="'is-' + vitals.rc.status">{{ rcStatusLabel }}</span>
            <span class="dw-vitals__hint">Approximate op budget</span>
          </div>
          <dl class="dw-vitals__budget">
            <div><dt>Comments</dt><dd>{{ vitals.rc.budget.comments }}</dd></div>
            <div><dt>Votes</dt><dd>{{ vitals.rc.budget.votes }}</dd></div>
            <div><dt>Transfers</dt><dd>{{ vitals.rc.budget.transfers }}</dd></div>
            <div><dt>Claims</dt><dd>{{ vitals.rc.budget.claimAccounts }}</dd></div>
          </dl>
        </article>

        <article v-if="showVoteValue" class="dw-vitals__stat">
          <div class="dw-vitals__stat-head">
            <span class="dw-vitals__label">Vote value</span>
            <span class="dw-vitals__value">{{ vitals.voteValue.label }}</span>
          </div>
          <span class="dw-vitals__badge">Estimate</span>
          <span class="dw-vitals__hint">
            {{ vitals.voteValue.available ? '100% vote weight · price feed dependent' : 'Price feed unavailable' }}
          </span>
        </article>

        <article class="dw-vitals__stat" :class="{ 'dw-vitals__stat--wide': showVoteValue }">
          <div class="dw-vitals__stat-head">
            <span class="dw-vitals__label">Effective HP</span>
            <span class="dw-vitals__value">{{ vitals.hp.label }}</span>
          </div>
          <div class="dw-vitals__hp-context">
            <span>{{ hpLabel(vitals.hp.owned) }} owned · {{ hpLabel(vitals.hp.received) }} received</span>
            <span>{{ hpLabel(vitals.hp.delegated) }} delegated · {{ hpLabel(vitals.hp.powerdown) }} powering down</span>
          </div>
        </article>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-vitals__footer">
        <div class="dw-vitals__links">
          <router-link :to="profilePath">Profile</router-link>
          <router-link :to="walletPath">Wallet</router-link>
        </div>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh account vitals"
          title="Refresh account vitals"
          :loading="loading || extrasLoading"
          @click="refresh"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-vitals__head {
  align-items: flex-start;
}

.dw-vitals__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-vitals__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 0.4rem;
  padding: 0.7rem 1rem 0.6rem;
}

.dw-vitals__stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-vitals__stat--wide {
  grid-column: 1 / -1;
}

.dw-vitals__stat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dw-vitals__label {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-vitals__value {
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-vitals__bar {
  overflow: hidden;
  height: 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.dw-vitals__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--c-link);
}

.dw-vitals__bar > span.is-full,
.dw-vitals__bar > span.is-healthy {
  background: var(--c-positive);
}

.dw-vitals__bar > span.is-low {
  background: var(--c-warning);
}

.dw-vitals__bar > span.is-critical {
  background: var(--c-negative);
}

.dw-vitals__bar > span.is-unavailable {
  background: var(--c-text-faint);
}

.dw-vitals__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dw-vitals__status,
.dw-vitals__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-vitals__status.is-full,
.dw-vitals__status.is-healthy {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-vitals__status.is-low {
  background: color-mix(in srgb, var(--c-warning) 14%, transparent);
  color: var(--c-warning-soft);
}

.dw-vitals__status.is-critical {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: var(--c-negative);
}

.dw-vitals__status.is-unavailable {
  color: var(--c-text-faint);
}

.dw-vitals__hint {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.35;
}

.dw-vitals__badge {
  align-self: flex-start;
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-link-soft);
}

.dw-vitals__budget {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.2rem 0.4rem;
  margin: 0.1rem 0 0;
}

.dw-vitals__budget > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem;
  min-width: 0;
}

.dw-vitals__budget dt {
  color: var(--c-text-faint);
  font-size: 0.62rem;
}

.dw-vitals__budget dd {
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-vitals__hp-context {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  line-height: 1.35;
}

.dw-vitals__footer {
  align-items: center;
}

.dw-vitals__links {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

@media (max-width: 599px) {
  .dw-vitals__grid {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-vitals__stat {
    padding: 0.4rem 0.45rem;
  }
}

@media (max-width: 340px) {
  .dw-vitals__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dw-vitals__stat--wide {
    grid-column: auto;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { accountVitalsSummary } from 'src/services/accountVitals'
import { fetchMedianHistoryPrice } from 'src/services/chainData'
import { pollWhileVisible } from 'src/services/polling'
import { formatHp } from 'src/services/witnesses'

export default {
  name: 'WidgetAccountVitals',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    refreshSeconds: { type: Number, default: 60 },
    showVoteValue: { type: Boolean, default: true }
  },
  data () {
    return {
      rc: null,
      rewardFund: null,
      median: null,
      extrasLoading: false,
      extrasLoaded: false,
      extrasFailed: false,
      extrasError: '',
      extrasAccount: ''
    }
  },
  computed: {
    vitals () {
      return accountVitalsSummary({
        account: this.accountRecord,
        globalProps: this.globalProps,
        rc: this.rc,
        rewardFund: this.rewardFund,
        median: this.median,
        prices: this.prices,
        now: this.updatedAt || Date.now()
      })
    },
    displayState () {
      // Keep the body on screen while a refresh is in flight instead of
      // replacing it with skeletons every polling cycle.
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      return this.state
    },
    staleNotice () {
      if (this.state === 'stale') {
        return this.loadError || 'Refresh failed — showing the last good account data.'
      }
      return this.extrasError
    },
    hasExtraData () {
      return Boolean(this.rc || this.rewardFund || this.median)
    },
    votingPowerStatusLabel () {
      return this.statusLabel(this.vitals.votingPower.status)
    },
    rcStatusLabel () {
      return this.statusLabel(this.vitals.rc.status)
    },
    profilePath () {
      return '/@' + this.accountName
    },
    walletPath () {
      return '/@' + this.accountName + '/wallet'
    }
  },
  mounted () {
    this.startPolling()
  },
  watch: {
    refreshSeconds () {
      this.startPolling()
    }
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    statusLabel (status) {
      switch (status) {
        case 'full':
          return 'Full'
        case 'healthy':
          return 'Healthy'
        case 'low':
          return 'Running low'
        case 'critical':
          return 'Very low'
        case 'unavailable':
          return 'Unavailable'
        default:
          return 'Unknown'
      }
    },
    hpLabel (value) {
      return formatHp(value, 2)
    },
    applyAccountData (result) {
      const name = result.accountName || this.targetAccount
      if (!name) return
      if (this.extrasAccount && this.extrasAccount !== name) this.resetExtras()
      this.extrasAccount = name
      this.loadExtras(name)
    },
    resetExtras () {
      this.rc = null
      this.rewardFund = null
      this.median = null
      this.extrasLoaded = false
      this.extrasFailed = false
      this.extrasError = ''
    },
    async loadExtras (name) {
      if (!name) return
      this.extrasLoading = true
      const results = await Promise.allSettled([
        this.$hive.api.callAsync('rc_api.find_rc_accounts', { accounts: [name] }),
        this.$hive.api.getRewardFund('post'),
        fetchMedianHistoryPrice()
      ])
      if (this.extrasAccount !== name) return

      let failed = false

      if (results[0].status === 'fulfilled') {
        const account = results[0].value?.rc_accounts?.[0] || null
        if (account) this.rc = account
        else failed = true
      } else {
        console.error('Failed to load resource credits for @' + name, results[0].reason)
        failed = true
      }

      if (results[1].status === 'fulfilled') {
        this.rewardFund = results[1].value || null
        if (!this.rewardFund) failed = true
      } else {
        console.error('Failed to load the post reward fund for @' + name, results[1].reason)
        failed = true
      }

      if (results[2].status === 'fulfilled') {
        this.median = results[2].value || null
        if (!this.median) failed = true
      } else {
        console.error('Failed to load the median price history for @' + name, results[2].reason)
        failed = true
      }

      this.extrasFailed = failed
      this.extrasLoaded = true
      this.extrasLoading = false
      this.extrasError = failed
        ? this.hasExtraData
          ? 'Some live RC and vote data could not refresh — showing the last known values.'
          : 'Live RC and vote data are unavailable right now.'
        : ''
    },
    startPolling () {
      this.stopPolling()
      const seconds = Number(this.refreshSeconds)
      if (!Number.isFinite(seconds) || seconds <= 0) return
      this._vitalsPoll = pollWhileVisible(() => {
        if (this.targetAccount) this.refresh()
      }, seconds * 1000, { immediate: false })
      this._vitalsPoll.start()
    },
    stopPolling () {
      if (this._vitalsPoll) {
        this._vitalsPoll.stop()
        this._vitalsPoll = null
      }
    }
  }
}
</script>
