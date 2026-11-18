<template>
  <aside class="perf-panel" role="complementary" aria-label="Performance diagnostics">
    <q-card flat bordered class="home-card home-panel">
      <q-card-section class="home-panel__head perf-panel__head">
        <div>
          <div class="home-eyebrow">Developer</div>
          <h2 class="home-panel__title">Runtime status</h2>
          <div class="perf-panel__route">{{ routePath }}</div>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close performance panel" title="Close performance panel" @click="$emit('close')" />
      </q-card-section>

      <div class="perf-panel__body">
        <section class="perf-panel__section" aria-labelledby="perf-assets-title">
          <h3 id="perf-assets-title" class="perf-panel__title">Loaded assets</h3>
          <dl class="perf-panel__facts">
            <div><dt>JavaScript</dt><dd>{{ chunkSummary.js }}</dd></div>
            <div><dt>CSS</dt><dd>{{ chunkSummary.css }}</dd></div>
            <div><dt>Initial JS budget</dt><dd>{{ chunkSummary.initial }}</dd></div>
          </dl>
        </section>

        <section class="perf-panel__section" aria-labelledby="perf-cache-title">
          <h3 id="perf-cache-title" class="perf-panel__title">Read cache</h3>
          <dl class="perf-panel__facts">
            <div><dt>Hit rate</dt><dd>{{ cache.hitRate === null ? '—' : cache.hitRate + '%' }}</dd></div>
            <div><dt>Hits / misses</dt><dd>{{ cache.hits }} / {{ cache.misses }}</dd></div>
            <div><dt>Stale hits</dt><dd>{{ cache.staleHits }}</dd></div>
          </dl>
        </section>

        <section class="perf-panel__section" aria-labelledby="perf-api-title">
          <h3 id="perf-api-title" class="perf-panel__title">API client</h3>
          <dl class="perf-panel__facts">
            <div><dt>Requests</dt><dd>{{ requests.total }} · {{ requests.successRate === null ? '—' : requests.successRate + '%' }} ok</dd></div>
            <div><dt>Latency p50 / p95</dt><dd>{{ latency.p50 === null ? '—' : latency.p50 + ' / ' + latency.p95 + ' ms' }}</dd></div>
            <div><dt>Retries / failovers</dt><dd>{{ attempts.retries }} / {{ attempts.failovers }}</dd></div>
            <div><dt>Timeouts / aborts</dt><dd>{{ attempts.timeouts }} / {{ requests.aborted }}</dd></div>
          </dl>
        </section>

        <section class="perf-panel__section" aria-labelledby="perf-nodes-title">
          <h3 id="perf-nodes-title" class="perf-panel__title">API nodes</h3>
          <ul class="perf-panel__nodes">
            <li v-for="node in nodes" :key="node.url" :class="{ 'is-active': node.active, 'is-cooling': node.coolingDown }">
              <span class="perf-panel__node-url">{{ prettyUrl(node.url) }}</span>
              <span class="perf-panel__node-meta">
                <span v-if="node.active" class="perf-panel__chip">active</span>
                <span v-if="node.coolingDown" class="perf-panel__chip perf-panel__chip--warn">cooling</span>
                <span v-if="node.lastLatency !== null">{{ Math.round(node.lastLatency) }} ms</span>
                <span v-else>—</span>
                <span v-if="node.consecutiveFailures">{{ node.consecutiveFailures }} fail</span>
              </span>
            </li>
          </ul>
        </section>

        <details class="perf-panel__chunks">
          <summary>Largest loaded chunks</summary>
          <ol>
            <li v-for="chunk in chunks" :key="chunk.url">
              <span>{{ chunk.name }}</span>
              <span>{{ chunk.kb }} KB</span>
            </li>
          </ol>
        </details>

        <div class="perf-panel__foot">
          <span>Updates every 2s · <code>?perf=1</code></span>
          <span v-if="updatedAt">{{ updatedLabel }}</span>
        </div>
      </div>
    </q-card>
  </aside>
</template>

<script>
import moment from 'src/utils/time'
import { getTelemetrySnapshot } from 'src/services/telemetry'
import { getApiNodeHealth } from 'src/services/api'

function bytesToKb (value) {
  const bytes = Number(value) || 0
  return Math.round(bytes / 102.4) / 10
}

