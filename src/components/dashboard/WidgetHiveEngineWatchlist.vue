<template>
  <div class="dw-he">
    <q-card-section class="home-panel__head dw-he__head">
      <div>
        <div class="home-eyebrow">Hive-Engine</div>
        <h2 class="home-panel__title">{{ title }}</h2>
      </div>
      <q-btn
        flat
        round
        dense
        icon="refresh"
        aria-label="Refresh Hive-Engine watchlist"
        title="Refresh Hive-Engine watchlist"
        :loading="loading"
        @click="refresh"
      />
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'Hive-Engine is unavailable right now.'"
      @retry="refresh"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-he__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section v-if="!summary.hasData" class="home-panel__state">
        <q-icon name="token" size="22px" aria-hidden="true" />
        <span>No Hive-Engine market data for these tokens right now.</span>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="refresh" />
      </q-card-section>

      <template v-else>
        <q-card-section class="dw-he__body">
          <ul class="dw-he__list">
            <li v-for="row in summary.rows" :key="row.symbol">
              <router-link :to="row.link" class="dw-he__row">
                <span class="dw-he__ident">
                  <span class="dw-he__symbol">{{ row.symbol }}</span>
                  <span class="dw-he__volume">{{ volumeLabel(row) }}</span>
                </span>
                <span class="dw-he__market">
                  <span class="dw-he__price">{{ formatPrice(row.priceHive) }}</span>
                  <span class="dw-he__change" :class="changeClass(row)">
                    <q-icon :name="changeIcon(row)" size="13px" aria-hidden="true" />
                    {{ changeLabel(row) }}
                  </span>
                </span>
                <span v-if="showBalances && summary.hasBalances" class="dw-he__balance">
                  <span class="dw-he__balance-amount">{{ formatAmount(row.balance) }} {{ row.symbol }}</span>
                  <span v-if="row.valueHive !== null" class="dw-he__balance-value">
                    ≈ {{ formatAmount(row.valueHive) }} HIVE
                  </span>
                  <span v-else class="dw-he__balance-value">no market price</span>
                </span>
              </router-link>
            </li>
          </ul>

          <p v-if="showBalances && !accountName" class="dw-he__note">
            Log in to show your balances next to these prices.
          </p>
          <p v-else-if="showBalances && accountName && !summary.hasBalances" class="dw-he__note">
            No balances for these tokens in @{{ accountName }}.
          </p>
        </q-card-section>

        <q-card-section class="home-panel__footer dw-he__footer">
          <span v-if="showBalances && summary.hasBalances">
            {{ formatAmount(summary.totalValueHive) }} HIVE priced
          </span>
          <div class="dw-he__links">
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
    </template>
  </div>
</template>

<style scoped>
.dw-he {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-he__head {
  align-items: flex-start;
}

.dw-he__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-he__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.55rem;
}

.dw-he__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-he__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.15rem 0.5rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text);
  text-decoration: none;
}

.dw-he__row:hover,
.dw-he__row:focus-visible {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  text-decoration: none;
}

.dw-he__ident {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
}

