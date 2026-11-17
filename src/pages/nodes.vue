<template>
  <q-page class="net-page">
    <div class="net-shell">
      <header class="net-head">
        <div class="net-head__text">
          <div class="net-eyebrow">
            <span class="home-live-dot" :class="{ 'is-live': !loading && summary.healthyCount }" aria-hidden="true"></span>
            Infrastructure
          </div>
          <h1 class="net-head__title">API nodes</h1>
          <p class="net-intro">
            Probe public Hive API nodes from this browser, compare latency and head lag,
            and let the explorer fail over to the fastest healthy node.
          </p>
        </div>
        <div class="net-actions">
          <q-btn no-caps outline color="primary" icon="bolt" label="Auto-select fastest" :disable="!summary.fastest" @click="selectFastest" />
          <q-btn flat round dense icon="refresh" aria-label="Re-check all API nodes" title="Re-check all API nodes" :loading="loading" @click="checkAll" />
        </div>
      </header>

      <div class="net-stat-grid">
        <health-stat-card
          label="Healthy nodes"
          :value="summary.healthyCount + ' / ' + summary.total"
          icon="dns"
          :status-label="summary.unreachableCount ? 'Degraded' : 'All healthy'"
          :status-color="summary.unreachableCount ? 'orange' : 'green'"
          :progress="summary.total ? summary.healthyCount / summary.total : 0"
          :aria-label="summary.healthyCount + ' of ' + summary.total + ' API nodes healthy'"
          :hint="lastCheckedLabel"
        />
        <health-stat-card
          label="Fastest response"
          :value="summary.fastest ? formatLatency(summary.fastest.latency) : '—'"
          icon="speed"
          :hint="summary.fastest ? prettyUrl(summary.fastest.url) : 'No healthy node responded'"
        />
        <health-stat-card
          label="Average latency"
          :value="formatLatency(summary.averageLatency)"
          icon="timeline"
          :hint="'Across ' + summary.healthyCount + ' healthy node' + (summary.healthyCount === 1 ? '' : 's')"
        />
        <health-stat-card
          label="Worst head lag"
          :value="summary.maxLag === null ? '—' : summary.maxLag + ' blocks'"
          icon="view_stream"
          :status-label="summary.maxLag > 2 ? 'Behind' : 'Synced'"
          :status-color="summary.maxLag > 2 ? 'orange' : 'green'"
          :hint="headBlock ? 'Highest head ' + formatCount(headBlock) : 'Head height unavailable'"
        />
        <health-stat-card
          label="Node versions"
          :value="versionLabel"
          icon="memory"
          :hint="'Expected v' + (expectedVersion || '—') + ' · active ' + prettyUrl(activeNode)"
        />
      </div>

      <section class="net-section" aria-labelledby="node-status-title">
        <div class="net-section__head">
          <div>
            <h2 id="node-status-title" class="net-section__title">Node status and latency history</h2>
            <span class="net-section__hint">Each sparkline holds the last {{ maxSamples }} checks stored on this device.</span>
          </div>
          <span v-if="summary.fastest" class="net-chip net-chip--ok">
            <q-icon name="bolt" size="14px" aria-hidden="true" />
            Fastest {{ prettyUrl(summary.fastest.url) }}
          </span>
        </div>

        <q-card v-if="loading && !nodes.length" flat bordered class="nodes-list-card">
          <div v-for="i in 4" :key="i" class="node-skeleton">
            <q-skeleton type="circle" size="20px" />
            <div class="node-skeleton__body">
              <q-skeleton type="text" width="42%" />
              <q-skeleton type="text" width="65%" />
            </div>
          </div>
        </q-card>

        <q-card v-else-if="!nodes.length" flat bordered class="net-state">
          <q-icon name="dns" size="2em" color="grey" aria-hidden="true" />
          <div>No API nodes are configured.</div>
          <q-btn flat dense no-caps color="primary" icon="refresh" label="Probe nodes" @click="checkAll" />
        </q-card>

        <q-card v-else flat bordered class="nodes-list-card">
          <ul class="nodes-list">
            <node-status-row
              v-for="node in sortedNodes"
              :key="node.url"
              :node="node"
              :active="node.url === activeNode"
              :expected-version="expectedVersion"
              :samples="samplesFor(node.url)"
              @use="useNode"
            />
          </ul>
        </q-card>
      </section>

      <section class="net-section" aria-labelledby="node-failover-title">
        <div class="net-section__head">
          <div>
            <h2 id="node-failover-title" class="net-section__title">Failover and auto-select</h2>
            <span class="net-section__hint">Preferences are stored locally on this device.</span>
          </div>
        </div>

        <q-card flat bordered class="node-prefs">
          <q-card-section class="node-prefs__body">
            <div class="node-prefs__row">
              <q-toggle
                v-model="prefs.autoFailover"
                label="Automatic failover"
                color="primary"
                @update:model-value="savePrefs"
              />
              <p>
                If the active node stops responding during a check, switch to the fastest
                healthy fallback automatically.
              </p>
            </div>
            <div class="node-prefs__row">
              <q-toggle
                v-model="prefs.autoSelectFastest"
                label="Auto-select fastest healthy node"
                color="primary"
                @update:model-value="savePrefs"
              />
              <p>
                After every check, prefer the healthy node with the lowest latency. This
                overrides a hand-picked node when a faster node responds.
              </p>
            </div>
            <div class="node-prefs__status">
              <q-icon :name="activeNodeHealthy ? 'check_circle' : 'warning'" :color="activeNodeHealthy ? 'green' : 'orange'" size="18px" aria-hidden="true" />
              <span>
                Active node <strong>{{ prettyUrl(activeNode) }}</strong>
                {{ activeNodeHealthy ? 'is responding.' : 'is unreachable or behind.' }}
              </span>
              <q-btn
                v-if="!activeNodeHealthy && summary.fastest"
                flat
                dense
                no-caps
                color="primary"
                icon="swap_horiz"
                :label="'Switch to ' + prettyUrl(summary.fastest.url)"
                @click="useNode(summary.fastest)"
              />
            </div>
          </q-card-section>
        </q-card>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.nodes-list-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.018);
}

