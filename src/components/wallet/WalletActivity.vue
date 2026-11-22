<template>
  <q-card flat bordered class="wallet-card wallet-activity">
    <q-card-section class="wallet-card__head">
      <div>
        <div class="wallet-eyebrow">{{ eyebrow }}</div>
        <h2 :id="headingId" class="wallet-card__title">{{ title }}</h2>
      </div>
      <div class="wallet-activity__head-actions">
        <q-btn
          v-if="entries.length"
          flat
          dense
          no-caps
          color="primary"
          icon="download"
          label="CSV"
          aria-label="Export loaded activity as CSV"
          title="Export loaded activity as CSV"
          @click="exportCsv"
        />
        <q-btn v-if="limit" flat dense no-caps color="primary" icon-right="arrow_forward" label="View all" @click="$emit('navigate', 'activity')" />
      </div>
    </q-card-section>

    <div v-if="filterable" class="wallet-activity__filters">
      <q-select
        v-model="category"
        :options="categories"
        option-label="label"
        option-value="value"
        emit-value
        map-options
        dense
        outlined
        label="Type"
        aria-label="Filter transactions by type"
        class="wallet-activity__filter"
      />
      <q-select
        v-model="direction"
        :options="directions"
        option-label="label"
        option-value="value"
        emit-value
        map-options
        dense
        outlined
        label="Direction"
        aria-label="Filter transactions by direction"
        class="wallet-activity__filter wallet-activity__filter--narrow"
      />
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        debounce="250"
        label="Search memo, account or tx"
        aria-label="Search wallet transactions"
        class="wallet-activity__filter wallet-activity__filter--search"
      />
      <q-btn v-if="isFiltering" flat dense no-caps color="grey" label="Clear" icon="close" @click="clearFilters" />
      <span class="wallet-activity__count">{{ filtered.length }} of {{ entries.length }} loaded</span>
    </div>

    <div class="wallet-activity__body">
      <div v-if="loading && !entries.length" class="wallet-activity__state" aria-label="Loading transactions">
        <q-skeleton type="rect" height="38px" />
        <q-skeleton type="rect" height="38px" />
        <q-skeleton type="rect" height="38px" />
      </div>

      <div v-else-if="!visible.length" class="wallet-activity__empty">
        <q-icon name="receipt_long" size="1.5em" aria-hidden="true" />
        <span>{{ isFiltering ? 'No transactions match these filters.' : 'No wallet transactions are available yet.' }}</span>
      </div>

      <template v-else>
        <section v-for="group in groups" :key="group.date" class="wallet-op-group" :aria-label="dateLabel(group.date)">
          <h3 class="wallet-op-group__date">{{ dateLabel(group.date) }}</h3>
          <wallet-operation-row
            v-for="entry in group.entries"
            :key="entry[0]"
            :entry="entry"
            :username="username"
            :logged-in="loggedIn"
            :global-props="globalProps"
            :hive-price-usd="hivePriceUsd"
            :hbd-price-usd="hbdPriceUsd"
            :decrypted-memos="decryptedMemos"
            @decrypt="$emit('decrypt', $event)"
          />
        </section>
      </template>

      <div v-if="!limit && hasMore" class="wallet-activity__load">
        <q-btn
          no-caps
          outline
          color="primary"
          icon="expand_more"
          :loading="loading"
          label="Load older activity"
          aria-label="Load older wallet activity"
          @click="$emit('load')"
        />
      </div>
    </div>

    <div class="wallet-activity__footer">
      <span v-if="limit">Showing the latest {{ visible.length }} of {{ filtered.length }} loaded</span>
      <span v-else>{{ filtered.length }} transaction{{ filtered.length === 1 ? '' : 's' }} shown</span>
      <span v-if="filterable && hasMore" class="wallet-activity__more">Older activity can be loaded on demand</span>
    </div>
  </q-card>
</template>

<style scoped>
.wallet-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.wallet-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.wallet-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.wallet-card__title {
  margin: 0.12rem 0 0;
  color: var(--c-text);
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
}

