<template>
  <q-page class="block-page">
    <div class="block-wrap">
      <div class="block-nav">
        <q-btn flat dense no-caps icon="arrow_back" label="All blocks" to="/blocks" />
        <q-space />
        <q-btn
          flat
          dense
          round
          icon="navigate_before"
          aria-label="Previous block"
          title="Previous block"
          :disable="blockNumber <= 1"
          @click="goTo(blockNumber - 1)"
        />
        <q-btn flat dense round icon="refresh" aria-label="Refresh block" title="Refresh block" :loading="loading" @click="loadBlock(blockNumber)" />
        <q-btn flat dense round icon="navigate_next" aria-label="Next block" title="Next block" :disable="isHead" @click="goTo(blockNumber + 1)" />
        <share-menu :title="'Hive block ' + blockNumber" :path="'/b/' + blockNumber" />
        <q-btn flat dense no-caps icon="last_page" label="Latest" :loading="loadingLatest" @click="goLatest" />
      </div>

      <q-card v-if="loading" flat bordered class="block-hero block-hero--loading">
        <q-card-section>
          <q-skeleton type="text" width="220px" />
          <q-skeleton type="text" width="320px" />
          <div class="block-metrics q-mt-md">
            <q-skeleton v-for="i in 8" :key="i" type="rect" height="64px" />
          </div>
        </q-card-section>
      </q-card>

      <q-card v-else-if="loadError || !block" flat bordered class="block-state">
        <q-icon name="error_outline" size="2.4em" color="orange" aria-hidden="true" />
        <h1 class="block-state__title">{{ loadError || 'Block not found' }}</h1>
        <p class="block-state__text">
          The block may not exist yet or the node could not return it.
        </p>
        <div class="row q-gutter-sm justify-center">
          <q-btn outline no-caps color="primary" icon="refresh" label="Retry" @click="loadBlock(blockNumber)" />
          <q-btn flat no-caps color="primary" icon="arrow_back" label="Back to blocks" to="/blocks" />
        </div>
      </q-card>

      <template v-else>
        <q-card flat bordered class="block-hero">
          <q-card-section>
            <div class="block-hero__top">
              <div class="block-hero__title-wrap">
                <div class="block-hero__eyebrow">
                  <q-badge v-if="isHead" color="green" text-color="black">Head block</q-badge>
                  <q-badge v-else-if="isIrreversible" color="blue-grey-9">Irreversible</q-badge>
                  <span>Hive block</span>
                </div>
                <h1 class="block-hero__title">Block {{ tidyNumber(blockNumber) }}</h1>
                <div class="block-hero__subtitle">
                  <q-avatar size="22px">
                    <q-img :src="avatarUrl(block.witness)" :alt="'Avatar of witness @' + block.witness" />
                  </q-avatar>
                  Produced by <router-link :to="'/@' + block.witness">@{{ block.witness }}</router-link>
                  <span class="block-hero__dot">·</span>
                  <span :title="block.timestamp">{{ formattedTimestamp }}</span>
                  <span class="block-hero__dot">·</span>
                  <span>{{ relativeTimestamp }}</span>
                </div>
              </div>
              <div class="block-hero__actions">
                <q-btn
                  outline
                  no-caps
                  color="primary"
                  icon="content_copy"
                  label="Copy ID"
                  @click="copy(block.block_id, 'Block ID copied')"
                />
                <q-btn
                  flat
                  no-caps
                  icon="open_in_new"
                  label="HiveHub"
                  type="a"
                  :href="'https://hivehub.dev/b/' + blockNumber"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </div>
            </div>

            <div class="block-metrics">
              <div class="block-metric">
                <span class="block-metric__label">Transactions</span>
                <span class="block-metric__value">{{ transactions.length }}</span>
              </div>
              <div class="block-metric">
                <span class="block-metric__label">Operations</span>
                <span class="block-metric__value">{{ operationCount }}</span>
              </div>
              <div class="block-metric">
                <span class="block-metric__label">Virtual ops</span>
                <span class="block-metric__value">{{ virtualOps.length }}</span>
              </div>
              <div class="block-metric">
                <span class="block-metric__label">Size</span>
                <span class="block-metric__value">{{ blockSize }} KB</span>
              </div>
              <div class="block-metric block-metric--wide">
                <span class="block-metric__label">Block ID</span>
                <span class="block-metric__value block-metric__mono">{{ block.block_id }}</span>
                <q-btn flat dense round size="sm" icon="content_copy" aria-label="Copy block ID" @click="copy(block.block_id, 'Block ID copied')" />
              </div>
              <div class="block-metric block-metric--wide">
                <span class="block-metric__label">Previous block</span>
                <router-link :to="'/b/' + (blockNumber - 1)" class="block-metric__mono">{{ block.previous }}</router-link>
              </div>
              <div class="block-metric block-metric--wide">
                <span class="block-metric__label">Merkle root</span>
                <span class="block-metric__value block-metric__mono">{{ block.transaction_merkle_root }}</span>
              </div>
              <div class="block-metric block-metric--wide">
                <span class="block-metric__label">Signing key</span>
                <span class="block-metric__value block-metric__mono">{{ block.signing_key }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="block-body">
          <q-tabs
            v-model="tab"
            dense
            align="left"
            active-color="primary"
            indicator-color="primary"
            class="block-tabs"
            mobile-arrows
            aria-label="Block content"
          >
            <q-tab name="transactions" :label="'Transactions (' + transactions.length + ')'" />
            <q-tab name="virtual" :label="'Virtual operations (' + virtualOps.length + ')'" />
            <q-tab name="raw" label="Raw JSON" />
          </q-tabs>

          <q-tab-panels v-model="tab" animated class="block-panels">
            <q-tab-panel name="transactions">
              <div v-if="transactions.length === 0" class="block-empty">
                This block contains no transactions.
              </div>
              <block-transaction
                v-for="(transaction, index) in transactions"
                :key="transaction.transaction_id || index"
                :transaction="transaction"
                :index="index"
              />
            </q-tab-panel>

            <q-tab-panel name="virtual">
              <div v-if="virtualOps.length === 0" class="block-empty">
                This block contains no virtual operations.
              </div>
              <q-card v-else flat bordered class="block-virtual-card">
                <div class="block-virtual-card__body">
                  <block-operation
                    v-for="(operation, index) in virtualOps"
                    :key="operation.virtual_op + '-' + index"
                    :operation="operation"
                    virtual
                  />
                </div>
              </q-card>
            </q-tab-panel>

            <q-tab-panel name="raw">
              <div class="block-raw">
                <div class="block-raw__head">
                  <div>
                    <div class="block-raw__title">Raw block JSON</div>
                    <div class="block-raw__hint">Expand objects and arrays with the tree controls.</div>
                  </div>
                  <q-btn flat dense no-caps icon="content_copy" label="Copy JSON" @click="copyJson" />
                </div>
                <json-viewer :data="block" :deep="1" :showLength="true" />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card>

        <div class="block-footer-nav">
          <q-btn outline no-caps color="primary" icon="navigate_before" :label="'Block ' + tidyNumber(blockNumber - 1)" :disable="blockNumber <= 1" @click="goTo(blockNumber - 1)" />
          <q-btn outline no-caps color="primary" icon-right="navigate_next" :label="'Block ' + tidyNumber(blockNumber + 1)" :disable="isHead" @click="goTo(blockNumber + 1)" />
        </div>
      </template>
    </div>
  </q-page>
</template>

<script>
import { copyToClipboard } from 'quasar'
import moment from 'src/utils/time'
import { defineAsyncComponent } from 'vue'
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))
import BlockTransaction from 'components/BlockTransaction.vue'
import BlockOperation from 'components/BlockOperation.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchGlobalProps } from 'src/services/chainData'
import ShareMenu from 'components/ui/ShareMenu.vue'

