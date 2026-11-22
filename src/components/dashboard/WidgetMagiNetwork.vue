<template>
  <div class="dw-magi">
    <q-card-section class="home-panel__head dw-magi__head">
      <div>
        <div class="home-eyebrow">Magi</div>
        <h2 class="home-panel__title">Magi network</h2>
      </div>
      <span class="dw-magi__badge" :class="'is-' + summary.status" role="status">
        <q-icon :name="statusIcon" size="14px" aria-hidden="true" />
        {{ summary.statusLabel }}
      </span>
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'The Magi network is unavailable right now.'"
      @retry="refresh"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-magi__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section class="dw-magi__body">
        <dl class="dw-magi__stats">
          <div>
            <dt>Head</dt>
            <dd>{{ headLabel }}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd class="dw-magi__version" :title="summary.node?.version || ''">
              {{ summary.node?.version || '—' }}
            </dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>{{ latencyLabel }}</dd>
          </div>
          <div>
            <dt>Witnesses</dt>
            <dd>
              {{ formatCount(summary.witnesses.count) }}
              <small>{{ formatCount(summary.witnesses.enabled) }} enabled</small>
            </dd>
          </div>
        </dl>

        <div v-if="summary.node?.url" class="dw-magi__active">
          <span class="dw-magi__label">Node</span>
          <span class="dw-magi__url" :title="summary.node.url">{{ nodeUrlLabel }}</span>
        </div>

        <section v-if="showContracts" class="dw-magi__section" aria-label="Recent Magi contracts">
          <div class="dw-magi__section-head">
            <span class="dw-magi__section-title">Recent contracts</span>
            <span v-if="summary.contracts.length" class="dw-magi__section-meta">
              {{ summary.contracts.length }} shown
            </span>
          </div>
          <ul v-if="summary.contracts.length" class="dw-magi__list">
            <li v-for="contract in summary.contracts" :key="contract.id || contract.label">
              <router-link
                :to="{ name: 'magi', query: { contract: contract.id } }"
                class="dw-magi__contract"
              >
                <span class="dw-magi__contract-name">{{ contract.label }}</span>
                <span class="dw-magi__contract-meta">
                  <span v-if="contract.owner">@{{ contract.owner }}</span>
                  <span v-if="contract.height">block {{ formatCount(contract.height) }}</span>
                </span>
              </router-link>
            </li>
          </ul>
          <p v-else class="dw-magi__note">No recent contracts returned.</p>
        </section>

        <section v-if="showTokens" class="dw-magi__section" aria-label="Magi token prices">
          <div class="dw-magi__section-head">
            <span class="dw-magi__section-title">Token prices</span>
            <span v-if="summary.hbdPerHive" class="dw-magi__section-meta">
              1 HIVE = {{ formatHbd(summary.hbdPerHive) }} HBD
            </span>
          </div>
          <ul v-if="summary.tokens.length" class="dw-magi__tokens">
            <li v-for="token in summary.tokens" :key="token.symbol" class="dw-magi__token">
              <span class="dw-magi__token-symbol">{{ token.symbol.toUpperCase() }}</span>
              <span class="dw-magi__token-price">{{ formatHbd(token.priceHbd) }} HBD</span>
            </li>
          </ul>
          <p v-else class="dw-magi__note">No DEX token prices right now.</p>
        </section>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-magi__footer">
        <router-link to="/magi">Magi contracts</router-link>
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
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-magi {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-magi__head {
  align-items: flex-start;
}

.dw-magi__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-pill);
  font-size: 0.66rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-magi__badge.is-healthy {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-magi__badge.is-warning {
  background: color-mix(in srgb, var(--c-warning) 14%, transparent);
  color: var(--c-warning-soft);
}

.dw-magi__badge.is-critical {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: var(--c-negative);
}

.dw-magi__badge.is-unknown {
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-muted);
}

.dw-magi__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-magi__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.65rem;
}

.dw-magi__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
  gap: 0.3rem;
  margin: 0;
}

