<template>
  <q-card flat bordered class="block-tx" :id="txId">
    <q-card-section class="block-tx__head">
      <div class="block-tx__index">Tx #{{ index + 1 }}</div>
      <router-link :to="'/tx/' + txId" class="block-tx__id" :title="txId">{{ shortId }}</router-link>
      <q-badge color="blue-grey-9" class="block-tx__ops">{{ operations.length }} op{{ operations.length === 1 ? '' : 's' }}</q-badge>
      <q-space />
      <q-btn
        flat
        dense
        round
        size="sm"
        icon="content_copy"
        aria-label="Copy transaction id"
        title="Copy transaction id"
        @click="copyId"
      />
      <q-btn
        flat
        dense
        round
        size="sm"
        :icon="collapsed ? 'expand_more' : 'expand_less'"
        :aria-label="collapsed ? 'Expand transaction' : 'Collapse transaction'"
        :title="collapsed ? 'Expand transaction' : 'Collapse transaction'"
        @click="collapsed = !collapsed"
      />
    </q-card-section>

    <q-slide-transition>
      <div v-show="!collapsed" class="block-tx__ops-list">
        <block-operation
          v-for="(operation, opIndex) in operations"
          :key="opIndex"
          :operation="{ op: operation }"
        />
      </div>
    </q-slide-transition>
  </q-card>
</template>

<script>
import { copyToClipboard } from 'quasar'
import BlockOperation from 'components/BlockOperation.vue'

export default {
  name: 'block-transaction',
  components: { BlockOperation },
  props: {
    transaction: { type: Object, required: true },
    index: { type: Number, required: true }
  },
  data () {
    return { collapsed: false }
  },
  computed: {
    txId () {
      return this.transaction?.transaction_id || ''
    },
    shortId () {
      return this.txId ? this.txId.slice(0, 12) + '…' : 'unknown transaction'
    },
    operations () {
      return this.transaction?.operations || []
    }
  },
  methods: {
    copyId () {
      copyToClipboard(this.txId)
      this.$q.notify({ type: 'positive', message: 'Transaction id copied' })
    }
  }
}
</script>

<style scoped>
.block-tx {
  margin-bottom: var(--space-3);
  overflow: hidden;
  scroll-margin-top: 84px;
}

.block-tx__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  background: rgba(255, 255, 255, 0.035);
}

.block-tx__index {
  font-size: 0.75rem;
  color: #90a4ae;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.block-tx__id {
  font-family: monospace;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64b5f6;
  overflow-wrap: anywhere;
}

.block-tx__id:visited {
  color: #ce93d8;
}

.block-tx__ops {
  font-size: 0.68rem;
}

.block-tx__ops-list {
  padding: 0.2rem 0.9rem 0.6rem;
}

@media (max-width: 599px) {
  .block-tx__head {
    padding: 0.5rem 0.65rem;
  }

  .block-tx__id {
    font-size: 0.72rem;
  }

  .block-tx__ops-list {
    padding: 0.2rem 0.65rem 0.5rem;
  }
}
</style>