.dw-he__symbol {
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dw-he__volume {
  color: var(--c-text-faint);
  font-size: 0.63rem;
}

.dw-he__market {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.08rem;
}

.dw-he__price {
  color: var(--c-text);
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-he__change {
  display: inline-flex;
  align-items: center;
  gap: 0.14rem;
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-pill);
  font-size: 0.63rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-he__change.is-up {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-he__change.is-down {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: color-mix(in srgb, var(--c-negative) 85%, var(--c-text));
}

.dw-he__change.is-flat {
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-muted);
}

.dw-he__change.is-muted {
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  color: var(--c-text-faint);
}

.dw-he__balance {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  grid-column: 1 / -1;
  min-width: 0;
  padding-top: 0.2rem;
  border-top: 1px dashed var(--border-subtle);
  font-size: 0.67rem;
}

.dw-he__balance-amount {
  color: var(--c-text-muted);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dw-he__balance-value {
  color: var(--c-text-faint);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-he__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.4;
}

.dw-he__footer {
  align-items: center;
}

.dw-he__links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

@media (max-width: 479px) {
  .dw-he__balance {
    flex-wrap: wrap;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { useSignedInUsername } from 'src/composables/useAccountWidget'
import { getHiveEngine } from 'src/services/hiveEngine'
import { hiveEngineWatchlistSummary } from 'src/services/hiveEngineWatchlist'
import { formatAmount, formatPrice, formatSignedPercent, formatVolume } from 'src/services/market'

const MAX_SYMBOLS = 8

export default {
  name: 'WidgetHiveEngineWatchlist',
  components: { DashboardWidgetState },
  props: {
    account: { type: String, default: '' },
    symbols: { type: Array, default: () => ['SWAP.HIVE', 'DEC', 'LEO'] },
    showBalances: { type: Boolean, default: true },
    limit: { type: Number, default: 6 }
  },
  data () {
    return {
      metrics: [],
      balances: [],
      loading: true,
      loaded: false,
      loadError: '',
      updatedAt: 0,
      reloadToken: 0
    }
  },
  computed: {
    accountName () {
      const explicit = String(this.account || '').replace(/^@/, '').trim()
      return explicit || useSignedInUsername(this)
    },
    normalizedSymbols () {
      const seen = new Set()
      const result = []
      for (const raw of Array.isArray(this.symbols) ? this.symbols : []) {
        const symbol = String(raw ?? '').trim().toUpperCase()
        if (!symbol || seen.has(symbol)) continue
        seen.add(symbol)
        result.push(symbol)
        if (result.length >= MAX_SYMBOLS) break
      }
      return result
    },
    queryLimit () {
      const limit = Math.floor(Number(this.limit))
      return Number.isFinite(limit) && limit > 0 ? limit : 6
    },
    summary () {
      return hiveEngineWatchlistSummary({
        metrics: this.metrics,
        balances: this.balances,
        symbols: this.normalizedSymbols,
        limit: this.limit
      })
    },
    title () {
      return this.accountName ? '@' + this.accountName : 'L2 watchlist'
    },
    state () {
      if (this.loading && !this.loaded) return 'loading'
      if (!this.loaded) return 'error'
      return this.loadError ? 'stale' : 'ready'
    }
  },
  watch: {
    accountName () {
      this.reload()
    },
    showBalances () {
      this.reload()
    },
    limit () {
      this.reload()
    },
    symbols: {
      deep: true,
      handler () {
        this.reload()
      }
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    formatAmount,
    formatPrice,
    refresh () {
      this.reload()
    },
    async reload () {
      const token = ++this.reloadToken
      const account = this.accountName
      this.loading = !this.loaded
      this.loadError = ''
      const symbols = this.normalizedSymbols
      if (!symbols.length) {
        this.metrics = []
        this.balances = []
        this.loaded = true
        this.loading = false
        return
      }
      // Do not keep the previous account's token rows visible while the new
      // query runs.
      this.balances = []

      const engine = getHiveEngine()
      const withBalances = Boolean(this.accountName && this.showBalances)
      const requests = [
        engine.find('market', 'metrics', { symbol: { $in: symbols } }, this.queryLimit)
      ]
      if (withBalances) {
        requests.push(engine.find('tokens', 'balances', {
          account: this.accountName,
          symbol: { $in: symbols }
        }, this.queryLimit))
      }

      const results = await Promise.allSettled(requests)
      if (token !== this.reloadToken || account !== this.accountName) return
      const metricsResult = results[0]
      let failed = false

      if (metricsResult.status === 'fulfilled') {
        this.metrics = Array.isArray(metricsResult.value) ? metricsResult.value : []
      } else {
        failed = true
      }

      if (withBalances) {
        const balancesResult = results[1]
        if (balancesResult.status === 'fulfilled') {
          this.balances = Array.isArray(balancesResult.value) ? balancesResult.value : []
        } else {
          failed = true
        }
      } else {
        this.balances = []
      }

      const anyFulfilled = results.some(result => result.status === 'fulfilled')
      if (anyFulfilled) this.loaded = true
      if (failed) {
        this.loadError = anyFulfilled
          ? 'Hive-Engine is unavailable or rate-limiting requests — showing the last values.'
          : 'Hive-Engine is unavailable or rate-limiting requests.'
      }

      this.loading = false
      this.updatedAt = Date.now()
    },
    changeLabel (row) {
      return row.change24h === null ? '—' : formatSignedPercent(row.change24h, 2)
    },
    changeIcon (row) {
      if (row.change24h === null) return 'remove'
      if (row.change24h > 0) return 'north_east'
      if (row.change24h < 0) return 'south_east'
      return 'remove'
    },
    changeClass (row) {
      if (row.change24h === null) return 'is-muted'
      if (row.change24h > 0) return 'is-up'
      if (row.change24h < 0) return 'is-down'
      return 'is-flat'
    },
    volumeLabel (row) {
      if (!row.hasMarket) return 'No market'
      if (row.volume === null) return 'Volume unavailable'
      return 'Vol ' + formatVolume(row.volume) + ' HIVE'
    }
  }
}
</script>
