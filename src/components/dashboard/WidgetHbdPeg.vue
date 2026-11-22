<template>
  <div class="dw-hbd">
    <q-card-section class="dw-hbd__head">
      <div>
        <div class="dw-hbd__eyebrow">Stablecoin</div>
        <h2 class="dw-hbd__title">HBD peg &amp; yield</h2>
      </div>
      <q-btn
        flat
        round
        dense
        icon="refresh"
        aria-label="Refresh HBD data"
        title="Refresh HBD data"
        :loading="loading"
        @click="reload"
      />
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'HBD data is unavailable right now.'"
      @retry="reload"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-hbd__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section v-if="!summary.hasData" class="home-panel__state">
        <q-icon name="paid" size="22px" aria-hidden="true" />
        <span>HBD market data is unavailable right now.</span>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="reload" />
      </q-card-section>

      <template v-else>
        <q-card-section class="dw-hbd__body">
          <div class="dw-hbd__peg">
            <div>
              <span class="dw-hbd__label">HBD peg</span>
              <span class="dw-hbd__peg-price">{{ summary.hbdLabel }}</span>
            </div>
            <span class="dw-hbd__peg-badge" :class="directionClass">{{ summary.premiumLabel }}</span>
          </div>

          <dl class="dw-hbd__stats">
            <div>
              <dt>Internal HIVE</dt>
              <dd>
                {{ summary.internalLabel }}
                <small class="dw-hbd__hint">Latest internal trade</small>
              </dd>
            </div>
            <div>
              <dt>Median HIVE</dt>
              <dd>
                {{ summary.medianLabel }}
                <small class="dw-hbd__hint">3.5-day witness feed</small>
              </dd>
            </div>
            <div>
              <dt>Savings APR</dt>
              <dd>
                {{ aprLabel }}
                <small class="dw-hbd__hint">Paid on HBD savings</small>
              </dd>
            </div>
            <div>
              <dt>Debt ratio</dt>
              <dd>
                {{ summary.debt.label }}
                <small class="dw-hbd__status" :class="debtClass">{{ summary.debt.status.label }}</small>
              </dd>
            </div>
            <div>
              <dt>Print rate</dt>
              <dd>
                {{ summary.printRateLabel }}
                <small class="dw-hbd__hint">{{ printHint }}</small>
              </dd>
            </div>
          </dl>

          <div v-if="showProjection" class="dw-hbd__projection">
            <div class="dw-hbd__projection-head">
              <span class="dw-hbd__label">Savings projection</span>
              <span class="dw-hbd__hint">{{ formatAmount(summary.projection.amount, 0) }} HBD at {{ aprLabel }}</span>
            </div>
            <div class="dw-hbd__projection-values">
              <div>
                <strong>{{ annualLabel }}</strong>
                <span>HBD / year</span>
              </div>
              <div>
                <strong>{{ monthlyLabel }}</strong>
                <span>HBD / month</span>
              </div>
            </div>
          </div>

          <p class="dw-hbd__haircut" :class="{ 'is-warn': haircutWarning }">
            <q-icon name="info" size="14px" aria-hidden="true" />
            <span>{{ haircutLabel }}</span>
          </p>
        </q-card-section>

        <q-card-section class="home-panel__footer dw-hbd__footer">
          <router-link to="/hbd">HBD overview</router-link>
          <router-link to="/markets">Markets</router-link>
          <q-btn flat dense no-caps size="sm" color="primary" icon="refresh" label="Refresh" :loading="loading" @click="reload" />
        </q-card-section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.dw-hbd {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-hbd__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.2rem;
}

.dw-hbd__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dw-hbd__title {
  margin: 0.05rem 0 0;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
}

.dw-hbd__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.55rem;
}