.nodes-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.node-skeleton {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 0.9rem;
  border-top: 1px solid var(--border-subtle);
}

.node-skeleton:first-child {
  border-top: 0;
}

.node-skeleton__body {
  flex: 1;
  min-width: 0;
}

.node-prefs {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.028);
}

.node-prefs__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.node-prefs__row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.node-prefs__row p {
  flex: 1 1 320px;
  margin: 0;
  color: #90a4ae;
  font-size: 0.78rem;
  line-height: 1.5;
}

.node-prefs__status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
  color: #b0bec5;
  font-size: 0.78rem;
}

.node-prefs__status strong {
  color: #e4eaed;
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>

<script>
import HealthStatCard from 'components/health/HealthStatCard.vue'
import NodeStatusRow from 'components/nodes/NodeStatusRow.vue'
import { HIVE_API_NODES } from 'src/services/hiveNodes'
import { probeHiveNodeFull, setHiveNode } from 'src/services/hive'
import {
  formatCount,
  formatLatency,
  pickFastestHealthy,
  summarizeNodes,
  withHeadLag
} from 'src/services/network'
import {
  MAX_SAMPLES,
  loadNodeHistory,
  loadNodePrefs,
  recordSamples,
  saveNodeHistory,
  saveNodePrefs
} from 'src/services/nodeHistory'
import { setPageMeta } from 'src/utils/pageMeta'
import VueTimers from 'src/mixins/timers.js'

export default {
  name: 'Nodes',
  components: { HealthStatCard, NodeStatusRow },
  mixins: [VueTimers],
  timers: {
    autoCheck: { time: 30000, autostart: true, repeat: true, immediate: false, isSwitchTab: false }
  },
  data () {
    return {
      nodes: [],
      loading: false,
      lastChecked: null,
      expectedVersion: '',
      activeNode: this.$hiveStore.user.settings.apiNode || HIVE_API_NODES[0],
      history: {},
      prefs: loadNodePrefs(),
      maxSamples: MAX_SAMPLES
    }
  },
  computed: {
    summary () {
      return summarizeNodes(this.nodes)
    },
    sortedNodes () {
      return [...this.nodes].sort((a, b) => {
        if (a.ok !== b.ok) return a.ok ? -1 : 1
        if (a.ok && b.ok) {
          const lagDiff = (Number(a.lag) || 0) - (Number(b.lag) || 0)
          if (lagDiff !== 0) return lagDiff
          return Number(a.latency) - Number(b.latency)
        }
        return String(a.url).localeCompare(String(b.url))
      })
    },
    headBlock () {
      return this.nodes.reduce((best, node) => node.ok ? Math.max(best, Number(node.head) || 0) : best, 0)
    },
    versionLabel () {
      if (!this.summary.versions.length) return '—'
      return this.summary.versions
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map(item => 'v' + item.version + ' ×' + item.count)
        .join(' · ')
    },
    activeNodeHealthy () {
      const node = this.nodes.find(item => item.url === this.activeNode)
      return Boolean(node?.ok && (Number(node.lag) || 0) <= 2)
    },
    lastCheckedLabel () {
      if (!this.lastChecked) return 'Not checked yet'
      return 'Checked ' + new Date(this.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive API nodes — latency history, head lag and failover',
      description: 'Probe public Hive API nodes for latency, head lag and software version. Keep latency history, fail over automatically and select the fastest healthy node.',
      url: '/nodes'
    })
    this.history = loadNodeHistory()
    this.checkAll()
    this.loadChainVersion()
  },
  methods: {
    formatCount,
    formatLatency,
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    autoCheck () {
      this.checkAll()
    },
    samplesFor (url) {
      return Array.isArray(this.history[url]) ? this.history[url] : []
    },
    async loadChainVersion () {
      try {
        const config = await this.$hive.api.callAsync('condenser_api.get_config', [])
        this.expectedVersion = config?.HIVE_BLOCKCHAIN_VERSION || ''
      } catch {
        this.expectedVersion = ''
      }
    },
    async checkAll () {
      if (this.loading) return
      this.loading = true
      try {
        const urls = [...new Set([this.activeNode, ...HIVE_API_NODES].filter(Boolean))]
        const results = await Promise.all(urls.map(url => probeHiveNodeFull(url)))
        const nodes = withHeadLag(results)
        this.nodes = nodes
        this.history = recordSamples(this.history, nodes)
        saveNodeHistory(this.history)
        this.lastChecked = Date.now()
        this.applyAutomaticSelection(nodes)
      } finally {
        this.loading = false
      }
    },
    applyAutomaticSelection (nodes) {
      const fastest = pickFastestHealthy(nodes)
      if (this.prefs.autoSelectFastest && fastest && fastest.url !== this.activeNode) {
        this.applyNode(fastest, 'Auto-selected the fastest healthy node')
        return
      }
      if (!this.prefs.autoFailover) return
      const current = nodes.find(node => node.url === this.activeNode)
      if (current?.ok && (Number(current.lag) || 0) <= 3) return
      if (fastest) this.applyNode(fastest, 'Failover: the previous node was unhealthy')
    },
    useNode (node) {
      if (!node?.ok) return
      this.applyNode(node, 'Using ' + this.prettyUrl(node.url))
    },
    selectFastest () {
      const fastest = pickFastestHealthy(this.nodes)
      if (!fastest) {
        this.$q.notify({ type: 'warning', message: 'No healthy node is available yet.' })
        return
      }
      this.applyNode(fastest, 'Selected the fastest healthy node')
    },
    applyNode (node, message) {
      if (!node?.url) return
      this.activeNode = node.url
      this.$hiveStore.updateSettings({ ...this.$hiveStore.user.settings, apiNode: node.url })
      setHiveNode(node.url)
      this.$q.notify({ type: 'positive', message })
    },
    savePrefs () {
      saveNodePrefs(this.prefs)
    }
  }
}
</script>
