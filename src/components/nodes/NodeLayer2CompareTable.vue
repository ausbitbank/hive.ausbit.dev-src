<template>
  <div class="layer2-compare">
    <div class="layer2-compare__scroll">
      <table class="layer2-compare__table">
        <caption class="layer2-compare__caption">
          Browser probes from this device. Layer-2 heads are compared within their own network.
        </caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Status</th>
            <th scope="col">Typical</th>
            <th scope="col">Now</th>
            <th scope="col">Head</th>
            <th v-if="network === 'hiveEngine'" scope="col">Hive block</th>
            <th scope="col">Version</th>
            <th scope="col">{{ network === 'magi' ? 'Epoch' : 'Chain' }}</th>
            <th scope="col">Details</th>
            <th scope="col"><span class="layer2-compare__sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="node in nodes"
            :key="node.url"
            :class="[
              'layer2-compare__row',
              'layer2-compare__row--' + statusFor(node).key,
              { 'is-active': node.url === activeNode }
            ]"
          >
            <th scope="row" class="layer2-compare__name">
              <span class="layer2-compare__host">{{ prettyUrl(node.url) }}</span>
              <span class="layer2-compare__tags">
                <q-badge v-if="node.fallback" color="blue-grey-8" text-color="white">auto</q-badge>
                <q-badge v-else color="grey-9" text-color="white">watch</q-badge>
              </span>
            </th>
            <td>
              <span class="layer2-compare__status" :class="'is-' + statusFor(node).key">
                {{ statusFor(node).label }}
              </span>
            </td>
            <td class="num">{{ formatLatency(typicalFor(node)) }}</td>
            <td class="num">{{ node.ok ? formatLatency(node.latency) : '—' }}</td>
            <td class="num">{{ node.ok ? formatCount(node.head) : '—' }}</td>
            <td v-if="network === 'hiveEngine'" class="num">{{ node.hiveHead ? formatCount(node.hiveHead) : '—' }}</td>
            <td>
              <q-badge
                v-if="node.version"
                :color="versionState(node) === 'mismatch' ? 'orange-9' : 'green-9'"
                :text-color="versionState(node) === 'mismatch' ? 'black' : 'white'"
                :title="versionState(node) === 'mismatch' ? 'Differs from the most common network version' : 'Matches the most common network version'"
              >
                {{ node.version }}
              </q-badge>
              <span v-else class="layer2-compare__muted">—</span>
            </td>
            <td>
              <span v-if="network === 'magi'">{{ node.epoch ? formatCount(node.epoch) : '—' }}</span>
              <span v-else>{{ node.chainId || '—' }}</span>
            </td>
            <td class="layer2-compare__details">
              <span v-for="detail in detailsFor(node)" :key="detail" class="layer2-compare__detail">{{ detail }}</span>
              <span v-if="!detailsFor(node).length" class="layer2-compare__muted">—</span>
            </td>
            <td class="layer2-compare__actions">
              <q-btn
                v-if="node.url !== activeNode"
                flat
                dense
                no-caps
                color="primary"
                label="Use"
                :disable="!node.ok"
                :aria-label="'Use ' + prettyUrl(node.url) + ' as the active node'"
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
.layer2-compare__scroll {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.layer2-compare__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
  color: var(--c-text-soft);
  font-size: 0.78rem;
}

.layer2-compare__caption {
  caption-side: top;
  padding: 0.6rem 0.9rem;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  text-align: left;
}

.layer2-compare__table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.45rem 0.55rem;
  background: var(--c-surface-3);
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.layer2-compare__row th,
.layer2-compare__row td {
  padding: 0.5rem 0.55rem;
  border-top: 1px solid var(--border-subtle);
  vertical-align: top;
}

.layer2-compare__row--offline {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--c-negative) 75%, transparent);
}

.layer2-compare__row--behind {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--c-warning) 70%, transparent);
}

.layer2-compare__row.is-active {
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
}

.layer2-compare__name {
  font-weight: 400;
  text-align: left;
}

.layer2-compare__host {
  display: block;
  color: var(--c-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.layer2-compare__tags {
  display: inline-flex;
  gap: 0.25rem;
  margin-top: 0.2rem;
}

.layer2-compare__tags :deep(.q-badge) {
  font-size: 0.55rem;
}

.layer2-compare__status {
  font-weight: 600;
  white-space: nowrap;
}

.layer2-compare__status.is-ok {
  color: var(--c-positive);
}

.layer2-compare__status.is-behind {
  color: var(--c-warning);
}

.layer2-compare__status.is-offline {
  color: var(--c-negative);
}

.layer2-compare__status.is-unknown {
  color: var(--c-text-subtle);
}

.layer2-compare__row .num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.layer2-compare__muted {
  color: var(--c-text-faint);
}

.layer2-compare__details {
  min-width: 180px;
  max-width: 280px;
}

.layer2-compare__detail {
  display: inline-block;
  margin: 0 0.2rem 0.2rem 0;
  padding: 0.05rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-muted);
  font-size: 0.62rem;
  white-space: nowrap;
}

.layer2-compare__actions {
  text-align: right;
}

.layer2-compare__sr {
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
import { formatCount, formatLatency, nodeStatus, versionStatus } from 'src/services/network'

export default {
  name: 'NodeLayer2CompareTable',
  props: {
    network: { type: String, default: 'hiveEngine' },
    nodes: { type: Array, default: () => [] },
    activeNode: { type: String, default: '' },
    expectedVersion: { type: String, default: '' },
    typicalFor: { type: Function, default: node => node?.latency }
  },
  emits: ['use'],
  methods: {
    formatLatency,
    formatCount,
    statusFor (node) {
      return nodeStatus(node)
    },
    versionState (node) {
      return versionStatus(node.version, this.expectedVersion)
    },
    detailsFor (node) {
      if (!node?.ok) return []
      if (this.network === 'magi') {
        return [
          node.consensusVersion ? 'consensus ' + node.consensusVersion : '',
          node.processingSuspended ? 'suspended' : '',
          node.gitCommit ? 'commit ' + String(node.gitCommit).slice(0, 8) : ''
        ].filter(Boolean)
      }
      const disabled = Object.values(node.disabledMethods || {})
        .reduce((total, methods) => total + (Array.isArray(methods) ? methods.length : 0), 0)
      return [
        node.lightNode ? 'light node' : '',
        disabled ? disabled + ' disabled method' + (disabled === 1 ? '' : 's') : 'all methods',
        node.lastVerifiedBlock ? 'verified ' + formatCount(node.lastVerifiedBlock) : ''
      ].filter(Boolean)
    },
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    }
  }
}
</script>
