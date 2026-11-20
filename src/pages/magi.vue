<template>
  <q-page class="magi-page">
    <div class="magi-shell">
      <page-header
        eyebrow="Magi Network"
        title="Magi contracts"
        :live="!loading"
        intro="Look up a Magi contract by ID, inspect its metadata and recent outputs, read state keys and simulate read-only calls. Nothing is signed or broadcast from this page."
      >
        <template #actions>
          <q-btn no-caps outline color="primary" icon="dns" label="Magi nodes" to="/nodes?network=magi" />
          <q-btn flat round dense icon="refresh" aria-label="Refresh Magi contracts" title="Refresh Magi contracts" :loading="loading" @click="refresh" />
        </template>
      </page-header>

      <q-card flat bordered class="magi-search">
        <q-card-section class="magi-search__body">
          <div class="magi-search__row">
            <q-input
              v-model.trim="contractInput"
              dense
              outlined
              clearable
              label="Contract ID"
              placeholder="vsc1…"
              aria-label="Magi contract ID"
              class="magi-search__input"
              @keyup.enter="openContract"
            >
              <template #prepend><q-icon name="search" size="18px" aria-hidden="true" /></template>
            </q-input>
            <q-btn unelevated no-caps color="primary" icon="travel_explore" label="Load contract" :disable="!contractInput" @click="openContract" />
          </div>
          <p class="magi-search__hint">
            Tip: the <router-link to="/nodes?network=magi">Magi nodes</router-link> tab shows which
            GraphQL endpoint is currently preferred. Contract IDs start with <code>vsc1</code>.
          </p>
        </q-card-section>
      </q-card>

      <q-banner v-if="error" rounded class="magi-banner" role="alert">
        <template #avatar><q-icon name="error_outline" aria-hidden="true" /></template>
        {{ error }}
        <template #action><q-btn flat no-caps color="primary" label="Retry" @click="refresh" /></template>
      </q-banner>

      <skeleton v-if="loading && !contract" :rows="6" label="Loading Magi contract" />

      <template v-else-if="contract">
        <div class="ui-stat-grid">
          <stat-card label="Contract" :value="contract.name || 'Unnamed'" icon="description" :hint="shortId(contract.id)" />
          <stat-card label="Runtime" :value="contract.runtime || '—'" icon="memory" :hint="contract.owner || 'owner unavailable'" />
          <stat-card label="Created" :value="formatCount(contract.creation_height)" icon="add_box" :hint="contract.creation_ts ? timeLabel(contract.creation_ts) : 'creation time unavailable'" />
          <stat-card label="Pending updates" :value="pending.length" icon="pending_actions" :status-label="pending.length ? 'Queued' : 'None'" :status-color="pending.length ? 'orange' : 'green'" hint="Timelocked contract versions" />
        </div>

        <section class="magi-section" aria-labelledby="magi-contract-title">
          <div class="magi-section__head">
            <div>
              <div class="home-eyebrow">Contract</div>
              <h2 id="magi-contract-title" class="magi-section__title">{{ contract.name || 'Unnamed contract' }}</h2>
            </div>
            <a :href="explorerUrl" target="_blank" rel="noopener noreferrer" class="magi-link">
              Open in Magi Blocks <q-icon name="open_in_new" size="13px" aria-hidden="true" />
            </a>
          </div>

          <q-card flat bordered class="home-card home-panel magi-card">
            <q-card-section class="magi-meta">
              <div><span>ID</span><strong>{{ contract.id }}</strong></div>
              <div><span>Owner</span><strong>{{ contract.owner || '—' }}</strong></div>
              <div><span>Creator</span><strong>{{ contract.creator || '—' }}</strong></div>
              <div><span>Code CID</span><strong>{{ contract.code || '—' }}</strong></div>
              <div><span>Activation</span><strong>{{ formatCount(contract.activation_height) }}</strong></div>
              <div><span>Proposer</span><strong>{{ contract.proposer || '—' }}</strong></div>
            </q-card-section>
            <q-card-section v-if="contract.description" class="magi-description">
              {{ contract.description }}
            </q-card-section>
          </q-card>
        </section>

        <section class="magi-section" aria-labelledby="magi-state-title">
          <div class="magi-section__head">
            <div>
              <div class="home-eyebrow">Read-only</div>
              <h2 id="magi-state-title" class="magi-section__title">State reader</h2>
            </div>
            <span class="magi-section__hint">Magi state keys are CIDs. Enter one or more, comma separated.</span>
          </div>

          <q-card flat bordered class="magi-card">
            <q-card-section class="magi-form">
              <q-input
                v-model.trim="stateKey"
                dense
                outlined
                label="State key CID(s)"
                placeholder="bafy…"
                aria-label="Magi contract state key CIDs"
                @keyup.enter="readState"
              />
              <q-btn unelevated no-caps color="primary" icon="search" label="Read state" :loading="stateLoading" :disable="!stateKey" @click="readState" />
            </q-card-section>
            <div v-if="stateError" class="magi-inline-error">{{ stateError }}</div>
            <pre v-if="stateValue" class="magi-json">{{ stateValue }}</pre>
          </q-card>
        </section>

        <section class="magi-section" aria-labelledby="magi-sim-title">
          <div class="magi-section__head">
            <div>
              <div class="home-eyebrow">Read-only</div>
              <h2 id="magi-sim-title" class="magi-section__title">Simulate a contract call</h2>
            </div>
            <span class="magi-section__hint">Simulation never signs or broadcasts a transaction.</span>
          </div>

          <q-card flat bordered class="magi-card">
            <q-card-section class="magi-sim-grid">
              <q-input v-model.trim="action" dense outlined label="Action" placeholder="dumpEnv" aria-label="Magi contract action" />
              <q-input v-model.trim="payload" dense outlined label="Payload" placeholder="Optional payload" aria-label="Magi contract payload" />
              <q-input v-model.trim="simAccount" dense outlined label="Account" aria-label="Magi simulation account" />
              <q-select v-model="keyType" :options="keyTypeOptions" emit-value map-options dense outlined label="Authority" aria-label="Magi simulation authority" />
              <q-input v-model.number="rcLimit" dense outlined type="number" label="RC limit" aria-label="Magi simulation RC limit" />
              <q-btn unelevated no-caps color="primary" icon="play_arrow" label="Simulate" :loading="simLoading" :disable="!action" @click="simulate" />
            </q-card-section>
            <div v-if="simError" class="magi-inline-error">{{ simError }}</div>
            <pre v-if="simValue" class="magi-json">{{ simValue }}</pre>
          </q-card>
        </section>

        <section v-if="pending.length" class="magi-section" aria-labelledby="magi-pending-title">
          <div class="magi-section__head">
            <div>
              <div class="home-eyebrow">Timelock</div>
              <h2 id="magi-pending-title" class="magi-section__title">Pending contract updates</h2>
            </div>
          </div>
          <data-table
            :columns="pendingColumns"
            :rows="pending"
            row-key="tx_id"
            caption="Pending Magi contract updates"
            empty-message="No pending contract updates."
          >
            <template #cell-activation_height="{ value }">{{ formatCount(value) }}</template>
            <template #cell-activation_ts="{ value }">{{ value ? timeLabel(value) : '—' }}</template>
          </data-table>
        </section>

        <section class="magi-section" aria-labelledby="magi-outputs-title">
          <div class="magi-section__head">
            <div>
              <div class="home-eyebrow">Execution</div>
              <h2 id="magi-outputs-title" class="magi-section__title">Recent contract outputs</h2>
            </div>
            <span class="magi-section__hint">Latest {{ outputs.length }} output record{{ outputs.length === 1 ? '' : 's' }} returned by the node.</span>
          </div>
          <data-table
            :columns="outputColumns"
            :rows="outputRows"
            row-key="id"
            caption="Recent Magi contract outputs"
            empty-icon="play_circle"
            empty-message="No contract outputs were returned for this contract."
          >
            <template #cell-block_height="{ value }">{{ formatCount(value) }}</template>
            <template #cell-result="{ row }">
              <q-badge :color="row.ok ? 'green-9' : 'red-9'" text-color="white">{{ row.ok ? 'ok' : 'error' }}</q-badge>
              <span class="magi-output-ret">{{ row.ret }}</span>
            </template>
          </data-table>
        </section>
      </template>

      <section v-else-if="!loading" class="magi-section" aria-labelledby="magi-recent-title">
        <div class="magi-section__head">
          <div>
            <div class="home-eyebrow">Directory</div>
            <h2 id="magi-recent-title" class="magi-section__title">Recent contracts</h2>
          </div>
          <span class="magi-section__hint">Select a contract to inspect it, or paste an ID above.</span>
        </div>
        <data-table
          :columns="recentColumns"
          :rows="recentRows"
          row-key="id"
          caption="Recently created Magi contracts"
          :loading="recentLoading"
          empty-message="Recent contracts are unavailable right now."
        >
          <template #cell-id="{ row }">
            <router-link :to="{ name: 'magi', query: { contract: row.id } }" class="magi-contract-link">{{ shortId(row.id) }}</router-link>
          </template>
          <template #cell-name="{ row }">
            <router-link :to="{ name: 'magi', query: { contract: row.id } }" class="magi-contract-link">{{ row.name || 'Unnamed' }}</router-link>
          </template>
          <template #cell-creation_height="{ value }">{{ formatCount(value) }}</template>
        </data-table>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.magi-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.magi-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.ui-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.magi-search {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.025);
}

