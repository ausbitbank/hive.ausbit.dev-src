<template>
  <div class="node-compare">
    <div class="node-compare__scroll">
      <table class="node-compare__table">
        <caption class="node-compare__caption">
          Browser probe results from this device, beacon reliability and advertised API features.
        </caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Status</th>
            <th scope="col">Typical</th>
            <th scope="col">Now</th>
            <th scope="col">Type</th>
            <th scope="col">Head</th>
            <th scope="col">Head age</th>
            <th scope="col">Version</th>
            <th scope="col">Beacon</th>
            <th scope="col">Uptime</th>
            <th scope="col">Apps</th>
            <th scope="col">Features</th>
            <th scope="col"><span class="node-compare__sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="node in nodes"
            :key="node.url"
            :class="[
              'node-compare__row',
              'node-compare__row--' + statusFor(node).key,
              { 'is-active': node.url === activeNode }
            ]"
          >
            <th scope="row" class="node-compare__name">
              <span class="node-compare__host">{{ prettyUrl(node.url) }}</span>
              <span class="node-compare__tags">
                <q-badge v-if="node.fallback" color="blue-grey-8" text-color="white">fallback</q-badge>
                <q-badge v-else color="grey-9" text-color="white">watch</q-badge>
                <q-badge v-if="isPartialFeature(node)" color="orange-9" text-color="black" title="Limited API surface">partial</q-badge>
              </span>
            </th>
            <td>
              <span class="node-compare__status" :class="'is-' + statusFor(node).key">
                {{ statusFor(node).label }}
              </span>
            </td>
            <td class="num">{{ formatLatency(typicalFor(node)) }}</td>
            <td class="num">{{ node.ok ? formatLatency(node.latency) : '—' }}</td>
            <td>{{ node.nodeType || '—' }}</td>
            <td class="num">{{ node.ok ? formatCount(node.head) : '—' }}</td>
            <td class="num">{{ node.ok ? formatHeadAge(headAge(node.headTime)) : '—' }}</td>
            <td>
              <q-badge
                v-if="node.version"
                :color="versionState(node) === 'mismatch' ? 'orange-9' : 'green-9'"
                :text-color="versionState(node) === 'mismatch' ? 'black' : 'white'"
                :title="versionState(node) === 'mismatch' ? 'Differs from the expected network version' : 'Matches the expected network version'"
              >
                v{{ node.version }}
              </q-badge>
              <span v-else class="node-compare__muted">{{ node.versionMissing ? 'n/a' : '—' }}</span>
            </td>
            <td>
              <span v-if="node.beacon" class="node-compare__score" :class="'is-' + beaconStatusFor(node).key">
                {{ node.beacon.score }}<small>/100</small>
              </span>
              <span v-else class="node-compare__muted">—</span>
            </td>
            <td class="num">{{ node.beacon ? formatPercent(node.beacon.uptime) : '—' }}</td>
            <td class="num">{{ node.beacon ? formatApps(node.beacon) : '—' }}</td>
            <td class="node-compare__features">
              <template v-if="node.beacon">
                <span
                  v-for="feature in node.beacon.features"
                  :key="feature"
                  class="node-compare__feature"
                  :title="featureLabel(feature)"
                >{{ featureLabel(feature) }}</span>
                <span v-if="!node.beacon.features.length" class="node-compare__muted">none</span>
              </template>
              <span v-else class="node-compare__muted">—</span>
            </td>
            <td class="node-compare__actions">
              <q-btn
                v-if="node.url !== activeNode"
                flat
                dense
                no-caps
                color="primary"
                label="Use"
                :disable="!node.ok"
                :aria-label="'Use ' + prettyUrl(node.url) + ' as the API node'"
                @click="$emit('use', node)"
              />
              <q-icon v-else name="star" color="primary" size="16px" aria-label="Active node" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.node-compare__scroll {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.018);
}

.node-compare__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 960px;
  color: #cfd8dc;
  font-size: 0.78rem;
}

.node-compare__caption {
  caption-side: top;
  padding: 0.6rem 0.9rem;
  color: #78909c;
  font-size: 0.7rem;
  text-align: left;
}

.node-compare__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.45rem 0.55rem;
  background: #141a1f;
  color: #90a4ae;
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.node-compare__row th,
.node-compare__row td {
  padding: 0.5rem 0.55rem;
  border-top: 1px solid var(--border-subtle);
  vertical-align: top;
}

.node-compare__row--offline {
  box-shadow: inset 3px 0 0 rgba(239, 83, 80, 0.75);
}

.node-compare__row--behind {
  box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.7);
}

.node-compare__row.is-active {
  background: rgba(79, 195, 247, 0.06);
}

.node-compare__name {
  font-weight: 400;
  text-align: left;
}

.node-compare__host {
  display: block;
  color: #e4eaed;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.node-compare__tags {
  display: inline-flex;
  gap: 0.25rem;
  margin-top: 0.2rem;
}

.node-compare__tags :deep(.q-badge) {
  font-size: 0.55rem;
}

.node-compare__status {
  font-weight: 600;
  white-space: nowrap;
}

.node-compare__status.is-ok {
  color: #81c784;
}

.node-compare__status.is-behind {
  color: #ffb74d;
}

.node-compare__status.is-offline {
  color: #e57373;
}

.node-compare__status.is-unknown {
  color: #90a4ae;
}

.node-compare__row .num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.node-compare__muted {
  color: #78909c;
}

.node-compare__score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.node-compare__score small {
  color: #78909c;
  font-weight: 400;
}

.node-compare__score.is-ok {
  color: #81c784;
}

.node-compare__score.is-watch {
  color: #ffd54f;
}

.node-compare__score.is-warning {
  color: #ffb74d;
}

.node-compare__score.is-critical {
  color: #e57373;
}

.node-compare__features {
  min-width: 150px;
  max-width: 240px;
}

.node-compare__feature {
  display: inline-block;
  margin: 0 0.2rem 0.2rem 0;
  padding: 0.05rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: #b0bec5;
  font-size: 0.62rem;
  white-space: nowrap;
}

.node-compare__actions {
  text-align: right;
}

.node-compare__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

<script>
import {
  beaconStatus,
  formatCount,
  formatHeadAge,
  formatLatency,
  formatPercent,
  featureLabel,
  headAge,
  nodeStatus,
  versionStatus
} from 'src/services/network'
import { PARTIAL_FEATURE_NODES } from 'src/services/hiveNodes'

export default {
  name: 'NodeCompareTable',
  props: {
    nodes: { type: Array, default: () => [] },
    activeNode: { type: String, default: '' },
    expectedVersion: { type: String, default: '' },
    typicalFor: { type: Function, default: node => node?.latency }
  },
  emits: ['use'],
  methods: {
    formatLatency,
    formatCount,
    formatPercent,
    formatHeadAge,
    featureLabel,
    headAge,
    statusFor (node) {
      return nodeStatus(node)
    },
    beaconStatusFor (node) {
      return beaconStatus(node.beacon)
    },
    versionState (node) {
      return versionStatus(node.version, this.expectedVersion)
    },
    isPartialFeature (node) {
      return PARTIAL_FEATURE_NODES.includes(node.url)
    },
    formatApps (beacon) {
      const total = Number(beacon.appsSuccess) + Number(beacon.appsFail)
      if (!total) return '—'
      return beacon.appsSuccess + '/' + total
    },
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    }
  }
}
</script>
