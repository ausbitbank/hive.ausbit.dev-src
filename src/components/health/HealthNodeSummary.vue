<template>
  <q-card flat bordered class="health-node-summary">
    <q-card-section v-if="loading" class="health-node-summary__loading">
      <q-skeleton type="text" width="45%" />
      <q-skeleton type="text" width="70%" />
      <q-skeleton type="text" width="55%" />
    </q-card-section>

    <q-card-section v-else class="health-node-summary__body">
      <div class="health-node-summary__main">
        <div class="health-node-summary__status">
          <q-icon
            :name="summary.unreachableCount ? 'warning' : 'dns'"
            :color="summary.unreachableCount ? 'orange' : 'green'"
            size="20px"
            aria-hidden="true"
          />
          <div>
            <div class="health-node-summary__title">
              {{ summary.healthyCount }} of {{ summary.total }} API nodes healthy
            </div>
            <div class="health-node-summary__hint">
              Browser probes from this device; timings include your network path.
            </div>
          </div>
        </div>

        <div class="health-node-summary__stats">
          <div>
            <span>Fastest</span>
            <strong v-if="summary.fastest">{{ formatLatency(summary.fastest.latency) }}</strong>
            <strong v-else>—</strong>
            <small v-if="summary.fastest">{{ prettyUrl(summary.fastest.url) }}</small>
            <small v-else>No healthy node</small>
          </div>
          <div>
            <span>Average latency</span>
            <strong>{{ formatLatency(summary.averageLatency) }}</strong>
            <small>{{ checkedLabel }}</small>
          </div>
          <div>
            <span>Head lag</span>
            <strong>{{ summary.maxLag === null ? '—' : summary.maxLag + ' blocks' }}</strong>
            <small>Worst healthy node</small>
          </div>
          <div>
            <span>Versions</span>
            <strong>{{ versionLabel }}</strong>
            <small>{{ summary.unreachableCount }} unreachable</small>
          </div>
        </div>
      </div>

      <div class="health-node-summary__links">
        <router-link to="/nodes">Open node detail, latency history and failover</router-link>
        <q-btn flat dense no-caps icon="refresh" label="Re-check" :loading="loading" @click="load" />
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.health-node-summary {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.health-node-summary__loading {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.9rem 1rem;
}

.health-node-summary__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 0.9rem 1rem;
}

.health-node-summary__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.health-node-summary__status {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  min-width: 0;
}

.health-node-summary__title {
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.health-node-summary__hint {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.health-node-summary__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.health-node-summary__stats > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
}

.health-node-summary__stats span {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.health-node-summary__stats strong {
  color: var(--c-text);
  font-size: 0.86rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.health-node-summary__stats small {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  overflow-wrap: anywhere;
}

.health-node-summary__links {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.75rem;
  font-weight: 600;
}

.health-node-summary__links a {
  color: var(--c-link);
  text-decoration: none;
}

.health-node-summary__links a:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

@media (max-width: 799px) {
  .health-node-summary__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 399px) {
  .health-node-summary__stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import { HIVE_API_NODES } from 'src/services/hiveNodes'
import { probeHiveNodeFull } from 'src/services/hive'
import {
  formatLatency,
  summarizeNodes,
  withHeadLag
} from 'src/services/network'

export default {
  name: 'HealthNodeSummary',
  emits: ['summary'],
  data () {
    return {
      loading: true,
      nodes: [],
      checkedAt: null
    }
  },
  computed: {
    summary () {
      return summarizeNodes(this.nodes)
    },
    checkedLabel () {
      if (!this.checkedAt) return 'Not checked yet'
      return 'Checked ' + new Date(this.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    versionLabel () {
      if (!this.summary.versions.length) return '—'
      return this.summary.versions
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map(item => 'v' + item.version + ' ×' + item.count)
        .join(' · ')
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    formatLatency,
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    async load () {
      this.loading = true
      try {
        const active = this.$hiveStore.user.settings.apiNode || HIVE_API_NODES[0]
        const urls = [...new Set([active, ...HIVE_API_NODES].filter(Boolean))]
        const results = await Promise.all(urls.map(url => probeHiveNodeFull(url)))
        this.nodes = withHeadLag(results)
        this.checkedAt = Date.now()
        this.$emit('summary', this.summary)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
