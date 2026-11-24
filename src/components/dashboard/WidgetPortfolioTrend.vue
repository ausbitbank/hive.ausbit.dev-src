<template>
  <div class="dw-trend">
    <q-card-section class="home-panel__head dw-trend__head">
      <div>
        <div class="home-eyebrow">Portfolio</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }} trend</template>
          <template v-else>Portfolio trend</template>
        </h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh portfolio trend"
        title="Refresh portfolio trend"
        :loading="loading || chartLoading"
        @click="refresh"
      />
    </q-card-section>

    <dashboard-widget-state
      :state="displayState"
      :error="stateError"
      guest-title="Log in to track your portfolio"
      guest-text="Portfolio value, a local balance baseline and public HIVE price history."
      @retry="reload"
    />

    <template v-if="displayState === 'ready' || displayState === 'stale'">
      <p v-if="staleNotice" class="dw-trend__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ staleNotice }}</span>
      </p>

      <q-card-section class="dw-trend__value-block">
        <span class="dw-trend__label">Current value</span>
        <strong class="dw-trend__value">{{ summary.currentLabel }}</strong>
        <span class="dw-trend__sub">est. portfolio · value shown in USD</span>
      </q-card-section>

      <q-card-section class="dw-trend__series">
        <section v-if="showPrice" class="dw-trend__card">
          <div class="dw-trend__card-head">
            <span class="dw-trend__card-label">HIVE price</span>
            <span
              v-if="summary.hasPriceHistory"
              class="dw-trend__change"
              :class="'is-' + summary.priceDirection"
            >{{ summary.priceChangeLabel }}</span>
          </div>
          <sparkline
            v-if="summary.hasPriceHistory"
            :data="summary.priceSeries"
            :width="220"
            :height="42"
            :stroke="summary.priceDirection === 'down' ? 'var(--c-negative)' : 'var(--c-link)'"
            fill="none"
          />
          <p v-else class="dw-trend__empty">
            {{ chartLoading ? 'Loading price history…' : 'Price history unavailable right now.' }}
          </p>
          <p class="dw-trend__meta">{{ summary.windowLabel }} · {{ summary.lastPriceLabel }} · CoinGecko</p>
        </section>

        <section class="dw-trend__card">
          <div class="dw-trend__card-head">
            <span class="dw-trend__card-label">Your portfolio</span>
            <span
              v-if="summary.hasPortfolioHistory"
              class="dw-trend__change"
              :class="'is-' + summary.portfolioDirection"
            >{{ summary.portfolioChangeLabel }}</span>
          </div>
          <sparkline
            v-if="summary.hasPortfolioHistory"
            :data="summary.portfolioSeries"
            :width="220"
            :height="42"
            :stroke="summary.portfolioDirection === 'down' ? 'var(--c-negative)' : 'var(--c-positive)'"
            fill="none"
          />
          <p v-else class="dw-trend__empty">
            Tracking starts now. This browser saves one point every few hours; a trend appears after the next point.
          </p>
          <p class="dw-trend__meta">{{ summary.trackedLabel }}</p>
        </section>
      </q-card-section>

      <p class="dw-trend__note">
        The portfolio line is local to this browser. The price line is public history. Neither is a P&amp;L calculation.
      </p>

      <q-card-section class="home-panel__footer dw-trend__footer">
        <router-link :to="walletPath">Wallet</router-link>
        <router-link to="/markets">Markets</router-link>
        <span>{{ chartLoading ? 'Refreshing price history…' : 'Read-only' }}</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-trend {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-trend__head {
  align-items: flex-start;
}

.dw-trend__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-trend__value-block {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  padding-bottom: 0.4rem;
}

.dw-trend__label {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-trend__value {
  color: var(--c-text);
  font-size: 1.55rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-trend__sub {
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.dw-trend__series {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  align-items: start;
  gap: 0.45rem;
  padding-top: 0;
  padding-bottom: 0.4rem;
}

.dw-trend__card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.dw-trend__card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dw-trend__card-label {
  color: var(--c-text-subtle);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-trend__change {
  padding: 0.08rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-muted);
  font-size: 0.64rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-trend__change.is-up {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-trend__change.is-down {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: var(--c-negative);
}

.dw-trend__card :deep(.sparkline) {
  width: 100%;
  height: 42px;
}

.dw-trend__empty {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-trend__meta {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
}

.dw-trend__note {
  margin: 0;
  padding: 0 1rem 0.4rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.4;
}

.dw-trend__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 599px) {
  .dw-trend__value-block,
  .dw-trend__series {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-trend__note {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import Sparkline from 'components/Sparkline.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { getHivePriceHistory } from 'src/services/prices'
import {
  appendPortfolioSnapshot,
  normalisePortfolioPoints,
  portfolioTrendSummary
} from 'src/services/portfolioTrend'
import { loadSnapshot, saveSnapshot } from 'src/services/snapshots'

const SNAPSHOT_PREFIX = 'portfolio:trend:'
const SNAPSHOT_TTL_MS = 365 * 24 * 60 * 60 * 1000

export default {
  name: 'WidgetPortfolioTrend',
  components: { DashboardWidgetState, Sparkline },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    windowDays: { type: Number, default: 30 },
    showPrice: { type: Boolean, default: true }
  },
  data () {
    return {
      priceHistory: null,
      chartLoading: false,
      chartError: '',
      snapshots: [],
      trendAccount: ''
    }
  },
  computed: {
    walletPath () {
      return '/@' + this.accountName + '/wallet'
    },
    summary () {
      return portfolioTrendSummary({
        account: this.accountRecord,
        globalProps: this.globalProps,
        prices: this.prices,
        priceHistory: this.priceHistory,
        snapshots: this.snapshots,
        windowDays: this.windowDays
      })
    },
    displayState () {
      if (!this.targetAccount) return 'guest'
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      if (!this.loaded) return 'loading'
      if (this.chartError) return 'stale'
      return 'ready'
    },
    staleNotice () {
      if (this.loadError) return this.loadError
      if (this.chartError && this.priceHistory) return this.chartError
      return ''
    },
    stateError () {
      return this.loadError || 'Could not load the portfolio for @' + this.targetAccount + '.'
    }
  },
  watch: {
    targetAccount (value) {
      if (!value || (this.trendAccount && value !== this.trendAccount)) this.resetTrend()
    },
    windowDays () {
      this.loadChart(false)
    }
  },
  methods: {
    refresh () {
      this.loadChart(true)
      this.reload()
    },
    resetTrend () {
      this.priceHistory = null
      this.snapshots = []
      this.chartLoading = false
      this.chartError = ''
      this.trendAccount = ''
    },
    snapshotName (name) {
      return SNAPSHOT_PREFIX + name
    },
    readSnapshots (name) {
      const stored = loadSnapshot(this.snapshotName(name), { ttlMs: SNAPSHOT_TTL_MS })
      return normalisePortfolioPoints(stored?.data)
    },
    applyAccountData (result) {
      const name = result.accountName || this.targetAccount
      if (!name) return
      if (this.trendAccount && this.trendAccount !== name) this.resetTrend()
      this.trendAccount = name

      const stored = this.readSnapshots(name)
      const now = Date.now()
      const portfolio = portfolioTrendSummary({
        account: result.account,
        globalProps: result.globalProps,
        prices: result.prices,
        snapshots: stored
      })
      const next = appendPortfolioSnapshot(stored, { at: now, usd: portfolio.currentUsd })
      saveSnapshot(this.snapshotName(name), next, { ttlMs: SNAPSHOT_TTL_MS })
      this.snapshots = next

      if (!this.priceHistory || this.chartError) this.loadChart(false)
    },
    async loadChart (force) {
      this.chartLoading = true
      this.chartError = ''
      try {
        this.priceHistory = await getHivePriceHistory({ days: this.windowDays, force })
      } catch (error) {
        console.error('Failed to load HIVE price history', error)
        this.chartError = 'Price history could not refresh — the local portfolio baseline is still shown.'
      } finally {
        this.chartLoading = false
      }
    }
  }
}
</script>
