<template>
  <div class="dw-node">
    <q-card-section class="home-panel__head dw-node__head">
      <div>
        <div class="home-eyebrow">Infrastructure</div>
        <h2 class="home-panel__title">Node health</h2>
      </div>
      <span class="dw-node__badge" :class="'is-' + summary.status" role="status">
        <q-icon :name="statusIcon" size="14px" aria-hidden="true" />
        {{ summary.statusLabel }}
      </span>
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'Node health is unavailable right now.'"
      @retry="refresh"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-node__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section class="dw-node__body">
        <div class="dw-node__active">
          <span class="dw-node__label">Active API node</span>
          <span class="dw-node__url" :title="activeUrl">{{ activeUrlLabel }}</span>
        </div>

        <dl class="dw-node__stats">
          <div>
            <dt>Latency</dt>
            <dd>{{ latencyLabel }}</dd>
          </div>
          <div>
            <dt>Failures</dt>
            <dd>{{ summary.failures }}</dd>
          </div>
          <div>
            <dt>Cooldowns</dt>
            <dd>{{ summary.coolingDown }}</dd>
          </div>
          <div>
            <dt>Nodes</dt>
            <dd>
              {{ summary.nodes }}
              <small title="Nodes that have answered successfully this session">{{ summary.healthy }} verified</small>
            </dd>
          </div>
          <div>
            <dt>Head block</dt>
            <dd>
              <router-link v-if="summary.headBlock" :to="'/b/' + summary.headBlock">
                {{ formatCount(summary.headBlock) }}
              </router-link>
              <span v-else>—</span>
            </dd>
          </div>
        </dl>

        <ul v-if="showL2" class="dw-node__l2" aria-label="Layer 2 node status">
          <li v-for="row in l2Rows" :key="row.id" class="dw-node__l2-row">
            <span class="dw-node__l2-name">{{ row.label }}</span>
            <span class="dw-node__l2-state" :class="'is-' + row.tone">
              <q-icon :name="row.icon" size="14px" aria-hidden="true" />
              {{ row.state }}
            </span>
            <span class="dw-node__l2-latency">{{ row.latency }}</span>
          </li>
        </ul>

        <p v-if="summary.failing > 0" class="dw-node__hint">
          {{ summary.failing }} configured node{{ summary.failing === 1 ? '' : 's' }}
          failing or cooling down.
        </p>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-node__footer">
        <div class="dw-node__links">
          <router-link to="/health">Health</router-link>
          <router-link to="/nodes">API nodes</router-link>
        </div>
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          color="primary"
          icon="refresh"
          label="Refresh"
          :loading="loading || probeLoading"
          @click="refresh"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-node {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-node__head {
  align-items: flex-start;
}

.dw-node__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-pill);
  font-size: 0.66rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-node__badge.is-healthy {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-node__badge.is-warning {
  background: color-mix(in srgb, var(--c-warning) 14%, transparent);
  color: var(--c-warning-soft);
}

.dw-node__badge.is-critical {
  background: color-mix(in srgb, var(--c-negative) 14%, transparent);
  color: var(--c-negative);
}

.dw-node__badge.is-unknown {
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-muted);
}

.dw-node__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-node__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.65rem;
}

.dw-node__active {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-node__label {
  color: var(--c-text-subtle);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-node__url {
  overflow-wrap: anywhere;
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
}

.dw-node__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(82px, 1fr));
  gap: 0.3rem;
  margin: 0;
}