.dw-hbd__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-hbd__peg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-hbd__label {
  display: block;
  color: var(--c-text-subtle);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-hbd__peg-price {
  color: var(--c-text);
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-hbd__peg-badge {
  padding: 0.14rem 0.5rem;
  border-radius: var(--radius-pill);
  font-size: 0.64rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-hbd__peg-badge.is-premium {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-hbd__peg-badge.is-discount {
  background: color-mix(in srgb, var(--c-warning) 14%, transparent);
  color: var(--c-warning-soft);
}

.dw-hbd__peg-badge.is-par {
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-subtle);
}

.dw-hbd__peg-badge.is-muted {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-faint);
}

.dw-hbd__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 0.3rem;
  margin: 0;
}

.dw-hbd__stats > div {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-hbd__stats dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-hbd__stats dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-hbd__hint {
  display: block;
  color: var(--c-text-faint);
  font-size: 0.6rem;
  line-height: 1.3;
}

.dw-hbd__status {
  display: block;
  font-size: 0.6rem;
  font-weight: 600;
}

.dw-hbd__status.is-good {
  color: var(--c-positive);
}

.dw-hbd__status.is-warn {
  color: var(--c-warning-soft);
}

.dw-hbd__status.is-bad {
  color: var(--c-negative);
}

.dw-hbd__status.is-muted {
  color: var(--c-text-faint);
}

.dw-hbd__projection {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-hbd__projection-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.dw-hbd__projection-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}

.dw-hbd__projection-values > div {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.dw-hbd__projection-values strong {
  color: var(--c-positive);
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-hbd__projection-values span {
  color: var(--c-text-faint);
  font-size: 0.62rem;
}

.dw-hbd__haircut {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.45;
}

.dw-hbd__haircut.is-warn {
  color: var(--c-warning);
}

.dw-hbd__footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

@media (max-width: 479px) {
  .dw-hbd__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchAccount, fetchGlobalProps } from 'src/services/chainData'
import { formatAmount } from 'src/services/market'
import { parseAsset } from 'src/services/network'
import { hbdPegSummary } from 'src/services/hbdPeg'

export default {
  name: 'WidgetHbdPeg',
  components: { DashboardWidgetState },
  props: {
    amount: { type: Number, default: 1000 },
    showProjection: { type: Boolean, default: true }
  },
  data () {
    return {
      ticker: null,
      median: null,
      globalProps: null,
      fund: null,
      loading: true,
      loaded: false,
      loadError: ''
    }
  },
  computed: {
    summary () {
      return hbdPegSummary({
        ticker: this.ticker,
        median: this.median,
        globalProps: this.globalProps,
        amount: this.amount,
        treasuryHbd: parseAsset(this.fund?.hbd_balance)
      })
    },
    state () {
      if (this.loading && !this.loaded) return 'loading'
      if (!this.loaded) return 'error'
      return this.loadError ? 'stale' : 'ready'
    },
    aprLabel () {
      return this.summary.savingsApr === null ? '—' : this.summary.savingsApr.toFixed(2) + '%'
    },
    annualLabel () {
      return this.summary.projection.annualHbd === null
        ? '—'
        : formatAmount(this.summary.projection.annualHbd, 2)
    },
    monthlyLabel () {
      return this.summary.projection.monthlyHbd === null
        ? '—'
        : formatAmount(this.summary.projection.monthlyHbd, 2)
    },
    directionClass () {
      switch (this.summary.premiumDirection) {
        case 'premium':
          return 'is-premium'
        case 'discount':
          return 'is-discount'
        case 'par':
          return 'is-par'
        default:
          return 'is-muted'
      }
    },
    debtClass () {
      const key = this.summary.debt.status.key
      if (key === 'ok') return 'is-good'
      if (key === 'warning' || key === 'watch') return 'is-warn'
      if (key === 'critical') return 'is-bad'
      return 'is-muted'
    },
    printHint () {
      if (this.summary.printRate === null) return 'Unavailable'
      return this.summary.printRate >= 100 ? 'Full HBD rewards' : 'Reduced HBD rewards'
    },
    haircutWarning () {
      const debt = this.summary.debt
      return debt.ratio !== null && debt.ratio >= debt.softLimit
    },
    haircutLabel () {
      const debt = this.summary.debt
      if (debt.ratio === null) return 'Haircut distance is unavailable until median and supply data load.'
      if (debt.ratio >= debt.hardLimit) {
        return 'Above the ' + debt.hardLimit + '% hard limit — redemptions use the haircut formula.'
      }
      const soft = debt.ratio >= debt.softLimit
        ? (debt.ratio - debt.softLimit).toFixed(2) + ' pts above the ' + debt.softLimit + '% soft limit'
        : debt.distanceToSoft.toFixed(2) + ' pts below the ' + debt.softLimit + '% soft limit'
      return soft + ' · ' + debt.distanceToHard.toFixed(2) + ' pts below the ' + debt.hardLimit + '% hard limit.'
    }
  },
  created () {
    this.reload()
  },
  methods: {
    formatAmount,
    async reload () {
      if (!this.loaded) this.loading = true
      this.loadError = ''
      const results = await Promise.allSettled([
        this.$hive.api.getTickerAsync(),
        this.$hive.api.getCurrentMedianHistoryPriceAsync(),
        fetchGlobalProps(),
        fetchAccount('hive.fund')
      ])
      const [tickerResult, medianResult, propsResult, fundResult] = results
      let failed = false

      if (tickerResult.status === 'fulfilled') this.ticker = tickerResult.value || null
      else failed = true

      if (medianResult.status === 'fulfilled') this.median = medianResult.value || null
      else failed = true

      if (propsResult.status === 'fulfilled') this.globalProps = propsResult.value || null
      else failed = true

      if (fundResult.status === 'fulfilled') this.fund = fundResult.value || null
      else failed = true

      const anyFulfilled = results.some(result => result.status === 'fulfilled')
      if (anyFulfilled) this.loaded = true

      if (!anyFulfilled) {
        this.loadError = 'HBD market data is unavailable right now.'
      } else if (failed) {
        this.loadError = 'Some HBD data could not be refreshed — showing the last good numbers.'
      }

      this.loading = false
    }
  }
}
</script>
