<template>
  <li class="node-row" :class="'node-row--' + status.key">
    <div class="node-row__status">
      <q-icon
        :name="status.key === 'offline' ? 'error' : (status.key === 'behind' ? 'warning' : 'check_circle')"
        :color="status.color"
        size="20px"
        :aria-label="status.label"
      />
    </div>

    <div class="node-row__body">
      <div class="node-row__title">
        <span class="node-row__url">{{ prettyUrl }}</span>
        <q-badge v-if="active" color="primary" text-color="black" class="node-row__badge">Active</q-badge>
        <q-badge :color="status.color === 'green' ? 'green-9' : (status.color === 'warning' ? 'orange-9' : 'red-9')" :text-color="status.color === 'warning' ? 'black' : 'white'" class="node-row__badge">
          {{ status.label }}
        </q-badge>
        <q-badge
          v-if="node.version"
          :color="versionState === 'mismatch' ? 'orange-9' : 'green-9'"
          :text-color="versionState === 'mismatch' ? 'black' : 'white'"
          class="node-row__badge"
          :title="versionState === 'mismatch' ? 'Node version differs from the network version' : 'Node version matches the network version'"
        >
          v{{ node.version }}
        </q-badge>
        <q-badge v-if="!node.fallback" color="grey-9" text-color="white" class="node-row__badge" title="Not used as an automatic failover node">
          watch
        </q-badge>
        <q-badge
          v-if="node.beacon"
          :color="beaconState.key === 'ok' ? 'green-9' : (beaconState.key === 'critical' ? 'red-9' : 'orange-9')"
          :text-color="beaconState.key === 'warning' || beaconState.key === 'watch' ? 'black' : 'white'"
          class="node-row__badge"
          :title="'Beacon reliability score: ' + node.beacon.score + '/100 (' + beaconState.label + ')'"
        >
          beacon {{ node.beacon.score }}
        </q-badge>
      </div>

      <div class="node-row__meta">
        <span v-if="node.ok">
          <q-icon name="bolt" size="14px" aria-hidden="true" />
          {{ formatLatency(node.latency) }} now
        </span>
        <span v-if="node.ok && typical !== null">
          {{ formatLatency(typical) }} typical
        </span>
        <span v-if="node.ok && summary.average !== null">
          {{ formatLatency(summary.average) }} avg
        </span>
        <span v-if="node.ok">
          <q-icon name="view_stream" size="14px" aria-hidden="true" />
          head {{ formatCount(node.head) }}
        </span>
        <span v-if="node.ok" :class="{ 'node-row__lag': node.lag > 0 }">
          {{ node.lag > 0 ? node.lag + ' blocks behind' : 'at chain head' }}
        </span>
        <span v-if="node.ok && features.length" class="node-row__features">
          <q-icon name="extension" size="14px" aria-hidden="true" />
          {{ features.length }} API feature{{ features.length === 1 ? '' : 's' }}
        </span>
        <span v-if="node.beacon" class="node-row__uptime">
          {{ formatPercent(node.beacon.uptime) }} uptime
        </span>
        <span v-if="!node.ok" class="node-row__error">{{ node.error || 'Unreachable' }}</span>
      </div>

      <div v-if="node.ok" class="node-row__history">
        <Sparkline
          v-if="summary.values.length > 1"
          :data="summary.values"
          :width="120"
          :height="26"
          :stroke="status.key === 'ok' ? '#81c784' : '#ffb74d'"
          fill="rgba(129, 199, 132, 0.12)"
          class="node-row__spark"
        />
        <span class="node-row__samples">
          {{ summary.values.length }} latency sample{{ summary.values.length === 1 ? '' : 's' }}
          <template v-if="summary.min !== null"> · {{ formatLatency(summary.min) }}–{{ formatLatency(summary.max) }}</template>
          <template v-if="summary.trend !== null"> · {{ summary.trend <= 0 ? 'improving' : 'slower' }}</template>
        </span>
      </div>
    </div>

    <div class="node-row__actions">
      <q-btn
        v-if="!active"
        dense
        no-caps
        outline
        color="primary"
        icon="check"
        label="Use node"
        :disable="!node.ok"
        :aria-label="'Use ' + prettyUrl + ' as the API node'"
        @click="$emit('use', node)"
      />
      <span v-else class="net-chip net-chip--ok">
        <q-icon name="star" size="14px" aria-hidden="true" />
        In use
      </span>
    </div>
  </li>
</template>

<style scoped>
.node-row {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.55rem;
  padding: 0.75rem 0.9rem;
  border-top: 1px solid var(--border-subtle);
}

.node-row:first-child {
  border-top: 0;
}

.node-row--offline {
  box-shadow: inset 3px 0 0 rgba(239, 83, 80, 0.75);
}

.node-row--behind {
  box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.7);
}

.node-row__status {
  padding-top: 0.15rem;
}

.node-row__body {
  min-width: 0;
}

.node-row__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.node-row__url {
  color: #e4eaed;
  font-size: 0.86rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.node-row__badge {
  font-size: 0.58rem;
}

.node-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.7rem;
  margin-top: 0.1rem;
  color: #90a4ae;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.node-row__meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.node-row__lag {
  color: #ffb74d;
}

.node-row__error {
  color: #ef9a9a;
}

.node-row__uptime,
.node-row__features {
  color: #78909c;
}

.node-row__history {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  color: #78909c;
  font-size: 0.67rem;
}

.node-row__spark {
  flex: none;
}

.node-row__samples {
  overflow-wrap: anywhere;
}

.node-row__actions {
  display: flex;
  align-items: center;
  padding-top: 0.05rem;
}

@media (max-width: 599px) {
  .node-row {
    grid-template-columns: 1.3rem minmax(0, 1fr);
    gap: 0.45rem;
    padding: 0.65rem 0.7rem;
  }

  .node-row__actions {
    grid-column: 2;
    padding-top: 0.2rem;
  }

  .node-row__history {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.15rem;
  }
}
</style>

<script>
import Sparkline from 'components/Sparkline.vue'
import { latencySummary } from 'src/services/nodeHistory'
import {
  beaconStatus,
  formatCount,
  formatLatency,
  formatPercent,
  nodeStatus,
  versionStatus
} from 'src/services/network'

export default {
  name: 'NodeStatusRow',
  components: { Sparkline },
  props: {
    node: { type: Object, required: true },
    active: { type: Boolean, default: false },
    expectedVersion: { type: String, default: '' },
    samples: { type: Array, default: () => [] }
  },
  emits: ['use'],
  computed: {
    status () {
      return nodeStatus(this.node)
    },
    versionState () {
      return versionStatus(this.node.version, this.expectedVersion)
    },
    beaconState () {
      return beaconStatus(this.node.beacon)
    },
    features () {
      return Array.isArray(this.node.beacon?.features) ? this.node.beacon.features : []
    },
    typical () {
      const summary = this.summary
      return summary.values.length ? summary.average : null
    },
    prettyUrl () {
      return String(this.node.url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    summary () {
      return latencySummary({ [this.node.url]: this.samples }, this.node.url)
    }
  },
  methods: {
    formatLatency,
    formatCount,
    formatPercent
  }
}
</script>
