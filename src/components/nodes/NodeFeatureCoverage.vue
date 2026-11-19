<template>
  <q-card flat bordered class="node-features">
    <q-card-section class="node-features__body">
      <div class="node-features__intro">
        <div>
          <p class="node-features__hint">
            Features each node advertises to the beacon monitor. A node without account history
            still serves blocks and account lookups, so pick one that covers what you use.
          </p>
        </div>
        <span class="net-chip">{{ nodes.length }} node{{ nodes.length === 1 ? '' : 's' }} scored</span>
      </div>

      <ul v-if="matrix.length" class="node-features__list">
        <li v-for="feature in matrix" :key="feature.key" class="node-features__item">
          <div class="node-features__head">
            <span class="node-features__label">{{ feature.label }}</span>
            <span class="node-features__count" :class="'is-' + coverage(feature)">{{ coverageLabel(feature) }}</span>
          </div>
          <div class="node-features__bar" role="presentation">
            <span class="node-features__fill" :class="'is-' + coverage(feature)" :style="{ width: percentFor(feature) + '%' }"></span>
          </div>
          <div class="node-features__hosts">
            <span
              v-for="endpoint in feature.nodes"
              :key="endpoint"
              class="node-features__host"
              :class="{ 'is-active': endpoint === activeNode }"
            >{{ prettyUrl(endpoint) }}</span>
            <span v-if="!feature.nodes.length" class="node-features__host is-muted">none</span>
          </div>
        </li>
      </ul>

      <div v-else class="node-features__empty">
        <q-icon name="cloud_off" size="1.5em" color="grey" aria-hidden="true" />
        <div>Feature data is unavailable right now. Browser probes above still work.</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.node-features {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.028);
}

.node-features__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.node-features__intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.node-features__hint {
  max-width: 640px;
  margin: 0;
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.5;
}

.node-features__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.node-features__item {
  min-width: 0;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02);
}

.node-features__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.node-features__label {
  color: #cfd8dc;
  font-size: 0.8rem;
  font-weight: 600;
}

.node-features__count {
  color: #cfd8dc;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.node-features__count.is-full {
  color: #81c784;
}

.node-features__count.is-partial {
  color: #ffb74d;
}

.node-features__count.is-low {
  color: #e57373;
}

.node-features__fill.is-full {
  background: #81c784;
}

.node-features__fill.is-partial {
  background: #ffb74d;
}

.node-features__fill.is-low {
  background: #e57373;
}

.node-features__bar {
  height: 3px;
  margin: 0.4rem 0 0.45rem;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.node-features__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.node-features__hosts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.4rem;
  color: #78909c;
  font-size: 0.66rem;
}

.node-features__host {
  overflow-wrap: anywhere;
}

.node-features__host.is-active {
  color: #4fc3f7;
  font-weight: 600;
}

.node-features__host.is-muted {
  color: #e57373;
}

.node-features__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: var(--space-4);
  color: #90a4ae;
  font-size: 0.8rem;
  text-align: center;
}
</style>

<script>
import { coverageLabel, featureCoverage } from 'src/services/network'

export default {
  name: 'NodeFeatureCoverage',
  props: {
    matrix: { type: Array, default: () => [] },
    nodes: { type: Array, default: () => [] },
    activeNode: { type: String, default: '' }
  },
  methods: {
    coverageLabel (feature) {
      return coverageLabel(feature, this.nodes.length)
    },
    percentFor (feature) {
      return Math.round(featureCoverage(this.nodes, feature.key))
    },
    coverage (feature) {
      const percent = featureCoverage(this.nodes, feature.key)
      if (percent >= 100) return 'full'
      if (percent >= 50) return 'partial'
      return 'low'
    },
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    }
  }
}
</script>
