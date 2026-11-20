<template>
  <q-page class="net-page">
    <div class="net-shell">
      <header class="net-head">
        <div class="net-head__text">
          <div class="net-eyebrow">
            <span class="home-live-dot" :class="{ 'is-live': !currentState.loading && summary.healthyCount }" aria-hidden="true"></span>
            Infrastructure · {{ activeConfig.eyebrow }}
          </div>
          <h1 class="net-head__title">{{ activeConfig.title }}</h1>
          <p class="net-intro">{{ activeConfig.intro }}</p>
        </div>
        <div class="net-actions">
          <q-btn-toggle
            v-model="activeNetwork"
            no-caps
            dense
            outline
            toggle-color="primary"
            :options="networkOptions"
            aria-label="Node network"
            @update:model-value="switchNetwork"
          />
          <q-btn no-caps outline color="primary" icon="bolt" label="Auto-select fastest" :disable="!summary.fastest" @click="selectFastest" />
          <q-btn flat round dense icon="refresh" :aria-label="'Re-check all ' + activeConfig.label + ' nodes'" :title="'Re-check all ' + activeConfig.label + ' nodes'" :loading="currentState.loading" @click="checkNetwork(activeNetwork)" />
        </div>
      </header>

      <div class="net-stat-grid">
        <health-stat-card
          v-for="card in statCards"
          :key="card.label"
          v-bind="card"
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
            placeholder="Filter by host, version or chain"
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
            v-if="hasWatched"
            v-model="prefs.includeWatched"
            label="Include watched nodes"
            color="primary"
            @update:model-value="savePrefs"
          />
        </div>

        <q-card v-if="currentState.loading && !nodes.length" flat bordered class="nodes-list-card">
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
          <div>{{ nodes.length ? 'No nodes match this filter.' : 'No ' + activeConfig.label + ' nodes are configured.' }}</div>
          <q-btn v-if="!nodes.length" flat dense no-caps color="primary" icon="refresh" label="Probe nodes" @click="checkNetwork(activeNetwork)" />
        </q-card>

        <node-compare-table
          v-else-if="view === 'compare' && activeNetwork === 'hive'"
          :nodes="visibleNodes"
          :active-node="activeNode"
          :expected-version="expectedVersion"
          :typical-for="typicalFor"
          @use="useNode"
        />

        <node-layer2-compare-table
          v-else-if="view === 'compare'"
          :network="activeNetwork"
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
              :network="activeNetwork"
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
            <h2 id="node-features-title" class="net-section__title">{{ infoTitle }}</h2>
            <span class="net-section__hint">{{ infoHint }}</span>
          </div>
        </div>

        <node-feature-coverage
          v-if="activeNetwork === 'hive'"
          :matrix="features"
          :nodes="beaconEntries"
          :active-node="activeNode"
        />

        <q-card v-else-if="activeNetwork === 'hiveEngine'" flat bordered class="node-prefs">
          <q-card-section class="node-prefs__body">
            <div class="layer2-stat-grid">
              <div>
                <span>Sidechain head</span>
                <strong>{{ formatCount(headBlock) }}</strong>
                <small>{{ summary.healthyCount }} healthy host{{ summary.healthyCount === 1 ? '' : 's' }}</small>
              </div>
              <div>
                <span>Hive block</span>
                <strong>{{ hiveEngineInfo.hiveHead ? formatCount(hiveEngineInfo.hiveHead) : '—' }}</strong>
                <small>{{ hiveEngineInfo.hiveLag === null ? 'lag unavailable' : hiveEngineInfo.hiveLag + ' block' + (hiveEngineInfo.hiveLag === 1 ? '' : 's') + ' behind the best host' }}</small>
              </div>
              <div>
                <span>Chain</span>
                <strong>{{ hiveEngineInfo.chainIds.length ? hiveEngineInfo.chainIds.join(', ') : '—' }}</strong>
                <small>{{ hiveEngineInfo.lightCount }} light node{{ hiveEngineInfo.lightCount === 1 ? '' : 's' }}</small>
              </div>
              <div>
                <span>Versions</span>
                <strong>{{ versionLabel }}</strong>
                <small>{{ hiveEngineInfo.lastVerified ? 'verified ' + formatCount(hiveEngineInfo.lastVerified) : 'no verified block reported' }}</small>
              </div>
            </div>
            <p class="layer2-note">
              Hive-Engine hosts answer <code>getStatus</code> at their root URL. The automatic
              selector only chooses from the four fallback hosts; watched nodes are probe-only.
            </p>
          </q-card-section>
        </q-card>

        <magi-network-panel
          v-else
          :node="magiInfo.node"
          :nodes="nodes"
        />
      </section>

      <section class="net-section" aria-labelledby="node-failover-title">
        <div class="net-section__head">
          <div>
            <h2 id="node-failover-title" class="net-section__title">Failover and auto-select</h2>
            <span class="net-section__hint">Preferences are stored locally on this device and apply to {{ activeConfig.label }} reads.</span>
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
                If the active {{ activeConfig.label }} node stops responding during a check, switch
                to the fastest healthy fallback automatically.
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
            <div v-if="activeNetwork === 'hive'" class="node-prefs__row">
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
                Active {{ activeConfig.label }} node <strong>{{ prettyUrl(activeNode) }}</strong>
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