.magi-search__body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.magi-search__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.magi-search__input {
  flex: 1 1 320px;
  min-width: 200px;
}

.magi-search__hint {
  margin: 0;
  color: #78909c;
  font-size: 0.72rem;
  line-height: 1.5;
}

.magi-search__hint a {
  color: #4fc3f7;
  text-decoration: none;
}

.magi-search__hint code {
  color: #b0bec5;
}

.magi-banner {
  border: 1px solid rgba(255, 183, 77, 0.35);
  background: rgba(255, 183, 77, 0.08);
  color: #ffcc80;
}

.magi-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.magi-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.magi-section__title {
  margin: 0.15rem 0 0;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.magi-section__hint {
  color: #78909c;
  font-size: 0.72rem;
  line-height: 1.45;
}

.magi-card {
  overflow: hidden;
}

.magi-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.magi-meta > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.magi-meta span {
  color: #90a4ae;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.magi-meta strong {
  color: #cfd8dc;
  font-size: 0.74rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.magi-description {
  padding-top: 0;
  color: #90a4ae;
  font-size: 0.78rem;
  line-height: 1.5;
}

.magi-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.magi-form .q-input {
  flex: 1 1 280px;
  min-width: 200px;
}

.magi-sim-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  align-items: center;
}

.magi-sim-grid .q-btn {
  grid-column: 1 / -1;
  justify-self: start;
}

.magi-inline-error {
  margin: 0 0.9rem 0.6rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(255, 183, 77, 0.35);
  border-radius: var(--radius-sm);
  background: rgba(255, 183, 77, 0.08);
  color: #ffcc80;
  font-size: 0.72rem;
}

.magi-json {
  margin: 0;
  padding: 0.75rem 0.9rem;
  overflow-x: auto;
  border-top: 1px solid var(--border-subtle);
  background: rgba(0, 0, 0, 0.18);
  color: #b0bec5;
  font-size: 0.72rem;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.magi-link {
  color: #4fc3f7;
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
}

.magi-link:hover {
  text-decoration: underline;
}

.magi-contract-link {
  color: #4fc3f7;
  font-weight: 600;
  text-decoration: none;
}

.magi-contract-link:hover {
  text-decoration: underline;
}

.magi-output-ret {
  display: block;
  margin-top: 0.15rem;
  color: #90a4ae;
  font-size: 0.68rem;
  overflow-wrap: anywhere;
}

@media (max-width: 799px) {
  .magi-meta,
  .magi-sim-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .magi-shell {
    padding: var(--space-3) 0.7rem var(--space-5);
  }

  .magi-meta,
  .magi-sim-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import moment from 'src/utils/time'
import PageHeader from 'components/ui/PageHeader.vue'
import StatCard from 'components/ui/StatCard.vue'
import Skeleton from 'components/ui/Skeleton.vue'
import DataTable from 'components/ui/DataTable.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { formatCount } from 'src/services/network'
import {
  fetchMagiContract,
  fetchMagiContractState,
  fetchRecentMagiContracts,
  simulateMagiContractCall
} from 'src/services/magi'

function shortId (id) {
  const value = String(id || '')
  return value.length > 18 ? value.slice(0, 10) + '…' + value.slice(-6) : value
}

export default {
  name: 'MagiContracts',
  components: { PageHeader, StatCard, Skeleton, DataTable },
  data () {
    return {
      contractInput: String(this.$route.query.contract || ''),
      contract: null,
      pending: [],
      outputs: [],
      recent: [],
      loading: false,
      recentLoading: false,
      error: '',
      stateKey: '',
      stateValue: '',
      stateError: '',
      stateLoading: false,
      action: 'dumpEnv',
      payload: '',
      simAccount: this.$hiveStore.user.username ? 'hive:' + this.$hiveStore.user.username : 'hive:vsc.dao',
      keyType: 'posting',
      keyTypeOptions: [
        { label: 'Posting', value: 'posting' },
        { label: 'Active', value: 'active' }
      ],
      rcLimit: 300,
      simValue: '',
      simError: '',
      simLoading: false
    }
  },
  computed: {
    pendingColumns () {
      return [
        { key: 'tx_id', label: 'Transaction' },
        { key: 'proposer', label: 'Proposer' },
        { key: 'activation_height', label: 'Activates', align: 'right' },
        { key: 'activation_ts', label: 'Estimated', align: 'right' }
      ]
    },
    outputColumns () {
      return [
        { key: 'block_height', label: 'Block', align: 'right' },
        { key: 'timestamp', label: 'Time' },
        { key: 'result', label: 'Result' }
      ]
    },
    outputRows () {
      return this.outputs.map(output => {
        const result = output.results?.[0] || {}
        return {
          id: output.id,
          block_height: output.block_height,
          timestamp: output.timestamp,
          ok: result.ok !== false,
          ret: result.ret || 'No return value'
        }
      })
    },
    recentColumns () {
      return [
        { key: 'id', label: 'Contract' },
        { key: 'name', label: 'Name' },
        { key: 'owner', label: 'Owner' },
        { key: 'runtime', label: 'Runtime' },
        { key: 'creation_height', label: 'Created', align: 'right' }
      ]
    },
    recentRows () {
      return this.recent.map(contract => ({ ...contract }))
    },
    explorerUrl () {
      return 'https://vsc.techcoderx.com/contract/' + encodeURIComponent(this.contract?.id || '')
    }
  },
  watch: {
    '$route.query.contract' (value) {
      const id = String(value || '')
      this.contractInput = id
      if (id) this.loadContract(id)
    }
  },
  mounted () {
    setPageMeta({
      title: 'Magi contracts — inspect state, outputs and simulation',
      description: 'Look up a Magi Network smart contract by ID. Inspect metadata, timelocked updates, recent outputs, state keys and read-only contract call simulation.',
      url: '/magi'
    })
    if (this.contractInput) {
      this.loadContract(this.contractInput)
    } else {
      this.loadRecent()
    }
  },
  methods: {
    formatCount,
    shortId,
    timeLabel (timestamp) {
      return timestamp ? moment.utc(timestamp).fromNow() : '—'
    },
    async refresh () {
      if (this.contractInput) return this.loadContract(this.contractInput, true)
      return this.loadRecent(true)
    },
    openContract () {
      const id = this.contractInput.trim()
      if (!id) return
      if (this.$route.query.contract === id) {
        this.loadContract(id)
      } else {
        this.$router.replace({ name: 'magi', query: { contract: id } })
      }
    },
    async loadContract (id, force = false) {
      const contractId = String(id || '').trim()
      if (!contractId || this.loading) return
      this.loading = true
      this.error = ''
      this.contract = null
      this.pending = []
      this.outputs = []
      this.stateValue = ''
      this.stateError = ''
      this.simValue = ''
      this.simError = ''
      try {
        const data = await fetchMagiContract(contractId, { outputLimit: 25, force })
        if (!data?.contract) {
          this.error = 'Magi contract ' + shortId(contractId) + ' was not found.'
          this.loadRecent(true)
          return
        }
        this.contract = data.contract
        this.pending = data.pending || []
        this.outputs = data.outputs || []
      } catch {
        this.error = 'Magi Network is unavailable right now.'
      } finally {
        this.loading = false
      }
    },
    async loadRecent (force = false) {
      if (this.recentLoading) return
      this.recentLoading = true
      try {
        const data = await fetchRecentMagiContracts(12, { force })
        this.recent = data?.contracts || []
      } catch {
        this.recent = []
      } finally {
        this.recentLoading = false
      }
    },
    async readState () {
      const keys = this.stateKey.split(',').map(key => key.trim()).filter(Boolean)
      if (!this.contract?.id || !keys.length) return
      this.stateLoading = true
      this.stateError = ''
      this.stateValue = ''
      try {
        const data = await fetchMagiContractState(this.contract.id, keys, { force: true })
        this.stateValue = JSON.stringify(data?.state || {}, null, 2)
      } catch (error) {
        this.stateError = error?.message || 'State read failed.'
      } finally {
        this.stateLoading = false
      }
    },
    async simulate () {
      if (!this.contract?.id || !this.action) return
      this.simLoading = true
      this.simError = ''
      this.simValue = ''
      try {
        const data = await simulateMagiContractCall({
          contractId: this.contract.id,
          action: this.action,
          payload: this.payload,
          rcLimit: this.rcLimit,
          account: this.simAccount,
          keyType: this.keyType
        }, { force: true })
        this.simValue = JSON.stringify(data?.result || {}, null, 2)
      } catch (error) {
        this.simError = error?.message || 'Simulation failed.'
      } finally {
        this.simLoading = false
      }
    }
  }
}
</script>