export default {
  name: 'blockViewPage',
  components: {
    jsonViewer,
    BlockTransaction,
    BlockOperation,
    ShareMenu
  },
  data () {
    return {
      blockNumber: parseInt(this.$route.params.blockNum),
      block: null,
      virtualOps: [],
      headBlock: null,
      lib: null,
      loading: true,
      loadingLatest: false,
      loadError: null,
      tab: 'transactions'
    }
  },
  computed: {
    transactions () {
      return this.block?.transactions || []
    },
    operationCount () {
      return this.transactions.reduce((total, tx) => total + (tx.operations?.length || 0), 0)
    },
    blockSize () {
      if (!this.block) return '0'
      try {
        return (new TextEncoder().encode(JSON.stringify(this.block)).length / 1024).toFixed(1)
      } catch {
        return '—'
      }
    },
    isHead () {
      return this.headBlock !== null && this.blockNumber >= this.headBlock
    },
    isIrreversible () {
      return this.lib !== null && this.blockNumber <= this.lib
    },
    formattedTimestamp () {
      if (!this.block?.timestamp) return ''
      return moment.utc(this.block.timestamp).format('D MMM YYYY, HH:mm:ss') + ' UTC'
    },
    relativeTimestamp () {
      if (!this.block?.timestamp) return ''
      return moment.utc(this.block.timestamp).fromNow()
    }
  },
  watch: {
    '$route.params.blockNum' () {
      this.blockNumber = parseInt(this.$route.params.blockNum)
      this.loadBlock(this.blockNumber)
    }
  },
  mounted () {
    this.loadBlock(this.blockNumber)
  },
  methods: {
    async loadBlock (blockNumber) {
      if (!Number.isInteger(blockNumber) || blockNumber < 0) {
        this.loadError = 'Invalid block number'
        this.loading = false
        this.block = null
        setPageMeta({
          title: 'Invalid block number',
          description: 'The requested Hive block number is not valid.',
          url: '/b/' + (this.$route?.params?.blockNum || '')
        })
        return
      }

      this.loading = true
      this.loadError = null
      this.blockNumber = blockNumber

      try {
        const [block, virtualOps, globalProps] = await Promise.all([
          this.$hive.api.getBlockAsync(blockNumber),
          this.$hive.api.getOpsInBlockAsync(blockNumber, true).catch(() => []),
          fetchGlobalProps({ force: true }).catch(() => null)
        ])

        if (!block) throw new Error('Block not found')

        this.block = block
        this.virtualOps = Array.isArray(virtualOps) ? virtualOps : []
        if (globalProps) {
          this.headBlock = Number(globalProps.head_block_number) || null
          this.lib = Number(globalProps.last_irreversible_block_num) || null
        }

        setPageMeta({
          title: 'Hive block ' + blockNumber,
          description: 'Hive block ' + blockNumber + ' — transactions, operations, virtual operations, witness and raw block JSON.',
          url: '/block/' + blockNumber
        })
        this.scrollToHash()
      } catch (error) {
        if (error?.message !== 'Block not found') {
          console.error('Failed to load block', error)
        }
        this.block = null
        this.virtualOps = []
        this.loadError = 'Failed to load block ' + blockNumber
        setPageMeta({
          title: 'Block ' + blockNumber + ' not found',
          description: 'Hive block ' + blockNumber + ' could not be loaded.',
          url: '/b/' + blockNumber
        })
      } finally {
        this.loading = false
      }
    },
    goTo (blockNumber) {
      if (!Number.isInteger(blockNumber) || blockNumber < 0) return
      this.$router.push('/b/' + blockNumber)
    },
    scrollToHash () {
      const hash = this.$route && this.$route.hash
      if (!hash || hash.length < 2) return
      this.$nextTick(() => {
        const target = document.getElementById(hash.slice(1))
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    async goLatest () {
      this.loadingLatest = true
      try {
        const props = await fetchGlobalProps({ force: true })
        const head = Number(props?.head_block_number)
        if (Number.isInteger(head) && head > 0) {
          this.$router.push('/b/' + (head - 1))
        }
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not load the latest block' })
      } finally {
        this.loadingLatest = false
      }
    },
    tidyNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return number.toLocaleString('en-US')
    },
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    copy (value, message) {
      if (!value) return
      copyToClipboard(String(value))
      this.$q.notify({ type: 'positive', message })
    },
    copyJson () {
      if (!this.block) return
      copyToClipboard(JSON.stringify(this.block, null, 2))
      this.$q.notify({ type: 'positive', message: 'Raw block JSON copied' })
    }
  }
}
</script>

<style scoped>
.block-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.block-wrap {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.block-nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.block-hero {
  overflow: hidden;
}

.block-hero__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.block-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: #90a4ae;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.block-hero__title {
  margin: 0.35rem 0 0.45rem;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.block-hero__subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #b0bec5;
  font-size: 0.85rem;
}

.block-hero__dot {
  color: #607d8b;
}

.block-hero__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.block-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.block-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.035);
}