export default {
  name: 'PerfPanel',
  emits: ['close'],
  data () {
    return {
      snapshot: getTelemetrySnapshot(),
      nodes: getApiNodeHealth(),
      resources: [],
      updatedAt: null,
      timer: null
    }
  },
  computed: {
    routePath () {
      return this.$route.fullPath
    },
    requests () {
      return this.snapshot.requests
    },
    attempts () {
      return this.snapshot.attempts
    },
    latency () {
      return this.snapshot.latency
    },
    cache () {
      return this.snapshot.cache
    },
    chunks () {
      return this.resources
        .filter(entry => /\.js(\?|$)/.test(entry.url))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 8)
        .map(entry => ({
          url: entry.name,
          name: entry.name,
          kb: bytesToKb(entry.bytes)
        }))
    },
    chunkSummary () {
      const js = this.resources.filter(entry => /\.js(\?|$)/.test(entry.url))
      const css = this.resources.filter(entry => /\.css(\?|$)/.test(entry.url))
      const jsBytes = js.reduce((sum, entry) => sum + entry.bytes, 0)
      const cssBytes = css.reduce((sum, entry) => sum + entry.bytes, 0)
      return {
        js: js.length + ' chunks · ' + bytesToKb(jsBytes).toFixed(1) + ' KB',
        css: css.length + ' files · ' + bytesToKb(cssBytes).toFixed(1) + ' KB',
        initial: '≤ 345 KB (encoded)'
      }
    },
    updatedLabel () {
      return this.updatedAt ? moment.utc(this.updatedAt).fromNow() : ''
    }
  },
  mounted () {
    this.refresh()
    this.timer = setInterval(() => this.refresh(), 2000)
  },
  beforeUnmount () {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },
  methods: {
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    refresh () {
      if (typeof performance === 'undefined') return
      this.snapshot = getTelemetrySnapshot()
      this.nodes = getApiNodeHealth()
      this.resources = performance.getEntriesByType('resource').map(entry => {
        const url = new URL(entry.name, window.location.href)
        const name = url.pathname.split('/').pop() || url.pathname
        return {
          url: entry.name,
          name,
          bytes: entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0
        }
      })
      this.updatedAt = Date.now()
    }
  }
}
</script>

<style scoped>
.perf-panel {
  position: fixed;
  right: var(--space-3);
  bottom: var(--space-3);
  z-index: 2400;
  width: min(390px, calc(100vw - 1rem));
}

.perf-panel :deep(.home-panel) {
  max-height: min(78vh, 760px);
  overflow: auto;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
}

.perf-panel__head {
  align-items: flex-start;
}

.perf-panel__route {
  max-width: 280px;
  overflow: hidden;
  color: #78909c;
  font-family: monospace;
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perf-panel__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 var(--space-4) var(--space-4);
}

.perf-panel__section {
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
}

.perf-panel__title {
  margin: 0 0 0.35rem;
  color: #90a4ae;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.perf-panel__facts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.22rem 0.7rem;
  margin: 0;
  font-size: 0.74rem;
}

.perf-panel__facts div {
  display: contents;
}

.perf-panel__facts dt {
  color: #78909c;
}

.perf-panel__facts dd {
  margin: 0;
  color: #e4eaed;
  font-family: monospace;
  text-align: right;
}

.perf-panel__nodes {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.perf-panel__nodes li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
  color: #90a4ae;
  font-size: 0.72rem;
}

.perf-panel__nodes li.is-active {
  color: #81d4fa;
}

.perf-panel__nodes li.is-cooling {
  color: #ffb74d;
}

.perf-panel__node-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perf-panel__node-meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  font-family: monospace;
}

.perf-panel__chip {
  padding: 0.02rem 0.28rem;
  border: 1px solid rgba(79, 195, 247, 0.4);
  border-radius: var(--radius-pill);
  color: #81d4fa;
  font-size: 0.62rem;
}

.perf-panel__chip--warn {
  border-color: rgba(255, 183, 77, 0.45);
  color: #ffcc80;
}

.perf-panel__chunks summary {
  color: #90a4ae;
  cursor: pointer;
  font-size: 0.72rem;
}

.perf-panel__chunks ol {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  color: #90a4ae;
  font-family: monospace;
  font-size: 0.68rem;
}

.perf-panel__chunks li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.perf-panel__chunks li span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perf-panel__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
  color: #90a4ae;
  font-size: 0.66rem;
}

.perf-panel__foot code {
  color: #81d4fa;
}

@media (max-width: 599px) {
  .perf-panel {
    right: var(--space-2);
    bottom: var(--space-2);
  }
}
</style>
