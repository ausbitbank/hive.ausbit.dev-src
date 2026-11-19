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
            Probe {{ nodes.length || 'every' }} public Hive API nodes from this browser, compare latency,
            head lag, versions and advertised features, and let the explorer fail over to the fastest healthy node.
          </p>
        </div>
        <div class="net-actions">
          <q-btn-toggle
            v-model="view"
            no-caps
            dense
            outline
            toggle-color="primary"
            :options="[
              { label: 'Cards', value: 'cards', icon: 'view_agenda' },
              { label: 'Compare', value: 'compare', icon: 'compare_arrows' }
            ]"
            aria-label="Node view"
          />
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
        <health-stat-card
          label="Beacon reliability"
          :value="beacon ? minimumScoreLabel : '—'"
          icon="radar"
          :status-label="beacon ? 'Monitored' : 'Offline'"
          :status-color="beacon ? 'green' : 'grey'"
          :hint="beacon ? 'Lowest score among healthy nodes · beacon.peakd.com' : 'Beacon monitor is unreachable; browser probes only'"
        />
      </div>

      <section class="net-section" aria-labelledby="node-status-title">
        <div class="net-section__head">
          <div>
            <h2 id="node-status-title" class="net-section__title">Node status and latency history</h2>
            <span class="net-section__hint">
              Each sparkline holds the last {{ maxSamples }} checks stored on this device.
              Typical latency is the median of recent samples.
            </span>
          </div>
          <span v-if="summary.fastest" class="net-chip net-chip--ok">
            <q-icon name="bolt" size="14px" aria-hidden="true" />
            Fastest {{ prettyUrl(summary.fastest.url) }}
          </span>
        </div>

        <div class="node-toolbar">
          <q-input
            v-model="search"
            dense
            outlined
            clearable
            placeholder="Filter by host or version"
            aria-label="Filter nodes"
            class="node-toolbar__search"
          >
            <template #prepend>
              <q-icon name="search" size="18px" aria-hidden="true" />
            </template>
          </q-input>
          <q-select
            v-model="filter"
            dense
            outlined
            emit-value
            map-options
            :options="filterOptions"
            label="Show"
            class="node-toolbar__select"
          />
          <q-select
            v-model="sortKey"
            dense
            outlined
            emit-value
            map-options
            :options="sortOptions"
            label="Sort by"
            class="node-toolbar__select"
          />
          <q-btn
            flat
            dense
            no-caps
            :icon="sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'"
            :label="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
            aria-label="Toggle sort direction"
            @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
          />
          <q-toggle
            v-model="prefs.includeWatched"
            label="Include watched nodes"
            color="primary"
            @update:model-value="savePrefs"
          />
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

        <q-card v-else-if="!visibleNodes.length" flat bordered class="net-state">
          <q-icon name="dns" size="2em" color="grey" aria-hidden="true" />
          <div>{{ nodes.length ? 'No nodes match this filter.' : 'No API nodes are configured.' }}</div>
          <q-btn v-if="!nodes.length" flat dense no-caps color="primary" icon="refresh" label="Probe nodes" @click="checkAll" />
        </q-card>

        <node-compare-table
          v-else-if="view === 'compare'"
          :nodes="visibleNodes"
          :active-node="activeNode"
          :expected-version="expectedVersion"
          :typical-for="typicalFor"
          @use="useNode"
        />

        <q-card v-else flat bordered class="nodes-list-card">
          <ul class="nodes-list">
            <node-status-row
              v-for="node in visibleNodes"
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

      <section class="net-section" aria-labelledby="node-features-title">
        <div class="net-section__head">
          <div>
            <h2 id="node-features-title" class="net-section__title">API feature coverage</h2>
            <span class="net-section__hint">Advertised features from the beacon monitor, grouped for quick comparison.</span>
          </div>
        </div>
        <node-feature-coverage :matrix="features" :nodes="beaconEntries" :active-node="activeNode" />
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
            <div class="node-prefs__row">
              <q-toggle
                v-model="prefs.requireFeatures"
                label="Prefer nodes with full API features"
                color="primary"
                @update:model-value="savePrefs"
              />
              <p>
                Only auto-select nodes that advertise account history and broadcast support.
                Leave off if the beacon monitor is unreachable or you deliberately want a
                minimal node.
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

.node-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.node-toolbar__search {
  flex: 1 1 220px;
  min-width: 160px;
}