.block-metric--wide {
  grid-column: span 2;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.block-metric--wide .block-metric__value {
  flex: 1 1 12rem;
}

.block-metric--wide .q-btn {
  margin-left: auto;
}

.block-metric__label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #90a4ae;
}

.block-metric__value {
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.block-metric__mono {
  font-family: monospace;
  font-size: 0.74rem;
  color: #cfd8dc;
  overflow-wrap: anywhere;
}

.block-body {
  margin-top: var(--space-4);
  overflow: hidden;
}

.block-tabs {
  border-bottom: 1px solid var(--border-subtle);
}

.block-panels {
  min-height: 12rem;
}

.block-empty,
.block-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.block-state__title {
  margin: var(--space-2) 0 0;
  font-size: 1.25rem;
}

.block-state__text {
  margin: var(--space-2) 0 var(--space-4);
  color: #90a4ae;
}

.block-virtual-card__body {
  padding: 0.2rem 0.9rem 0.7rem;
}

.block-raw__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.block-raw__title {
  font-size: 1rem;
  font-weight: 600;
}

.block-raw__hint {
  font-size: 0.78rem;
  color: #90a4ae;
}

.block-footer-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

@media (max-width: 800px) {
  .block-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .block-metric--wide {
    grid-column: span 2;
  }
}

@media (max-width: 599px) {
  .block-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .block-hero__top {
    gap: var(--space-2);
  }

  .block-hero__actions {
    width: 100%;
  }

  .block-hero__actions .q-btn {
    flex: 1;
  }

  .block-metrics {
    gap: 0.4rem;
  }

  .block-metric {
    padding: 0.4rem 0.5rem;
  }

  .block-metric--wide {
    align-items: flex-start;
  }

  .block-metric--wide .block-metric__label {
    flex-basis: 100%;
  }

  .block-metric--wide .block-metric__value {
    flex: 1 1 auto;
  }

  .block-metric__value {
    font-size: 0.9rem;
  }

  .block-footer-nav .q-btn {
    font-size: 0.72rem;
  }
}
</style>
