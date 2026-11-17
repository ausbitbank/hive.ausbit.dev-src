<template>
  <article class="wallet-op" :class="'wallet-op--' + view.tone">
    <div class="wallet-op__row">
      <div class="wallet-op__icon" aria-hidden="true">
        <q-icon :name="view.icon" />
      </div>

      <div class="wallet-op__main">
        <div class="wallet-op__title">
          <span class="wallet-op__label">{{ view.label }}</span>
          <router-link v-if="view.counterparty" :to="'/@' + view.counterparty" class="wallet-op__account">@{{ view.counterparty }}</router-link>
          <q-badge v-if="view.virtual" color="blue-grey-9" class="wallet-op__badge">virtual</q-badge>
        </div>
        <div class="wallet-op__meta">
          <time :datetime="tx.timestamp" :title="absoluteTime">{{ timeLabel }}</time>
          <span aria-hidden="true">·</span>
          <router-link :to="'/b/' + tx.block" class="wallet-op__link">block {{ tx.block }}</router-link>
          <template v-if="transactionId">
            <span aria-hidden="true">·</span>
            <router-link :to="'/tx/' + transactionId" class="wallet-op__link">tx {{ transactionId.slice(0, 8) }}</router-link>
          </template>
        </div>

        <div v-if="displayMemo" class="wallet-op__memo">
          <q-icon name="comment" aria-hidden="true" />
          <span class="wallet-op__memo-text" :title="displayMemo">{{ memoPreview }}</span>
          <q-btn
            v-if="canDecrypt"
            dense
            flat
            no-caps
            size="sm"
            color="primary"
            icon="lock"
            label="Decrypt"
            :aria-label="'Decrypt memo for transaction ' + entryKey"
            @click="$emit('decrypt', { memo: view.memo, entry })"
          />
        </div>
      </div>

      <div class="wallet-op__amount">
        <div v-for="(part, index) in view.parts" :key="index" class="wallet-op__part" :class="partClass(part.sign)">
          {{ signLabel(part.sign) }}{{ part.text }}
        </div>
        <small v-if="usdValue !== null" class="wallet-op__usd">≈ {{ usdValue }}</small>
      </div>

      <q-btn
        flat
        dense
        round
        size="sm"
        :icon="showJson ? 'code_off' : 'data_object'"
        :aria-label="'Toggle raw JSON for ' + view.type"
        title="Toggle raw JSON"
        class="wallet-op__json-toggle"
        @click="showJson = !showJson"
      />
    </div>

    <div v-if="showJson" class="wallet-op__json">
      <json-viewer :data="opData" :deep="1" :showLength="true" />
    </div>
  </article>
</template>

<style scoped>
.wallet-op {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-op:first-child {
  border-top: 0;
}

.wallet-op__row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  min-width: 0;
}

.wallet-op__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 0.1rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  color: #90a4ae;
}

.wallet-op--in .wallet-op__icon {
  background: rgba(76, 175, 80, 0.12);
  color: #81c784;
}

.wallet-op--out .wallet-op__icon {
  background: rgba(239, 83, 80, 0.1);
  color: #e57373;
}

.wallet-op__main {
  flex: 1;
  min-width: 0;
}

.wallet-op__title {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  color: #cfd8dc;
  font-size: 0.84rem;
  line-height: 1.35;
}

.wallet-op__label {
  font-weight: 600;
}

.wallet-op__account,
.wallet-op__link {
  color: #4fc3f7;
  text-decoration: none;
}

.wallet-op__account {
  font-weight: 500;
}

.wallet-op__account:hover,
.wallet-op__link:hover {
  text-decoration: underline;
}

.wallet-op__badge {
  font-size: 0.6rem;
}

.wallet-op__meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
  color: #78909c;
  font-size: 0.68rem;
}

.wallet-op__link {
  font-size: 0.68rem;
}

.wallet-op__memo {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
  color: #90a4ae;
  font-size: 0.72rem;
}