.node-toolbar__select {
  flex: 0 0 180px;
  max-width: 100%;
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

@media (max-width: 599px) {
  .node-toolbar {
    gap: 0.5rem;
  }

  .node-toolbar__select {
    flex: 1 1 140px;
  }
}
</style>

<script>
import HealthStatCard from 'components/health/HealthStatCard.vue'
import NodeStatusRow from 'components/nodes/NodeStatusRow.vue'
import NodeCompareTable from 'components/nodes/NodeCompareTable.vue'
import NodeFeatureCoverage from 'components/nodes/NodeFeatureCoverage.vue'
import { HIVE_API_NODES, WATCHED_HIVE_NODES } from 'src/services/hiveNodes'
import { probeHiveNodeFull, setHiveNode, typicalLatency } from 'src/services/hive'
import { fetchBeaconNodes } from 'src/services/beacon'
import {
  NODE_FILTER_OPTIONS,
  NODE_SORT_OPTIONS,
  attachBeacon,
  featureMatrix,
  filterNodes,
  formatCount,
  formatLatency,
  formatPercent,
  minimumScore,
  pickFastestHealthy,
  sortNodes,
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

const BEACON_FULL_REFRESH_MS = 5 * 60 * 1000

export default {
  name: 'Nodes',
  components: { HealthStatCard, NodeStatusRow, NodeCompareTable, NodeFeatureCoverage },
  mixins: [VueTimers],
  timers: {
    autoCheck: { time: 30000, autostart: true, repeat: true, immediate: false, isSwitchTab: false }
  },
  data () {
    return {
      nodes: [],
      beaconMap: {},
      loading: false,
      beaconLoading: false,
      lastChecked: null,
      beaconCheckedAt: null,
      expectedVersion: '',
      activeNode: this.$hiveStore.user.settings.apiNode || HIVE_API_NODES[0],
      history: {},
      prefs: loadNodePrefs(),
      maxSamples: MAX_SAMPLES,
      view: 'cards',
      search: '',
      filter: 'all',
      sortKey: 'latency',
      sortDirection: 'asc',
      sortOptions: NODE_SORT_OPTIONS,
      filterOptions: NODE_FILTER_OPTIONS
    }
  },
  computed: {
    summary () {
      return summarizeNodes(this.nodes)
    },
    beacon () {
      return this.nodes.some(node => node.beacon)
    },
    minimumScoreLabel () {
      const score = minimumScore(this.nodes)
      return score === null ? '—' : score + ' / 100'
    },
    scoredNodes () {
      return this.nodes.filter(node => node.beacon)
    },
    beaconEntries () {
      return this.scoredNodes.map(node => node.beacon)
    },
    features () {
      return featureMatrix(this.beaconEntries)
    },
    visibleNodes () {
      const search = this.search.trim().toLowerCase()
      let list = filterNodes(this.nodes, this.filter)
      if (search) {
        list = list.filter(node => {
          return String(node.url || '').toLowerCase().includes(search) ||
            String(node.version || '').toLowerCase().includes(search) ||
            (node.beacon?.features || []).some(feature => feature.toLowerCase().includes(search))
        })
      }
      return sortNodes(list, this.sortKey, this.sortDirection, { typicalOf: this.typicalFor })
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
      title: 'Hive API nodes — latency history, features and failover',
      description: 'Probe every public Hive API node for latency, head lag and software version. Compare advertised features, keep latency history, fail over automatically and select the fastest healthy node.',
      url: '/nodes'
    })
    this.history = loadNodeHistory()
    this.checkAll()
    this.loadBeacon()
    this.loadChainVersion()
  },
  methods: {
    formatCount,
    formatLatency,
    formatPercent,
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    autoCheck () {
      this.checkAll()
    },
    samplesFor (url) {
      return Array.isArray(this.history[url]) ? this.history[url] : []
    },
    typicalFor (node) {
      if (!node) return null
      return typicalLatency(this.samplesFor(node.url), node.latency)
    },
    probeList () {
      const watch = this.prefs.includeWatched ? WATCHED_HIVE_NODES : []
      return [...new Set([this.activeNode, ...HIVE_API_NODES, ...watch].filter(Boolean))]
    },
    async loadChainVersion () {
      try {
        const config = await this.$hive.api.callAsync('condenser_api.get_config', [])
        this.expectedVersion = config?.HIVE_BLOCKCHAIN_VERSION || ''
      } catch {
        this.expectedVersion = ''
      }
    },
    async loadBeacon () {
      if (this.beaconLoading) return
      this.beaconLoading = true
      try {
        const result = await fetchBeaconNodes()
        this.beaconMap = result.nodes
        this.beaconCheckedAt = result.ok ? result.fetchedAt : null
        this.nodes = attachBeacon(this.nodes, this.beaconMap)
        if (result.ok) this.applyAutomaticSelection(this.nodes)
      } finally {
        this.beaconLoading = false
      }
    },
    async checkAll () {
      if (this.loading) return
      this.loading = true
      try {
        const urls = this.probeList()
        const results = await Promise.all(urls.map(url => probeHiveNodeFull(url)))
        const tagged = results.map(node => ({
          ...node,
          fallback: HIVE_API_NODES.includes(node.url)
        }))
        const nodes = withHeadLag(tagged)
        this.nodes = nodes
        this.history = recordSamples(this.history, nodes)
        saveNodeHistory(this.history)
        this.lastChecked = Date.now()
        if (this.beaconMap) this.nodes = attachBeacon(nodes, this.beaconMap)
        if (this.beaconMap) this.applyAutomaticSelection(this.nodes)
        if (!this.beaconMap || !this.beaconCheckedAt || Date.now() - this.beaconCheckedAt > BEACON_FULL_REFRESH_MS) {
          this.loadBeacon()
        }
      } finally {
        this.loading = false
      }
    },
    candidateNodes (nodes) {
      let candidates = nodes.filter(node => node.ok && node.fallback)
      if (this.prefs.requireFeatures) {
        candidates = candidates.filter(node => {
          const features = node.beacon?.features || []
          return features.includes('get_account_history') && features.includes('broadcast')
        })
      }
      return candidates
    },
    applyAutomaticSelection (nodes) {
      const fastest = pickFastestHealthy(this.candidateNodes(nodes))
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
      const fastest = pickFastestHealthy(this.candidateNodes(this.nodes))
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
