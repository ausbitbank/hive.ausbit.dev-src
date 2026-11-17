<template>
  <q-card flat bordered style="max-width: 560px" class="q-ma-sm">
    <q-card-section class="text-center">
      <div class="text-h5"><q-icon name="dns" color="blue-grey" /> Hive API Nodes</div>
      <div class="text-caption">Live health check from this browser. Click a node to use it.</div>
    </q-card-section>

    <q-list separator dense>
      <q-item v-for="node in sortedNodes" :key="node.url" clickable @click="useNode(node)">
        <q-item-section avatar>
          <q-icon :name="node.ok ? 'check_circle' : 'error'" :color="node.ok ? 'green' : 'red'" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ prettyUrl(node.url) }}
            <q-icon name="star" color="orange" v-if="node.url === activeNode" title="Active API node" />
          </q-item-label>
          <q-item-label caption>
            <template v-if="node.ok">
              {{ node.latency }} ms · head {{ tidyNumber(node.head) }}
              <span v-if="node.lag > 0" class="text-orange"> · {{ node.lag }} behind</span>
              <span v-if="node.version"> · v{{ node.version }}</span>
            </template>
            <span v-else class="text-red">{{ node.error }}</span>
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn dense flat round icon="refresh" :loading="loading" @click.stop="checkAll" title="Re-check all nodes" aria-label="Re-check all API nodes" />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="!loading && nodes.length === 0" class="text-center text-grey q-pa-lg">
      <q-icon name="dns" size="2em" />
      <div class="q-mt-sm">No API nodes are configured.</div>
    </div>

    <q-card-actions align="around">
      <q-btn flat dense icon="refresh" label="Re-check" color="primary" :loading="loading" @click="checkAll" />
      <q-btn flat dense icon="settings" label="Settings" color="grey" @click="settingsDialog = true" />
    </q-card-actions>

    <q-dialog v-model="settingsDialog">
      <settings />
    </q-dialog>
  </q-card>
</template>

<script>
import { HIVE_API_NODES } from 'src/services/hiveNodes'
import { setHiveNode } from 'src/services/hive'
import settings from 'components/settings.vue'

export default {
  name: 'nodes',
  components: { settings },
  data () {
    return {
      loading: false,
      nodes: [],
      activeNode: this.$hiveStore.user.settings.apiNode || HIVE_API_NODES[0],
      settingsDialog: false
    }
  },
  computed: {
    sortedNodes () {
      return [...this.nodes].sort((a, b) => {
        if (a.ok !== b.ok) return a.ok ? -1 : 1
        return a.latency - b.latency
      })
    }
  },
  methods: {
    prettyUrl (url) {
      return url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    },
    tidyNumber (x) {
      if (x === null || x === undefined) return '?'
      return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    },
    async probe (url) {
      const started = performance.now()
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'condenser_api.get_dynamic_global_properties',
            params: []
          })
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        if (!data.result) throw new Error(data.error?.message || 'Invalid response')
        return {
          url,
          ok: true,
          latency: Math.round(performance.now() - started),
          head: data.result.head_block_number,
          version: data.result.hive_version || null
        }
      } catch (error) {
        return { url, ok: false, latency: Infinity, error: error.message || 'Unreachable' }
      }
    },
    async checkAll () {
      this.loading = true
      const urls = [...new Set([this.activeNode, ...HIVE_API_NODES].filter(Boolean))]
      const results = await Promise.all(urls.map(url => this.probe(url)))
      const best = Math.max(...results.filter(n => n.ok).map(n => n.head || 0), 0)
      this.nodes = results.map(node => ({
        ...node,
        lag: node.ok && best ? Math.max(0, best - (node.head || 0)) : 0
      }))
      this.loading = false
    },
    useNode (node) {
      if (!node.ok) return
      this.activeNode = node.url
      this.$hiveStore.updateSettings({ ...this.$hiveStore.user.settings, apiNode: node.url })
      setHiveNode(node.url)
      this.$q.notify({ type: 'positive', message: 'Using ' + this.prettyUrl(node.url) })
    }
  },
  mounted () {
    document.title = 'Hive API Nodes'
    this.checkAll()
  }
}
</script>
