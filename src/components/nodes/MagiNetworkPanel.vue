<template>
  <div class="magi-panel">
    <q-card flat bordered class="magi-panel__card">
      <q-card-section class="magi-panel__head">
        <div>
          <div class="magi-panel__eyebrow">Magi network</div>
          <h3 class="magi-panel__title">Consensus and registered witnesses</h3>
          <p class="magi-panel__hint">
            Read from the active Magi GraphQL node. Witness registrations are sampled at the
            node's last processed Hive block.
          </p>
        </div>
        <div class="magi-panel__actions">
          <q-btn flat dense round icon="refresh" aria-label="Refresh Magi witnesses" title="Refresh Magi witnesses" :loading="loading" @click="load(true)" />
          <q-btn flat dense no-caps icon="code" label="Magi contracts" to="/magi" />
        </div>
      </q-card-section>

      <div v-if="node" class="magi-panel__stats">
        <div>
          <span>Epoch</span>
          <strong>{{ node.epoch ? formatCount(node.epoch) : '—' }}</strong>
        </div>
        <div>
          <span>Consensus</span>
          <strong>{{ node.consensusVersion || '—' }}</strong>
          <small>{{ node.consensusLine || 'line unavailable' }}</small>
        </div>
        <div>
          <span>Last processed</span>
          <strong>{{ formatCount(node.head) }}</strong>
          <small>Hive block height</small>
        </div>
        <div>
          <span>Processing</span>
          <strong :class="node.processingSuspended ? 'is-warn' : 'is-ok'">
            {{ node.processingSuspended ? 'Suspended' : 'Running' }}
          </strong>
          <small>{{ node.version ? 'node ' + node.version : 'version unavailable' }}</small>
        </div>
      </div>

      <q-banner v-if="error" rounded class="magi-panel__banner">
        <template #avatar><q-icon name="cloud_off" aria-hidden="true" /></template>
        {{ error }}
        <template #action><q-btn flat no-caps color="primary" label="Retry" @click="load(true)" /></template>
      </q-banner>

      <data-table
        :columns="columns"
        :rows="witnessRows"
        row-key="account"
        caption="Registered Magi witnesses"
        :loading="loading || (!nodeReady && checking)"
        empty-icon="how_to_vote"
        :empty-message="nodeReady
          ? 'No Magi witnesses were returned for this block height.'
          : (checking ? 'Probing Magi nodes for witnesses…' : 'No Magi node is available to read witnesses from.')"
      >
        <template #cell-account="{ value }">{{ value }}</template>
        <template #cell-enabled="{ row }">
          <q-badge :color="row.enabled ? 'green-9' : 'grey-8'" text-color="white">
            {{ row.enabled ? 'enabled' : 'disabled' }}
          </q-badge>
        </template>
        <template #cell-delegation="{ row }">
          <span class="magi-panel__muted">{{ row.delegationMode || '—' }}</span>
        </template>
        <template #cell-version="{ row }">
          <span class="magi-panel__version">{{ row.versionId || '—' }}</span>
          <small v-if="row.gitCommit" class="magi-panel__muted">{{ row.gitCommit.slice(0, 8) }}</small>
        </template>
        <template #cell-height="{ value }">{{ formatCount(value) }}</template>
        <template #cell-peer="{ row }">
          <span class="magi-panel__peer" :title="row.peerId">{{ shortPeer(row.peerId) }}</span>
        </template>
        <template #footer>
          <div class="magi-panel__footer">
            <span>{{ witnessRows.length }} registered witness{{ witnessRows.length === 1 ? '' : 'es' }}<span v-if="node?.url"> · {{ prettyUrl(node.url) }}</span></span>
            <router-link to="/witnesses" class="magi-panel__link">Hive witnesses</router-link>
          </div>
        </template>
      </data-table>
    </q-card>
  </div>
</template>

<style scoped>
.magi-panel__card {
  overflow: hidden;
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.magi-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.magi-panel__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.magi-panel__title {
  margin: 0.2rem 0 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.magi-panel__hint {
  max-width: 70ch;
  margin: 0.25rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.75rem;
  line-height: 1.45;
}

.magi-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.magi-panel__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0 0.9rem 0.8rem;
}

.magi-panel__stats > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.magi-panel__stats span {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.magi-panel__stats strong {
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.magi-panel__stats strong.is-ok {
  color: var(--c-positive);
}

.magi-panel__stats strong.is-warn {
  color: var(--c-warning);
}

.magi-panel__stats small {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  overflow-wrap: anywhere;
}

.magi-panel__banner {
  margin: 0 0.9rem 0.8rem;
}

.magi-panel__muted {
  color: var(--c-text-faint);
}

.magi-panel__version {
  display: block;
  color: var(--c-text-soft);
  font-size: 0.72rem;
}

.magi-panel__peer {
  color: var(--c-text-muted);
  font-family: monospace;
  font-size: 0.68rem;
}

.magi-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.magi-panel__link {
  color: var(--c-link);
  font-weight: 600;
  text-decoration: none;
}

.magi-panel__link:hover {
  text-decoration: underline;
}

@media (max-width: 799px) {
  .magi-panel__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 399px) {
  .magi-panel__stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import DataTable from 'components/ui/DataTable.vue'
import { formatCount } from 'src/services/network'
import { fetchMagiWitnesses } from 'src/services/magi'

export default {
  name: 'MagiNetworkPanel',
  components: { DataTable },
  props: {
    node: { type: Object, default: null },
    nodes: { type: Array, default: () => [] },
    checking: { type: Boolean, default: false }
  },
  data () {
    return {
      witnesses: [],
      loading: false,
      error: ''
    }
  },
  computed: {
    nodeReady () {
      return Boolean(this.node?.url && this.node?.head)
    },
    witnessRows () {
      return this.witnesses
        .slice()
        .sort((a, b) => Number(b.height) - Number(a.height))
    },
    columns () {
      return [
        { key: 'account', label: 'Witness' },
        { key: 'enabled', label: 'State' },
        { key: 'delegation', label: 'Delegation' },
        { key: 'version', label: 'Version' },
        { key: 'height', label: 'Height', align: 'right' },
        { key: 'peer', label: 'Peer' }
      ]
    }
  },
  watch: {
    'node.url' () {
      this.load()
    },
    'node.head' () {
      this.load()
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    formatCount,
    prettyUrl (url) {
      return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    shortPeer (peerId) {
      const value = String(peerId || '')
      return value ? value.slice(0, 10) + '…' + value.slice(-6) : '—'
    },
    async load (force = false) {
      if (!this.nodeReady) {
        this.witnesses = []
        this.error = ''
        return
      }
      if (this.loading) return
      this.loading = true
      this.error = ''
      try {
        this.witnesses = await fetchMagiWitnesses(this.node.head, {
          endpoint: this.node.url,
          force
        })
      } catch {
        this.witnesses = []
        this.error = 'Magi witness data is unavailable from this node.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