.dw-magi__stats > div {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-magi__stats dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-magi__stats dd {
  display: flex;
  flex-direction: column;
  margin: 0;
  color: var(--c-text);
  font-size: 0.88rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dw-magi__stats dd small {
  color: var(--c-text-faint);
  font-size: 0.58rem;
  font-weight: 400;
}

.dw-magi__version {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-magi__active {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-magi__label {
  color: var(--c-text-subtle);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-magi__url {
  overflow-wrap: anywhere;
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
}

.dw-magi__section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.dw-magi__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.dw-magi__section-title {
  color: var(--c-text-subtle);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-magi__section-meta {
  color: var(--c-text-faint);
  font-size: 0.63rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-magi__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-magi__contract {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text);
  text-decoration: none;
}

.dw-magi__contract:hover,
.dw-magi__contract:focus-visible {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  text-decoration: none;
}

.dw-magi__contract-name {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-magi__contract-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
}

.dw-magi__tokens {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-magi__token {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.32rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-magi__token-symbol {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.72rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-magi__token-price {
  color: var(--c-text-muted);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-magi__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.4;
}

.dw-magi__footer {
  align-items: center;
}

@media (max-width: 479px) {
  .dw-magi__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dw-magi__tokens {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import {
  MAGI_ENDPOINTS,
  fetchMagiTokenPrices,
  fetchMagiWitnesses,
  fetchRecentMagiContracts,
  probeMagiNode
} from 'src/services/magi'
import { magiNetworkSummary } from 'src/services/magiNetworkSummary'
import { formatCount, formatLatency } from 'src/services/network'

export default {
  name: 'WidgetMagiNetwork',
  components: { DashboardWidgetState },
  props: {
    showContracts: { type: Boolean, default: true },
    showTokens: { type: Boolean, default: true },
    limit: { type: Number, default: 4 }
  },
  data () {
    return {
      node: null,
      witnesses: [],
      contracts: [],
      tokenPrices: null,
      loading: true,
      loaded: false,
      loadError: '',
      updatedAt: 0
    }
  },
  computed: {
    queryLimit () {
      const limit = Math.floor(Number(this.limit))
      if (!Number.isFinite(limit) || limit <= 0) return 4
      return Math.min(12, limit)
    },
    summary () {
      return magiNetworkSummary({
        node: this.node,
        witnesses: this.witnesses,
        contracts: this.contracts,
        tokens: this.tokenPrices,
        limit: this.queryLimit
      })
    },
    state () {
      if (this.loading && !this.loaded) return 'loading'
      if (!this.loaded) return 'error'
      return this.loadError ? 'stale' : 'ready'
    },
    statusIcon () {
      switch (this.summary.status) {
        case 'healthy':
          return 'check_circle'
        case 'warning':
          return 'warning'
        case 'critical':
          return 'error'
        default:
          return 'help_outline'
      }
    },
    headLabel () {
      return this.summary.node?.head ? formatCount(this.summary.node.head) : '—'
    },
    latencyLabel () {
      return formatLatency(this.summary.node?.latency)
    },
    nodeUrlLabel () {
      return shortenUrl(this.summary.node?.url)
    }
  },
  watch: {
    limit () {
      this.reload()
    }
  },
  mounted () {
    this.reload()
  },
  methods: {
    formatCount,
    formatHbd (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      if (number > 0 && number < 0.0001) return '<0.0001'
      return number.toLocaleString('en-US', {
        maximumFractionDigits: number >= 100 ? 2 : 4
      })
    },
    refresh () {
      this.reload({ force: true })
    },
    async reload ({ force = false } = {}) {
      this.loading = !this.loaded
      this.loadError = ''

      const endpoint = MAGI_ENDPOINTS[0] || ''
      let probe
      try {
        probe = await probeMagiNode(endpoint)
      } catch (error) {
        console.error('Failed to probe the Magi node', error)
        probe = { url: endpoint, ok: false, latency: null, error: 'Unreachable' }
      }

      if (!probe?.ok) {
        this.loadError = 'The Magi node is unreachable right now.'
        this.loading = false
        return
      }

      this.node = probe
      const [witnessResult, contractResult, tokenResult] = await Promise.allSettled([
        fetchMagiWitnesses(probe.head, { force }),
        fetchRecentMagiContracts(this.queryLimit, { force }),
        fetchMagiTokenPrices({ force })
      ])
      let failed = false

      if (witnessResult.status === 'fulfilled') {
        this.witnesses = Array.isArray(witnessResult.value) ? witnessResult.value : []
      } else {
        failed = true
        console.error('Failed to load Magi witnesses', witnessResult.reason)
      }

      if (contractResult.status === 'fulfilled') {
        this.contracts = contractResult.value || []
      } else {
        failed = true
        console.error('Failed to load recent Magi contracts', contractResult.reason)
      }

      if (tokenResult.status === 'fulfilled') {
        this.tokenPrices = tokenResult.value || null
      } else {
        failed = true
        console.error('Failed to load Magi token prices', tokenResult.reason)
      }

      if (failed) {
        this.loadError = 'Some Magi data is unavailable — showing the last values.'
      }

      this.loaded = true
      this.loading = false
      this.updatedAt = Date.now()
    }
  }
}

function shortenUrl (url) {
  const bare = String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!bare) return 'No active node'
  if (bare.length <= 34) return bare
  return bare.slice(0, 17) + '…' + bare.slice(-14)
}
</script>