.dw-node__stats > div {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-node__stats dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-node__stats dd {
  display: flex;
  flex-direction: column;
  margin: 0;
  color: var(--c-text);
  font-size: 0.88rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dw-node__stats dd a {
  color: var(--c-link);
  text-decoration: none;
}

.dw-node__stats dd a:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.dw-node__stats dd small {
  color: var(--c-text-faint);
  font-size: 0.58rem;
  font-weight: 400;
}

.dw-node__l2 {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-node__l2-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-node__l2-name {
  min-width: 0;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dw-node__l2-state {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  font-size: 0.67rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-node__l2-state.is-healthy {
  color: var(--c-positive);
}

.dw-node__l2-state.is-warning {
  color: var(--c-warning-soft);
}

.dw-node__l2-state.is-critical {
  color: var(--c-negative);
}

.dw-node__l2-state.is-unknown {
  color: var(--c-text-faint);
}

.dw-node__l2-latency {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-node__hint {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.4;
}

.dw-node__footer {
  align-items: center;
}

.dw-node__links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

@media (max-width: 479px) {
  .dw-node__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { getApiNodeHealth } from 'src/services/api'
import { fetchGlobalProps } from 'src/services/chainData'
import { probeHiveEngineNode } from 'src/services/hiveEngine'
import { HIVE_ENGINE_NODES } from 'src/services/hiveNodes'
import { probeMagiNode, MAGI_ENDPOINTS } from 'src/services/magi'
import { formatCount, formatLatency } from 'src/services/network'
import { nodeHealthSummary } from 'src/services/nodeHealthSummary'

export default {
  name: 'WidgetNodeHealth',
  components: { DashboardWidgetState },
  props: {
    showL2: { type: Boolean, default: false }
  },
  data () {
    return {
      health: [],
      globalProps: null,
      engine: null,
      magi: null,
      loading: true,
      loaded: false,
      probeLoading: false,
      probesRun: false,
      visible: false,
      loadError: '',
      updatedAt: 0
    }
  },
  computed: {
    summary () {
      return nodeHealthSummary({
        health: this.health,
        globalProps: this.globalProps,
        engine: this.engine,
        magi: this.magi
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
    activeUrl () {
      return this.summary.activeNode?.url || ''
    },
    activeUrlLabel () {
      if (!this.activeUrl) return 'No active node'
      return shortenUrl(this.activeUrl)
    },
    latencyLabel () {
      return formatLatency(this.summary.lastLatency)
    },
    l2Rows () {
      return [
        { id: 'hive-engine', label: 'Hive-Engine', status: this.summary.engine },
        { id: 'magi', label: 'Magi', status: this.summary.magi }
      ].map(row => {
        const status = row.status
        if (!status) {
          return {
            ...row,
            tone: 'unknown',
            icon: 'schedule',
            state: this.probeLoading ? 'Checking…' : 'Not checked',
            latency: ''
          }
        }
        if (!status.configured) {
          return { ...row, tone: 'unknown', icon: 'help_outline', state: 'Not configured', latency: '' }
        }
        if (status.ok) {
          return {
            ...row,
            tone: 'healthy',
            icon: 'check_circle',
            state: 'Online',
            latency: formatLatency(status.latencyMs)
          }
        }
        return {
          ...row,
          tone: 'critical',
          icon: 'error',
          state: status.label || 'Unavailable',
          latency: formatLatency(status.latencyMs)
        }
      })
    }
  },
  watch: {
    showL2 (value) {
      if (value && this.loaded && this.visible) this.probeL2()
    }
  },
  mounted () {
    this.setupVisibility()
    this.reload()
  },
  beforeUnmount () {
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect()
      this._visibilityObserver = null
    }
  },
  methods: {
    formatCount,
    setupVisibility () {
      if (typeof IntersectionObserver === 'undefined') {
        this.visible = true
        return
      }
      this._visibilityObserver = new IntersectionObserver(entries => {
        this.visible = Boolean(entries[0]?.isIntersecting)
        if (this.visible && !this.probesRun && this.loaded && this.showL2) this.probeL2()
      }, { threshold: 0 })
      this._visibilityObserver.observe(this.$el)
    },
    refreshHealth () {
      this.health = getApiNodeHealth()
    },
    refresh () {
      this.reload({ manual: true })
    },
    async reload ({ manual = false } = {}) {
      this.loading = !this.loaded
      this.loadError = ''
      this.refreshHealth()
      try {
        const props = await fetchGlobalProps({ force: manual })
        this.globalProps = props && !props.empty ? props : null
        if (!this.globalProps) {
          this.loadError = 'Head block unavailable — node health is still live.'
        }
      } catch (error) {
        console.error('Failed to load the node health head block', error)
        this.loadError = 'Head block unavailable — node health is still live.'
      } finally {
        this.refreshHealth()
        this.loaded = true
        this.loading = false
        this.updatedAt = Date.now()
      }
      if (this.showL2 && (manual || this.visible)) this.probeL2()
    },
    async probeL2 () {
      if (!this.showL2 || this.probeLoading) return
      this.probeLoading = true
      this.probesRun = true
      const [engineResult, magiResult] = await Promise.allSettled([
        probeHiveEngineNode(HIVE_ENGINE_NODES[0]),
        probeMagiNode(MAGI_ENDPOINTS[0])
      ])
      this.engine = engineResult.status === 'fulfilled'
        ? engineResult.value || null
        : { url: HIVE_ENGINE_NODES[0], ok: false, latency: null, error: 'Unreachable' }
      this.magi = magiResult.status === 'fulfilled'
        ? magiResult.value || null
        : { url: MAGI_ENDPOINTS[0], ok: false, latency: null, error: 'Unreachable' }
      this.probeLoading = false
      this.updatedAt = Date.now()
    }
  }
}

function shortenUrl (url) {
  const bare = String(url).replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (bare.length <= 32) return bare
  return bare.slice(0, 16) + '…' + bare.slice(-13)
}
</script>
