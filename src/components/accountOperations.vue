<template>
  <div class="account-operations">
    <q-card v-for="entry in accountOperations" :key="entry[0]" flat bordered class="account-operation">
      <q-card-section class="account-operation__meta">
        <span class="account-operation__index">#{{ entry[0] }}</span>
        <time :datetime="entry[1].timestamp" :title="absoluteTime(entry[1].timestamp)">{{ timeLabel(entry[1].timestamp) }}</time>
        <q-space />
        <q-badge v-if="entry[1].virtual_op" color="blue-grey-9">virtual</q-badge>
        <router-link :to="blockLink(entry[1])" class="account-operation__link">block {{ tidyNumber(entry[1].block) }}</router-link>
        <router-link v-if="transactionId(entry[1])" :to="'/tx/' + transactionId(entry[1])" class="account-operation__link">
          tx {{ transactionId(entry[1]).slice(0, 8) }}
        </router-link>
      </q-card-section>
      <q-card-section class="account-operation__body">
        <block-operation :operation="{ op: entry[1].op }" :virtual="Boolean(entry[1].virtual_op)" />
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped>
.account-operations {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.account-operation {
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.account-operation__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.4rem 0.8rem;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.025);
  color: #78909c;
  font-size: 0.7rem;
}

.account-operation__index {
  color: #90a4ae;
  font-family: monospace;
}

.account-operation__link {
  color: #4fc3f7;
  text-decoration: none;
}

.account-operation__link:hover {
  text-decoration: underline;
}

.account-operation__body {
  padding: 0.15rem 0.8rem 0.25rem;
}

.account-operation__body :deep(.block-op) {
  border-top: 0;
}
</style>

<script>
import moment from 'src/utils/time'
import BlockOperation from 'components/BlockOperation.vue'

const EMPTY_TX = '0000000000000000000000000000000000000000'

export default {
  name: 'accountOperations',
  components: { BlockOperation },
  props: ['accountOperations'],
  methods: {
    transactionId (entry) {
      return entry && entry.trx_id && entry.trx_id !== EMPTY_TX ? entry.trx_id : ''
    },
    blockLink (entry) {
      const tx = this.transactionId(entry)
      return '/b/' + entry.block + (tx ? '#' + tx : '')
    },
    timeLabel (timestamp) {
      return timestamp ? moment.utc(timestamp).fromNow() : ''
    },
    absoluteTime (timestamp) {
      return timestamp ? moment.utc(timestamp).format('D MMM YYYY, HH:mm') + ' UTC' : ''
    },
    tidyNumber (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString('en-US') : ''
    }
  }
}
</script>