.wallet-activity__head-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.wallet-activity__filters {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.wallet-activity__filter {
  min-width: 140px;
}

.wallet-activity__filter--narrow {
  min-width: 120px;
  max-width: 150px;
}

.wallet-activity__filter--search {
  flex: 1;
  min-width: 190px;
}

.wallet-activity__count {
  margin-left: auto;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  white-space: nowrap;
}

.wallet-activity__body {
  padding: 0.15rem 0;
}

.wallet-activity__state {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem;
}

.wallet-activity__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 1.4rem 1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  text-align: center;
}

.wallet-op-group__date {
  margin: 0;
  padding: 0.5rem 0.8rem 0.3rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.wallet-op-group + .wallet-op-group {
  border-top: 1px solid var(--border-subtle);
}

.wallet-activity__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.9rem 0.6rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.wallet-activity__more {
  color: var(--c-text-faint);
}

.wallet-activity__load {
  display: flex;
  justify-content: center;
  padding: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

@media (max-width: 599px) {
  .wallet-card__head {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-activity__filters {
    padding: 0.55rem;
  }

  .wallet-activity__filter,
  .wallet-activity__filter--narrow {
    flex: 1 1 100%;
    max-width: none;
  }

  .wallet-activity__count {
    margin-left: 0;
  }

  .wallet-op-group__date {
    padding-left: 0.55rem;
  }

  .wallet-activity__footer {
    padding-left: 0.6rem;
    padding-right: 0.6rem;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import WalletOperationRow from 'components/wallet/WalletOperationRow.vue'
import { WALLET_ACTIVITY_CATEGORIES, filterWalletTransactions, groupWalletTransactions } from 'src/services/wallet'
import { buildWalletCsv, walletCsvName } from 'src/services/walletExport'

export default {
  name: 'WalletActivity',
  components: { WalletOperationRow },
  props: {
    headingId: { type: String, default: 'wallet-activity-title' },
    title: { type: String, default: 'Activity' },
    eyebrow: { type: String, default: 'History' },
    entries: { type: Array, default: () => [] },
    username: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    globalProps: { type: Object, default: () => ({ empty: true }) },
    hivePriceUsd: { type: Number, default: 0 },
    hbdPriceUsd: { type: Number, default: 0 },
    decryptedMemos: { type: Object, default: () => ({}) },
    limit: { type: Number, default: 0 },
    filterable: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    hasMore: { type: Boolean, default: false }
  },
  emits: ['load', 'decrypt', 'navigate'],
  data () {
    return {
      category: 'all',
      direction: 'all',
      search: '',
      categories: WALLET_ACTIVITY_CATEGORIES,
      directions: [
        { label: 'All directions', value: 'all' },
        { label: 'Incoming', value: 'in' },
        { label: 'Outgoing', value: 'out' },
        { label: 'Neutral', value: 'neutral' }
      ]
    }
  },
  computed: {
    filtered () {
      if (!this.filterable) return this.entries
      return filterWalletTransactions(this.entries, {
        username: this.username,
        category: this.category,
        direction: this.direction,
        search: this.search
      })
    },
    visible () {
      return this.limit ? this.filtered.slice(0, this.limit) : this.filtered
    },
    groups () {
      return groupWalletTransactions(this.visible)
    },
    isFiltering () {
      return this.category !== 'all' || this.direction !== 'all' || this.search.trim() !== ''
    }
  },
  methods: {
    dateLabel (date) {
      if (!date || date === 'unknown') return 'Unknown date'
      const day = moment.utc(date)
      const today = moment.utc()
      if (day.isSame(today, 'day')) return 'Today'
      if (day.isSame(today.subtract(1, 'day'), 'day')) return 'Yesterday'
      return day.format('D MMMM YYYY')
    },
    clearFilters () {
      this.category = 'all'
      this.direction = 'all'
      this.search = ''
    },
    exportCsv () {
      if (!this.entries.length) return
      const csv = buildWalletCsv(this.filtered, { username: this.username })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = walletCsvName(this.username)
      link.click()
      URL.revokeObjectURL(url)
      this.$q.notify({
        message: 'Wallet CSV exported (' + this.filtered.length + ' loaded rows).',
        color: 'primary',
        icon: 'download',
        timeout: 3000,
        position: 'top'
      })
    },
  }
}
</script>