.layer2-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.layer2-stat-grid > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.layer2-stat-grid span {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.layer2-stat-grid strong {
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.layer2-stat-grid small {
  color: #78909c;
  font-size: 0.66rem;
  overflow-wrap: anywhere;
}

.layer2-note {
  margin: 0;
  color: #78909c;
  font-size: 0.74rem;
  line-height: 1.5;
}

.layer2-note code {
  color: #b0bec5;
  font-size: 0.72rem;
}

@media (max-width: 799px) {
  .layer2-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .node-toolbar {
    gap: 0.5rem;
  }

  .node-toolbar__select {
    flex: 1 1 140px;
  }

  .layer2-stat-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import HealthStatCard from 'components/health/HealthStatCard.vue'
import NodeStatusRow from 'components/nodes/NodeStatusRow.vue'
import NodeCompareTable from 'components/nodes/NodeCompareTable.vue'
import NodeLayer2CompareTable from 'components/nodes/NodeLayer2CompareTable.vue'
import NodeFeatureCoverage from 'components/nodes/NodeFeatureCoverage.vue'
import MagiNetworkPanel from 'components/nodes/MagiNetworkPanel.vue'
import {
  DEFAULT_HIVE_ENGINE_NODE,
  DEFAULT_HIVE_NODE,
  DEFAULT_MAGI_NODE,
  HIVE_API_NODES,
  HIVE_ENGINE_NODES,
  MAGI_NODES,
  WATCHED_HIVE_ENGINE_NODES,
  WATCHED_HIVE_NODES
} from 'src/services/hiveNodes'
import { probeHiveNodeFull, setHiveNode, typicalLatency } from 'src/services/hive'
import { probeHiveEngineNode } from 'src/services/hiveEngine'
import { probeMagiNode } from 'src/services/magi'
import { fetchBeaconNodes } from 'src/services/beacon'
import {
  LAYER2_SORT_OPTIONS,
  NODE_FILTER_OPTIONS,
  NODE_SORT_OPTIONS,
  attachBeacon,
  featureMatrix,
  filterNodes,
  formatCount,
  formatLatency,
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
const STALE_CHECK_MS = 60 * 1000

const NETWORKS = [
  {
    id: 'hive',
    label: 'Hive L1',
    eyebrow: 'Layer 1',
    icon: 'link',
    title: 'Hive API nodes',
    intro: 'Probe every public Hive API node from this browser, compare latency, head lag, versions and advertised features, and let the explorer fail over to the fastest healthy node.',
    settingsKey: 'apiNode',
    defaultNode: DEFAULT_HIVE_NODE,
    known: HIVE_API_NODES,
    watched: WATCHED_HIVE_NODES,
    probe: probeHiveNodeFull
  },
  {
    id: 'hiveEngine',
    label: 'Hive-Engine',
    eyebrow: 'Layer 2',
    icon: 'token',
    title: 'Hive-Engine nodes',
    intro: 'Probe public Hive-Engine RPC hosts for sidechain head, Hive block lag, software version, chain ID and latency, then switch the wallet and market reads to the fastest healthy node.',
    settingsKey: 'heApiNode',
    defaultNode: DEFAULT_HIVE_ENGINE_NODE,
    known: HIVE_ENGINE_NODES,
    watched: WATCHED_HIVE_ENGINE_NODES,
    probe: probeHiveEngineNode
  },
  {
    id: 'magi',
    label: 'Magi',
    eyebrow: 'Layer 2',
    icon: 'hub',
    title: 'Magi network nodes',
    intro: 'Probe public Magi GraphQL nodes for processed block height, epoch, consensus version, processing state, version and latency. The selected endpoint is used by Magi wallet and dashboard reads.',
    settingsKey: 'magiApiNode',
    defaultNode: DEFAULT_MAGI_NODE,
    known: MAGI_NODES,
    watched: [],
    probe: probeMagiNode
  }
]

function emptyNetworkState () {
  return {
    nodes: [],
    loading: false,
    lastChecked: null,
    expectedVersion: '',
    beaconMap: {},
    beaconCheckedAt: null,
    beaconLoading: false
  }
}

function modeOf (values) {
  const counts = new Map()
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || ''
}

export default {
  name: 'Nodes',
  components: {
    HealthStatCard,
    NodeStatusRow,
    NodeCompareTable,
    NodeLayer2CompareTable,
    NodeFeatureCoverage,
    MagiNetworkPanel
  },
  mixins: [VueTimers],
  timers: {
    autoCheck: { time: 30000, autostart: true, repeat: true, immediate: false, isSwitchTab: false }
  },
  data () {
    const states = {}
    for (const network of NETWORKS) states[network.id] = emptyNetworkState()
    const requested = this.$route?.query?.network
    return {
      activeNetwork: ['hive', 'hiveEngine', 'magi'].includes(requested) ? requested : 'hive',
      states,
      history: {},
      prefs: loadNodePrefs(),
      maxSamples: MAX_SAMPLES,
      view: 'cards',
      search: '',
      filter: 'all',
      sortKey: 'latency',
      sortDirection: 'asc',
      filterOptions: NODE_FILTER_OPTIONS
    }
  },
  computed: {
    networkOptions () {
      return NETWORKS.map(network => ({
        label: network.label,
        value: network.id,
        icon: network.icon
      }))
    },
    activeConfig () {
      return NETWORKS.find(network => network.id === this.activeNetwork) || NETWORKS[0]
    },
    currentState () {
      return this.states[this.activeNetwork] || emptyNetworkState()
    },
    nodes () {
      return this.currentState.nodes
    },
    activeNode () {
      return this.configuredNode(this.activeNetwork)
    },
    activeNodeInfo () {
      return this.nodes.find(node => node.url === this.activeNode) || null
    },
    sortOptions () {
      return this.activeNetwork === 'hive' ? NODE_SORT_OPTIONS : LAYER2_SORT_OPTIONS
    },
    hasWatched () {
      return Boolean(this.activeConfig.watched?.length)
    },
    summary () {
      return summarizeNodes(this.nodes)
    },
    beacon () {
      return this.activeNetwork === 'hive' && this.nodes.some(node => node.beacon)
    },
    minimumScoreLabel () {
      const score = minimumScore(this.nodes)
      return score === null ? '—' : score + ' / 100'
    },
    beaconEntries () {
      return this.nodes.filter(node => node.beacon).map(node => node.beacon)
    },
    features () {
      return featureMatrix(this.beaconEntries)
    },
    expectedVersion () {
      if (this.activeNetwork === 'hive') return this.currentState.expectedVersion || ''
      return modeOf(this.nodes.filter(node => node.ok).map(node => node.version))
    },
    visibleNodes () {
      const search = this.search.trim().toLowerCase()
      let list = filterNodes(this.nodes, this.filter)
      if (search) {
        list = list.filter(node => this.nodeSearchText(node).includes(search))
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
        .map(item => (this.activeNetwork === 'hive' ? 'v' : '') + item.version + ' ×' + item.count)
        .join(' · ')
    },
    activeNodeHealthy () {
      const node = this.activeNodeInfo
      return Boolean(node?.ok && (Number(node.lag) || 0) <= 2)
    },
    lastCheckedLabel () {
      if (!this.currentState.lastChecked) return 'Not checked yet'
      return 'Checked ' + new Date(this.currentState.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    hiveEngineInfo () {
      const healthy = this.nodes.filter(node => node.ok)
      const hiveHeads = healthy.map(node => Number(node.hiveHead) || 0).filter(Boolean)
      const hiveHead = hiveHeads.length ? Math.max(...hiveHeads) : 0
      const lag = hiveHead
        ? Math.max(...hiveHeads.map(head => Math.max(0, hiveHead - head)))
        : null
      const verified = healthy.map(node => Number(node.lastVerifiedBlock) || 0).filter(Boolean)
      return {
        chainIds: [...new Set(healthy.map(node => node.chainId).filter(Boolean))],
        lightCount: healthy.filter(node => node.lightNode).length,
        hiveHead,
        hiveLag: lag,
        lastVerified: verified.length ? Math.max(...verified) : 0
      }
    },
    magiInfo () {
      const healthy = this.nodes.filter(node => node.ok)
      const epochs = healthy.map(node => Number(node.epoch) || 0).filter(Boolean)
      const consensus = modeOf(healthy.map(node => node.consensusVersion))
      return {
        epoch: epochs.length ? Math.max(...epochs) : null,
        consensus,
        suspended: healthy.some(node => node.processingSuspended),
        node: this.activeNodeInfo?.ok ? this.activeNodeInfo : (this.summary.fastest || null)
      }
    },
    infoTitle () {
      if (this.activeNetwork === 'hive') return 'API feature coverage'
      if (this.activeNetwork === 'hiveEngine') return 'Hive-Engine chain'
      return 'Magi consensus and witnesses'
    },
    infoHint () {
      if (this.activeNetwork === 'hive') return 'Advertised features from the beacon monitor, grouped for quick comparison.'
      if (this.activeNetwork === 'hiveEngine') return 'Status fields reported by the probed Hive-Engine hosts.'
      return 'Epoch, consensus version and registrations from the active Magi node.'
    },
    statCards () {
      const summary = this.summary
      const cards = [
        {
          label: 'Healthy nodes',
          value: summary.healthyCount + ' / ' + summary.total,
          icon: 'dns',
          statusLabel: summary.unreachableCount ? 'Degraded' : 'All healthy',
          statusColor: summary.unreachableCount ? 'orange' : 'green',
          progress: summary.total ? summary.healthyCount / summary.total : 0,
          'aria-label': summary.healthyCount + ' of ' + summary.total + ' ' + this.activeConfig.label + ' nodes healthy',
          hint: this.lastCheckedLabel
        },
        {
          label: 'Fastest response',
          value: summary.fastest ? formatLatency(summary.fastest.latency) : '—',
          icon: 'speed',
          hint: summary.fastest ? this.prettyUrl(summary.fastest.url) : 'No healthy node responded'
        },
        {
          label: 'Average latency',
          value: formatLatency(summary.averageLatency),
          icon: 'timeline',
          hint: 'Across ' + summary.healthyCount + ' healthy node' + (summary.healthyCount === 1 ? '' : 's')
        },
        {
          label: 'Worst head lag',
          value: summary.maxLag === null ? '—' : summary.maxLag + ' blocks',
          icon: 'view_stream',
          statusLabel: summary.maxLag > 2 ? 'Behind' : 'Synced',
          statusColor: summary.maxLag > 2 ? 'orange' : 'green',
          hint: this.headBlock ? 'Highest head ' + formatCount(this.headBlock) : 'Head height unavailable'
        },
        {
          label: 'Node versions',
          value: this.versionLabel,
          icon: 'memory',
          hint: 'Most common ' + (this.expectedVersion || '—') + ' · active ' + this.prettyUrl(this.activeNode)
        }
      ]

      if (this.activeNetwork === 'hive') {
        cards.push({
          label: 'Beacon reliability',
          value: this.beacon ? this.minimumScoreLabel : '—',
          icon: 'radar',
          statusLabel: this.beacon ? 'Monitored' : 'Offline',
          statusColor: this.beacon ? 'green' : 'grey',
          hint: this.beacon ? 'Lowest score among healthy nodes · beacon.peakd.com' : 'Beacon monitor is unreachable; browser probes only'
        })
      } else if (this.activeNetwork === 'hiveEngine') {
        cards.push({
          label: 'Hive block',
          value: this.hiveEngineInfo.hiveHead ? formatCount(this.hiveEngineInfo.hiveHead) : '—',
          icon: 'link',
          statusLabel: this.hiveEngineInfo.hiveLag === null ? 'Unknown' : (this.hiveEngineInfo.hiveLag > 2 ? 'Behind' : 'Synced'),
          statusColor: this.hiveEngineInfo.hiveLag > 2 ? 'orange' : 'green',
          hint: this.hiveEngineInfo.hiveLag === null ? 'No host reported a Hive block' : 'Worst host lag ' + this.hiveEngineInfo.hiveLag + ' block' + (this.hiveEngineInfo.hiveLag === 1 ? '' : 's')
        })
      } else {
        cards.push({
          label: 'Magi epoch',
          value: this.magiInfo.epoch ? formatCount(this.magiInfo.epoch) : '—',
          icon: 'hub',
          statusLabel: this.magiInfo.suspended ? 'Suspended' : 'Running',
          statusColor: this.magiInfo.suspended ? 'orange' : 'green',
          hint: this.magiInfo.consensus ? 'Consensus ' + this.magiInfo.consensus : 'Consensus version unavailable'
        })
      }

      return cards
    }
  },
  mounted () {
    this.updatePageMeta()
    this.history = loadNodeHistory()
    for (const network of NETWORKS) this.checkNetwork(network.id)
    this.loadBeacon()
    this.loadHiveChainVersion()
  },
  methods: {
    formatCount,
    formatLatency,
    networkConfig (id) {
      return NETWORKS.find(network => network.id === id) || NETWORKS[0]
    },
    configuredNode (id) {
      const config = this.networkConfig(id)
      const settings = this.$hiveStore.user.settings || {}
      const value = settings[config.settingsKey] || config.defaultNode
      return id === 'hiveEngine' ? String(value).replace(/\/+$/, '') : value
    },
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    updatePageMeta () {
      const config = this.activeConfig
      setPageMeta({
        title: config.title + ' — latency, health and failover',
        description: 'Probe public ' + config.label + ' nodes for latency, head lag and software version. Compare node health, keep latency history and select the fastest healthy endpoint.',
        url: '/nodes'
      })
    },
    switchNetwork (id) {
      const state = this.states[id]
      if (id !== 'hive' && this.sortKey === 'score') this.sortKey = 'latency'
      this.updatePageMeta()
      if (state && (!state.nodes.length || Date.now() - (state.lastChecked || 0) > STALE_CHECK_MS)) {
        this.checkNetwork(id)
      }
    },
    autoCheck () {
      this.checkNetwork(this.activeNetwork)
    },
    samplesFor (url) {
      return Array.isArray(this.history[url]) ? this.history[url] : []
    },
    typicalFor (node) {
      if (!node) return null
      return typicalLatency(this.samplesFor(node.url), node.latency)
    },
    nodeSearchText (node) {
      return [
        node.url,
        node.version,
        node.versionId,
        node.chainId,
        node.consensusVersion,
        node.consensusLine,
        node.gitCommit,
        ...(node.beacon?.features || [])
      ].filter(Boolean).join(' ').toLowerCase()
    },
    probeList (id) {
      const config = this.networkConfig(id)
      const watched = this.prefs.includeWatched ? config.watched : []
      return [...new Set([this.configuredNode(id), ...config.known, ...watched].filter(Boolean))]
    },
    async loadHiveChainVersion () {
      try {
        const config = await this.$hive.api.callAsync('condenser_api.get_config', [])
        this.states.hive.expectedVersion = config?.HIVE_BLOCKCHAIN_VERSION || ''
      } catch {
        this.states.hive.expectedVersion = ''
      }
    },
    async loadBeacon () {
      const state = this.states.hive
      if (state.beaconLoading) return
      state.beaconLoading = true
      try {
        const result = await fetchBeaconNodes()
        state.beaconMap = result.nodes
        state.beaconCheckedAt = result.ok ? result.fetchedAt : null
        state.nodes = attachBeacon(state.nodes, state.beaconMap)
        if (result.ok) this.applyAutomaticSelection('hive', state.nodes)
      } finally {
        state.beaconLoading = false
      }
    },
    async checkNetwork (id) {
      const config = this.networkConfig(id)
      const state = this.states[id]
      if (!state || state.loading) return
      state.loading = true
      try {
        const urls = this.probeList(id)
        const results = await Promise.all(urls.map(url => {
          return config.probe(url).catch(error => ({
            url,
            ok: false,
            latency: Infinity,
            error: error?.message || 'Unreachable'
          }))
        }))
        const tagged = results.map(node => ({
          ...node,
          kind: id,
          fallback: config.known.includes(node.url)
        }))
        state.nodes = withHeadLag(tagged)
        this.history = recordSamples(this.history, state.nodes)
        saveNodeHistory(this.history)
        state.lastChecked = Date.now()
        if (id === 'hive' && state.beaconMap && Object.keys(state.beaconMap).length) {
          state.nodes = attachBeacon(state.nodes, state.beaconMap)
        }
        this.applyAutomaticSelection(id, state.nodes)
        if (id === 'hive' && (!state.beaconCheckedAt || Date.now() - state.beaconCheckedAt > BEACON_FULL_REFRESH_MS)) {
          this.loadBeacon()
        }
      } finally {
        state.loading = false
      }
    },
    candidateNodes (id, nodes) {
      const active = this.configuredNode(id)
      let candidates = nodes.filter(node => node.ok && (node.fallback || node.url === active))
      if (id === 'hive' && this.prefs.requireFeatures) {
        candidates = candidates.filter(node => {
          const features = node.beacon?.features || []
          return features.includes('get_account_history') && features.includes('broadcast')
        })
      }
      return candidates
    },
    applyAutomaticSelection (id, nodes) {
      const active = this.configuredNode(id)
      const fastest = pickFastestHealthy(this.candidateNodes(id, nodes))
      if (this.prefs.autoSelectFastest && fastest && fastest.url !== active) {
        this.applyNode(id, fastest, 'Auto-selected the fastest healthy ' + this.networkConfig(id).label + ' node')
        return
      }
      if (!this.prefs.autoFailover) return
      const current = nodes.find(node => node.url === active)
      if (current?.ok && (Number(current.lag) || 0) <= 3) return
      if (fastest) this.applyNode(id, fastest, 'Failover: the previous ' + this.networkConfig(id).label + ' node was unhealthy')
    },
    useNode (node) {
      if (!node?.ok) return
      this.applyNode(this.activeNetwork, node, 'Using ' + this.prettyUrl(node.url))
    },
    selectFastest () {
      const fastest = pickFastestHealthy(this.candidateNodes(this.activeNetwork, this.nodes))
      if (!fastest) {
        this.$q.notify({ type: 'warning', message: 'No healthy node is available yet.' })
        return
      }
      this.applyNode(this.activeNetwork, fastest, 'Selected the fastest healthy ' + this.activeConfig.label + ' node')
    },
    applyNode (id, node, message) {
      if (!node?.url) return
      const config = this.networkConfig(id)
      const settings = { ...(this.$hiveStore.user.settings || {}) }
      settings[config.settingsKey] = node.url
      this.$hiveStore.updateSettings(settings)
      if (id === 'hive') setHiveNode(node.url)
      this.$q.notify({ type: 'positive', message })
    },
    savePrefs () {
      saveNodePrefs(this.prefs)
    }
  }
}
</script>
