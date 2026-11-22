<template>
  <div class="dw-pa">
    <q-card-section class="home-panel__head dw-pa__head">
      <div>
        <div class="home-eyebrow">Markets</div>
        <h2 class="home-panel__title">Price alert</h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh HIVE price"
        title="Refresh HIVE price"
        :loading="loading"
        @click="refresh"
      />
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'HIVE market price is unavailable right now.'"
      @retry="reload"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-pa__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section class="dw-pa__body">
        <div class="dw-pa__current">
          <div class="dw-pa__current-price">
            <span class="dw-pa__label">HIVE / USD</span>
            <span class="dw-pa__price">{{ summary.currentLabel }}</span>
            <span v-if="btcLabel" class="dw-pa__btc">₿ {{ btcLabel }}</span>
          </div>
          <span class="dw-pa__badge" :class="badgeClass">{{ summary.statusLabel }}</span>
        </div>

        <dl v-if="summary.hasTarget" class="dw-pa__facts">
          <div>
            <dt>Target</dt>
            <dd>{{ summary.targetLabel }}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{{ directionLabel }}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>
              {{ summary.distanceLabel }}
              <small v-if="percentLabel" class="dw-pa__hint">{{ percentLabel }}</small>
            </dd>
          </div>
        </dl>

        <div v-else class="dw-pa__setup">
          <q-icon name="tune" size="20px" aria-hidden="true" />
          <div>
            <strong>Set a target in widget settings</strong>
            <span>Choose a USD target and whether HIVE should rise above or fall below it.</span>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-pa__footer">
        <span>Read-only · in-page status only</span>
        <div class="dw-pa__links">
          <router-link to="/markets">Markets</router-link>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            icon="refresh"
            label="Refresh"
            :loading="loading"
            @click="refresh"
          />
        </div>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-pa {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-pa__head {
  align-items: flex-start;
}

.dw-pa__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-pa__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.55rem;
}

.dw-pa__current {
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

.dw-pa__current-price {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.dw-pa__label {
  color: var(--c-text-subtle);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-pa__price {
  color: var(--c-text);
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-pa__btc {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
}

.dw-pa__badge {
  padding: 0.14rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-pa__badge.is-triggered {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-pa__badge.is-waiting {
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-link-soft);
}

.dw-pa__badge.is-muted {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-faint);
}

.dw-pa__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 0.3rem;
  margin: 0;
}

.dw-pa__facts > div {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-pa__facts dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-pa__facts dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.88rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-pa__hint {
  display: block;
  color: var(--c-text-faint);
  font-size: 0.6rem;
  font-weight: 400;
  line-height: 1.3;
}

.dw-pa__setup {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  line-height: 1.4;
}

.dw-pa__setup .q-icon {
  color: var(--c-link);
  flex: none;
}

.dw-pa__setup strong {
  display: block;
  color: var(--c-text);
}

.dw-pa__setup span {
  display: block;
}

.dw-pa__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dw-pa__links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 479px) {
  .dw-pa__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 340px) {
  .dw-pa__facts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { getHivePrices } from 'src/services/prices'
import { priceAlertSummary } from 'src/services/priceAlert'
import { pollWhileVisible } from 'src/services/polling'

const POLL_MS = 60 * 1000

export default {
  name: 'WidgetPriceAlert',
  components: { DashboardWidgetState },
  props: {
    target: { type: Number, default: 0 },
    direction: { type: String, default: 'above' }
  },
  data () {
    return {
      prices: null,
      loading: true,
      loaded: false,
      loadError: ''
    }
  },
  computed: {
    summary () {
      return priceAlertSummary({
        prices: this.prices,
        target: this.target,
        direction: this.direction
      })
    },
    state () {
      if (this.loading && !this.loaded) return 'loading'
      if (!this.loaded) return 'error'
      return this.loadError ? 'stale' : 'ready'
    },
    directionLabel () {
      return this.summary.direction === 'below' ? 'Falls to or below' : 'Rises to or above'
    },
    badgeClass () {
      if (!this.summary.hasTarget) return 'is-muted'
      return this.summary.triggered ? 'is-triggered' : 'is-waiting'
    },
    percentLabel () {
      if (this.summary.distancePercent === null) return ''
      return this.summary.distancePercent.toFixed(2) + '% of target'
    },
    btcLabel () {
      if (this.summary.currentBtc === null) return ''
      return this.summary.currentBtc.toLocaleString('en-US', { maximumFractionDigits: 8 })
    }
  },
  mounted () {
    this.reload()
    this.startPolling()
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    refresh () {
      this.reload(true)
    },
    async reload (force = false) {
      if (!this.loaded) this.loading = true
      this.loadError = ''
      try {
        const prices = await getHivePrices(force ? { maxAge: 0 } : undefined)
        const usd = Number(prices?.hive?.usd)
        if (!Number.isFinite(usd) || usd <= 0) {
          throw new Error('No usable HIVE price in the response')
        }
        this.prices = prices
        this.loaded = true
      } catch (error) {
        console.error('Failed to load HIVE prices for the price alert widget', error)
        this.loadError = this.loaded
          ? 'Prices could not refresh — showing the last known price.'
          : 'HIVE market price is unavailable right now.'
      } finally {
        this.loading = false
      }
    },
    startPolling () {
      this.stopPolling()
      this._pricePoll = pollWhileVisible(() => this.reload(), POLL_MS, { immediate: false })
      this._pricePoll.start()
    },
    stopPolling () {
      if (this._pricePoll) {
        this._pricePoll.stop()
        this._pricePoll = null
      }
    }
  }
}
</script>
