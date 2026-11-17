<template>
  <q-page class="tx-page">
    <div class="tx-wrap">
      <div class="tx-nav">
        <q-btn flat dense no-caps icon="arrow_back" label="All blocks" to="/blocks" />
        <q-space />
        <q-btn
          flat
          dense
          round
          icon="navigate_before"
          aria-label="Previous transaction"
          title="Previous transaction"
          :disable="!prevTxId"
          @click="goTx(prevTxId)"
        />
        <q-btn flat dense round icon="refresh" aria-label="Refresh transaction" title="Refresh transaction" :loading="loading" @click="loadTx(txId)" />
        <q-btn
          flat
          dense
          round
          icon="navigate_next"
          aria-label="Next transaction"
          title="Next transaction"
          :disable="!nextTxId"
          @click="goTx(nextTxId)"
        />
        <q-btn flat dense no-caps icon="view_agenda" label="Block" :to="blockLink" :disable="!blockNum" />
      </div>

      <q-card v-if="loading" flat bordered class="tx-hero tx-hero--loading">
        <q-card-section>
          <q-skeleton type="text" width="200px" />
          <q-skeleton type="text" width="420px" />
          <div class="tx-metrics q-mt-md">
            <q-skeleton v-for="i in 8" :key="i" type="rect" height="64px" />
          </div>
        </q-card-section>
      </q-card>

      <q-card v-else-if="loadError || !tx" flat bordered class="tx-state">
        <q-icon name="error_outline" size="2.4em" color="orange" aria-hidden="true" />
        <h1 class="tx-state__title">Transaction not found</h1>
        <p class="tx-state__text">
          {{ loadError || 'The transaction may be too old, or the API node could not return it.' }}
        </p>
        <code class="tx-state__id">{{ txId }}</code>
        <div class="row q-gutter-sm justify-center q-mt-md">
          <q-btn outline no-caps color="primary" icon="refresh" label="Retry" @click="loadTx(txId)" />
          <q-btn flat no-caps color="primary" icon="arrow_back" label="Back to blocks" to="/blocks" />
        </div>
      </q-card>

      <template v-else>
        <q-card flat bordered class="tx-hero">
          <q-card-section>
            <div class="tx-hero__top">
              <div class="tx-hero__title-wrap">
                <div class="tx-hero__eyebrow">
                  <q-badge :color="statusColor" :label="statusLabel" />
                  <span>Hive transaction</span>
                </div>
                <h1 class="tx-hero__title">Transaction {{ shortId }}</h1>
                <div class="tx-hero__subtitle">
                  <template v-if="blockNum">
                    Included in <router-link :to="blockLink">block {{ tidyNumber(blockNum) }}</router-link>
                  </template>
                  <template v-else>Block unknown</template>
                  <template v-if="blockWitness">
                    <span class="tx-hero__dot">·</span>
                    produced by <router-link :to="'/@' + blockWitness">@{{ blockWitness }}</router-link>
                  </template>
                  <template v-if="formattedTimestamp">
                    <span class="tx-hero__dot">·</span>
                    <time :datetime="timestamp">{{ formattedTimestamp }}</time>
                    <span class="tx-hero__dot">·</span>
                    <span>{{ relativeTimestamp }}</span>
                  </template>
                </div>
                <div class="tx-hero__id">
                  <span class="tx-hero__id-label">Transaction ID</span>
                  <code>{{ tx.transaction_id }}</code>
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    icon="content_copy"
                    aria-label="Copy transaction ID"
                    title="Copy transaction ID"
                    @click="copy(tx.transaction_id, 'Transaction ID copied')"
                  />
                </div>
              </div>
              <div class="tx-hero__actions">
                <q-btn outline no-caps color="primary" icon="content_copy" label="Copy ID" @click="copy(tx.transaction_id, 'Transaction ID copied')" />
                <q-btn flat no-caps icon="view_agenda" label="View block" :to="blockLink" :disable="!blockNum" />
              </div>
            </div>

            <div class="tx-metrics">
              <div class="tx-metric">
                <span class="tx-metric__label">Block</span>
                <router-link v-if="blockNum" :to="blockLink" class="tx-metric__value">{{ tidyNumber(blockNum) }}</router-link>
                <span v-else class="tx-metric__value">—</span>
              </div>
              <div class="tx-metric">
                <span class="tx-metric__label">Transaction</span>
                <span class="tx-metric__value">#{{ transactionNumber }}</span>
              </div>
              <div class="tx-metric">
                <span class="tx-metric__label">Operations</span>
                <span class="tx-metric__value">{{ operations.length }}</span>
              </div>
              <div class="tx-metric">
                <span class="tx-metric__label">Signatures</span>
                <span class="tx-metric__value">{{ signatures.length }}</span>
              </div>
              <div class="tx-metric tx-metric--wide">
                <span class="tx-metric__label">Expiration</span>
                <span class="tx-metric__value tx-metric__mono">{{ formattedExpiration }}</span>
              </div>
              <div class="tx-metric tx-metric--wide">
                <span class="tx-metric__label">RC cost</span>
                <span class="tx-metric__value tx-metric__mono">{{ rcCost }}</span>
              </div>
              <div class="tx-metric tx-metric--wide">
                <span class="tx-metric__label">Reference block</span>
                <span class="tx-metric__value tx-metric__mono">{{ referenceBlock }}</span>
              </div>
              <div class="tx-metric tx-metric--wide">
                <span class="tx-metric__label">Status</span>
                <span class="tx-metric__value">{{ statusDetail }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="tx-body">
          <q-tabs
            v-model="tab"
            dense
            align="left"
            active-color="primary"
            indicator-color="primary"
            class="tx-tabs"
            mobile-arrows
            aria-label="Transaction content"
          >
            <q-tab name="operations" :label="'Operations (' + operations.length + ')'" />
            <q-tab name="raw" label="Raw JSON" />
          </q-tabs>

          <q-tab-panels v-model="tab" animated class="tx-panels">
            <q-tab-panel name="operations">
              <div v-if="operations.length === 0" class="tx-empty">
                This transaction contains no operations.
              </div>
              <div v-else class="tx-ops">
                <div v-for="(operation, index) in operations" :key="index" class="tx-op">
                  <div v-if="operations.length > 1" class="tx-op__label">Operation {{ index + 1 }}</div>
                  <block-operation :operation="{ op: operation }" />
                </div>
              </div>

              <div v-if="signatures.length" class="tx-signatures">
                <div class="tx-signatures__head">
                  <div>
                    <div class="tx-signatures__title">Signatures</div>
                    <div class="tx-signatures__hint">The signatures below sign the raw transaction JSON.</div>
                  </div>
                  <q-badge color="blue-grey-9">{{ signatures.length }}</q-badge>
                </div>
                <div v-for="(signature, index) in signatures" :key="index" class="tx-signature">
                  <code>{{ signature }}</code>
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    icon="content_copy"
                    :aria-label="'Copy signature ' + (index + 1)"
                    title="Copy signature"
                    @click="copy(signature, 'Signature copied')"
                  />
                </div>
              </div>
            </q-tab-panel>

            <q-tab-panel name="raw">
              <div class="tx-raw">
                <div class="tx-raw__head">
                  <div>
                    <div class="tx-raw__title">Raw transaction JSON</div>
                    <div class="tx-raw__hint">Expand objects and arrays with the tree controls.</div>
                  </div>
                  <q-btn flat dense no-caps icon="content_copy" label="Copy JSON" @click="copyJson" />
                </div>
                <json-viewer :data="tx" :deep="1" :showLength="true" />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card>

        <div class="tx-footer-nav">
          <q-btn
            v-if="prevTxId"
            outline
            no-caps
            color="primary"
            icon="navigate_before"
            label="Previous transaction"
            @click="goTx(prevTxId)"
          />
          <q-btn v-else outline no-caps color="primary" icon="arrow_back" label="Back to block" :to="blockLink" :disable="!blockNum" />
          <q-btn
            v-if="nextTxId"
            outline
            no-caps
            color="primary"
            icon-right="navigate_next"
            label="Next transaction"
            @click="goTx(nextTxId)"
          />
          <q-btn v-else outline no-caps color="primary" icon-right="view_agenda" label="View block" :to="blockLink" :disable="!blockNum" />
        </div>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.tx-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.tx-wrap {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

.tx-nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.tx-hero {
  overflow: hidden;
}

.tx-hero__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.tx-hero__title-wrap {
  min-width: 0;
}

.tx-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: #90a4ae;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tx-hero__title {
  margin: 0.35rem 0 0.45rem;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.tx-hero__subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #b0bec5;
  font-size: 0.85rem;
}

.tx-hero__subtitle a {
  color: #4fc3f7;
}

.tx-hero__dot {
  color: #607d8b;
}

.tx-hero__id {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
}

.tx-hero__id-label {
  color: #90a4ae;
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tx-hero__id code {
  min-width: 0;
  color: #cfd8dc;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.tx-hero__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tx-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.tx-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.035);
}

.tx-metric--wide {
  grid-column: span 2;
}

.tx-metric__label {
  color: #90a4ae;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tx-metric__value {
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

a.tx-metric__value {
  color: #64b5f6;
  text-decoration: none;
}

a.tx-metric__value:visited {
  color: #ce93d8;
}

.tx-metric__mono {
  font-family: monospace;
  font-size: 0.74rem;
  font-weight: 500;
  color: #cfd8dc;
}

.tx-body {
  margin-top: var(--space-4);
  overflow: hidden;
}

.tx-tabs {
  border-bottom: 1px solid var(--border-subtle);
}

.tx-panels {
  min-height: 12rem;
}

.tx-ops {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tx-op {
  padding: 0.15rem 0.9rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.015);
}

.tx-op__label {
  padding-top: 0.45rem;
  color: #78909c;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tx-op :deep(.block-op) {
  border-top: 0;
}

.tx-signatures {
  margin-top: var(--space-4);
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.tx-signatures__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: 0.55rem;
}

.tx-signatures__title {
  font-size: 0.95rem;
  font-weight: 600;
}

.tx-signatures__hint {
  color: #90a4ae;
  font-size: 0.76rem;
}

.tx-signature {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--border-subtle);
}

.tx-signature code {
  flex: 1;
  min-width: 0;
  color: #b0bec5;
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}

.tx-raw__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.tx-raw__title {
  font-size: 1rem;
  font-weight: 600;
}

.tx-raw__hint {
  color: #90a4ae;
  font-size: 0.78rem;
}

.tx-empty,
.tx-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.tx-state__title {
  margin: var(--space-2) 0 0;
  font-size: 1.35rem;
  line-height: 1.25;
}

.tx-state__text {
  margin: var(--space-2) 0;
  color: #90a4ae;
  overflow-wrap: anywhere;
}

.tx-state__id {
  color: #78909c;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.tx-footer-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

@media (max-width: 800px) {
  .tx-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tx-metric--wide {
    grid-column: span 2;
  }
}

@media (max-width: 599px) {
  .tx-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .tx-hero__top {
    gap: var(--space-2);
  }

  .tx-hero__actions {
    width: 100%;
  }

  .tx-hero__actions .q-btn {
    flex: 1;
  }

  .tx-metrics {
    gap: 0.4rem;
  }

  .tx-metric {
    padding: 0.4rem 0.5rem;
  }

  .tx-metric__value {
    font-size: 0.9rem;
  }

  .tx-footer-nav .q-btn {
    font-size: 0.72rem;
  }
}
</style>

<script>
import { copyToClipboard } from 'quasar'
import moment from 'src/utils/time'
import jsonViewer from 'components/jsonViewer.vue'
import BlockOperation from 'components/BlockOperation.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import {
  describeTransactionStatus,
  findTransactionNeighbours,
  formatRcCost,
  shortTxId,
  transactionNumber
} from 'src/services/transactions'

export default {
  name: 'transactionViewPage',
  components: {
    jsonViewer,
    BlockOperation
  },
  data () {
    return {
      txId: this.$route.params.txId,
      tx: null,
      block: null,
      status: null,
      loading: true,
      loadError: null,
      tab: 'operations',
      txLookupApiNode: this.$hiveStore.user.settings.ahNode || 'https://api.hive.blog'
    }
  },
  computed: {
    shortId () {
      return shortTxId(this.txId)
    },
    operations () {
      return (this.tx && Array.isArray(this.tx.operations)) ? this.tx.operations : []
    },
    signatures () {
      return (this.tx && Array.isArray(this.tx.signatures)) ? this.tx.signatures : []
    },
    blockNum () {
      const raw = (this.tx && this.tx.block_num) ?? (this.status && this.status.block_num) ?? (this.block && this.block.block_num)
      const value = Number(raw)
      return Number.isFinite(value) && value > 0 ? value : null
    },
    blockLink () {
      return this.blockNum ? '/b/' + this.blockNum + '#' + this.txId : '/blocks'
    },
    blockWitness () {
      return (this.block && this.block.witness) || ''
    },
    timestamp () {
      return (this.block && this.block.timestamp) || ''
    },
    formattedTimestamp () {
      if (!this.timestamp) return ''
      return moment.utc(this.timestamp).format('D MMM YYYY, HH:mm:ss') + ' UTC'
    },
    relativeTimestamp () {
      if (!this.timestamp) return ''
      return moment.utc(this.timestamp).fromNow()
    },
    formattedExpiration () {
      if (!this.tx || !this.tx.expiration) return '—'
      return moment.utc(this.tx.expiration).format('D MMM YYYY, HH:mm:ss') + ' UTC'
    },
    transactionNumber () {
      return transactionNumber(this.tx)
    },
    rcCost () {
      return formatRcCost(this.status)
    },
    referenceBlock () {
      if (!this.tx) return '—'
      const num = this.tx.ref_block_num
      const prefix = this.tx.ref_block_prefix
      if (num === undefined && prefix === undefined) return '—'
      return (num ?? '—') + ' / ' + (prefix ?? '—')
    },
    statusInfo () {
      return describeTransactionStatus(this.status)
    },
    statusLabel () {
      return this.statusInfo.label
    },
    statusColor () {
      return this.statusInfo.color
    },
    statusDetail () {
      return this.statusInfo.detail
    },
    neighbours () {
      return findTransactionNeighbours(this.block && this.block.transactions, this.txId)
    },
    txIndex () {
      return this.neighbours.index
    },
    prevTxId () {
      return this.neighbours.prevId
    },
    nextTxId () {
      return this.neighbours.nextId
    }
  },
  watch: {
    '$route.params.txId' (txId) {
      if (txId && txId !== this.txId) this.loadTx(txId)
    }
  },
  mounted () {
    this.loadTx(this.txId)
  },
  methods: {
    async loadTx (txId) {
      this.txId = txId
      this.loading = true
      this.loadError = null
      this.tx = null
      this.block = null
      this.status = null
      this.tab = 'operations'

      this.setLoadingMeta()

      try {
        try {
          this.status = await this.$hive.api.callAsync('transaction_status_api.find_transaction', { transaction_id: txId })
        } catch {
          this.status = null
        }

        const statusBlock = Number(this.status && this.status.block_num)
        if (Number.isFinite(statusBlock) && statusBlock > 0) {
          try {
            const block = await this.$hive.api.getBlockAsync(statusBlock)
            const found = (block && block.transactions || []).find(tx => tx.transaction_id === txId)
            if (found) {
              this.block = block
              this.tx = found
            }
          } catch (error) {
            console.error('Failed to load transaction block', error)
          }
        }

        if (!this.tx) {
          const fallback = await this.getTxFallback(txId)
          if (fallback) this.tx = fallback
        }

        if (!this.tx) throw new Error('Transaction not found')

        if (!this.block) {
          const blockNum = Number(this.tx.block_num || (this.status && this.status.block_num))
          if (Number.isFinite(blockNum) && blockNum > 0) {
            try {
              this.block = await this.$hive.api.getBlockAsync(blockNum)
            } catch {
              this.block = null
            }
          }
        }

        this.setLoadedMeta()
      } catch (error) {
        if (error?.message !== 'Transaction not found') {
          console.error('Failed to load transaction', error)
        }
        this.tx = null
        this.loadError = 'The transaction may be too old, or the API node could not return it.'
        this.setErrorMeta()
      } finally {
        this.loading = false
      }
    },
    async getTxFallback (txId) {
      try {
        const response = await this.$axios.post(this.txLookupApiNode, {
          jsonrpc: '2.0',
          id: 1,
          method: 'condenser_api.get_transaction',
          params: [txId]
        })
        if (response.data && response.data.result) return response.data.result
      } catch (error) {
        if (!error?.response) console.error('Fallback transaction lookup failed', error)
      }

      try {
        return await this.$hive.api.getTransactionAsync(txId)
      } catch {
        return null
      }
    },
    goTx (txId) {
      if (!txId) return
      this.$router.push('/tx/' + txId)
    },
    tidyNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return number.toLocaleString('en-US')
    },
    copy (value, message) {
      if (!value) return
      copyToClipboard(String(value))
      this.$q.notify({ type: 'positive', message })
    },
    copyJson () {
      if (!this.tx) return
      copyToClipboard(JSON.stringify(this.tx, null, 2))
      this.$q.notify({ type: 'positive', message: 'Raw transaction JSON copied' })
    },
    setLoadingMeta () {
      setPageMeta({
        title: 'Hive transaction ' + this.shortId,
        description: 'Hive transaction ' + this.txId + ' — operations, signatures, block inclusion and raw JSON.',
        url: '/tx/' + this.txId
      })
    },
    setLoadedMeta () {
      const block = this.blockNum ? ' in block ' + this.blockNum : ''
      const opTypes = [...new Set(this.operations.map(operation => operation[0]))]
      const ops = opTypes.length ? opTypes.join(', ') : 'no operations'
      setPageMeta({
        title: 'Hive transaction ' + this.shortId,
        description: 'Hive transaction ' + this.txId + block + ' — ' + ops + ' operation(s), signatures and raw JSON.',
        url: '/tx/' + this.txId
      })
    },
    setErrorMeta () {
      setPageMeta({
        title: 'Transaction ' + this.shortId + ' not found',
        description: 'Hive transaction ' + this.txId + ' could not be loaded.',
        url: '/tx/' + this.txId
      })
    }
  }
}
</script>