.wallet-op__memo-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(46ch, 100%);
}

.wallet-op__amount {
  flex: none;
  margin-left: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
}

.wallet-op__part {
  color: #cfd8dc;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
}

.wallet-op__part.is-in {
  color: #81c784;
}

.wallet-op__part.is-out {
  color: #e57373;
}

.wallet-op__usd {
  display: block;
  color: #78909c;
  font-size: 0.65rem;
}

.wallet-op__json-toggle {
  flex: none;
  color: #90a4ae;
}

.wallet-op__json {
  margin: 0.45rem 0 0.1rem 2.2rem;
  padding: 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.2);
  overflow-x: auto;
}

@media (max-width: 599px) {
  .wallet-op {
    padding: 0.45rem 0.5rem;
  }

  .wallet-op__row {
    gap: 0.4rem;
  }

  .wallet-op__icon {
    width: 24px;
    height: 24px;
  }

  .wallet-op__amount {
    max-width: 42%;
  }

  .wallet-op__part {
    font-size: 0.76rem;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .wallet-op__memo-text {
    max-width: 100%;
  }

  .wallet-op__json {
    margin-left: 0;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import jsonViewer from 'components/jsonViewer.vue'
import { formatUsd, vestToHive, walletOperationView, walletTransaction, walletTransactionOperation } from 'src/services/wallet'

export default {
  name: 'WalletOperationRow',
  components: { jsonViewer },
  props: {
    entry: { type: Array, required: true },
    username: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    globalProps: { type: Object, default: () => ({ empty: true }) },
    hivePriceUsd: { type: Number, default: 0 },
    hbdPriceUsd: { type: Number, default: 0 },
    decryptedMemos: { type: Object, default: () => ({}) }
  },
  emits: ['decrypt'],
  data () {
    return { showJson: false }
  },
  computed: {
    tx () {
      return walletTransaction(this.entry) || {}
    },
    opData () {
      return walletTransactionOperation(this.entry)[1] || {}
    },
    entryKey () {
      return Array.isArray(this.entry) ? this.entry[0] : this.entry?.index ?? this.tx.trx_id
    },
    view () {
      return walletOperationView(this.entry, {
        username: this.username,
        toHive: vests => vestToHive(vests, this.globalProps)
      })
    },
    displayMemo () {
      return this.decryptedMemos[this.entryKey] || this.view.memo
    },
    memoPreview () {
      return this.displayMemo.length > 90 ? this.displayMemo.slice(0, 90) + '…' : this.displayMemo
    },
    canDecrypt () {
      if (!this.loggedIn || !this.view.memo || !this.view.memo.startsWith('#')) return false
      return this.opData.from === this.username || this.opData.to === this.username
    },
    transactionId () {
      const id = this.tx.trx_id
      if (!id || /^0+$/.test(id) || this.view.virtual) return ''
      return id
    },
    absoluteTime () {
      return this.tx.timestamp ? moment.utc(this.tx.timestamp).format('D MMM YYYY, HH:mm') + ' UTC' : ''
    },
    timeLabel () {
      return this.tx.timestamp ? moment.utc(this.tx.timestamp).format('HH:mm') : ''
    },
    usdValue () {
      if (this.view.parts.length !== 1) return null
      const text = this.view.parts[0].text
      const amount = parseFloat(text.replace(/,/g, ''))
      const token = text.split(' ').pop()
      if (!Number.isFinite(amount)) return null
      if (token === 'HBD') return formatUsd(amount * this.hbdPriceUsd)
      if (token === 'HIVE' || token === 'HP') return formatUsd(amount * this.hivePriceUsd)
      return null
    }
  },
  methods: {
    partClass (sign) {
      if (sign === '+') return 'is-in'
      if (sign === '-') return 'is-out'
      return ''
    },
    signLabel (sign) {
      if (sign === '+') return '+ '
      if (sign === '-') return '− '
      return ''
    }
  }
}
</script>
