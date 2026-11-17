<template>
  <q-page class="tax-page">
    <div class="tax-shell">
      <page-header
        eyebrow="Accounting"
        title="Tax export"
        intro="Analyse wallet history by day, review transfers, rewards, conversions and savings activity, then export a CSV for accounting."
      >
        <template #actions>
          <q-btn
            no-caps
            outline
            color="primary"
            icon="download"
            label="Export CSV"
            :disable="rows.length === 0"
            @click="exportTable"
          />
        </template>
      </page-header>

      <filter-bar>
        <q-input
          v-model="username"
          dense
          outlined
          label="Hive account"
          aria-label="Hive account to analyse"
          class="tax-username"
          @keyup.enter="init"
        />
        <q-btn no-caps unelevated color="primary" icon="analytics" label="Analyse" :loading="loading" @click="init" />
        <q-btn no-caps outline color="primary" icon="history" label="Load 1,000" :disable="!hasLoaded || loading" @click="loadBatches(1)" />
        <q-btn no-caps outline color="primary" icon="history" label="Load 10,000" :disable="!hasLoaded || loading" @click="loadBatches(10)" />
        <template #actions>
          <span class="tax-source">Source: @{{ username || 'account' }} wallet history</span>
        </template>
      </filter-bar>

      <div v-if="errorMessage" class="tax-warning" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        {{ errorMessage }}
        <q-btn flat dense no-caps color="primary" label="Retry" @click="init" />
      </div>

      <q-linear-progress v-if="loading && rows.length > 0" indeterminate color="primary" class="q-mt-sm" />

      <template v-if="rows.length > 0">
        <div class="ui-stat-grid tax-stat-grid">
          <stat-card label="Transactions" :value="formatCount(hiveTransactions.length)" icon="receipt_long" hint="Loaded wallet operations" />
          <stat-card label="Days covered" :value="formatCount(rows.length)" icon="calendar_month" hint="Grouped by UTC date" />
          <stat-card label="Net HIVE" :value="net.hive" unit="HIVE" icon="currency_exchange" :hint="net.hiveHint" />
          <stat-card label="Net HBD" :value="net.hbd" unit="HBD" icon="attach_money" :hint="net.hbdHint" />
          <stat-card label="Net VESTS" :value="net.vests" unit="VESTS" icon="bolt" :hint="vestsHint" />
        </div>

        <div class="tax-table-section">
          <data-table
            :columns="columns"
            :rows="rows"
            row-key="date"
            caption="Account change by day"
            :loading="loading"
            empty-message="No daily totals to show."
          >
            <template #top>
              <span class="tax-table-note">{{ hiveTransactions.length }} transactions · {{ rows.length }} days</span>
            </template>
            <template #cell-hive="{ value }">
              <span :class="valueClass(value)">{{ value }}</span>
            </template>
            <template #cell-hbd="{ value }">
              <span :class="valueClass(value)">{{ value }}</span>
            </template>
            <template #cell-vests="{ value }">
              <span :class="valueClass(value)">{{ value }}</span>
            </template>
            <template #footer>
              <div class="tax-table-footer">
                <span>Amounts are net changes for each UTC day.</span>
                <span v-if="globalProps && !globalProps.empty">VESTS → {{ vestToHive(473719.109) }} HIVE conversion available</span>
              </div>
            </template>
          </data-table>
        </div>

        <q-card flat bordered class="home-card home-panel tax-details">
          <q-card-section class="home-panel__head">
            <div>
              <div class="home-eyebrow">Source data</div>
              <h2 class="home-panel__title">Review the underlying history</h2>
            </div>
          </q-card-section>
          <q-expansion-item dense icon="code" label="Raw transactions" class="tax-expansion">
            <pre class="tax-raw">{{ hiveTransactions }}</pre>
          </q-expansion-item>
          <q-expansion-item dense icon="receipt_long" label="Rendered operations" class="tax-expansion">
            <accountOperations :accountOperations="hiveTransactions" />
          </q-expansion-item>
        </q-card>
      </template>

      <empty-state
        v-else-if="!loading"
        :icon="hasLoaded ? 'receipt_long' : 'search'"
        :title="hasLoaded ? 'No taxable operations found' : 'Choose an account'"
        :message="hasLoaded
          ? 'This account has no transfer, reward, conversion or savings operations in the requested history range.'
          : 'Enter a Hive account name and press Analyse to load wallet history for the CSV export.'"
        :action-label="hasLoaded ? 'Reload' : ''"
        action-icon="refresh"
        @action="init"
      />

      <skeleton v-else :rows="5" label="Loading tax history" />
    </div>
  </q-page>
</template>

<script>
import { exportFile } from 'quasar'
import Moment from 'src/utils/time'
import accountOperations from 'components/accountOperations.vue'
import PageHeader from 'components/ui/PageHeader.vue'
import StatCard from 'components/ui/StatCard.vue'
import EmptyState from 'components/ui/EmptyState.vue'
import Skeleton from 'components/ui/Skeleton.vue'
import DataTable from 'components/ui/DataTable.vue'
import FilterBar from 'components/ui/FilterBar.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'

const op = ChainTypes.operations
const walletBitmask = makeBitMaskFilter([
  op.transfer,
  op.transfer_to_vesting,
  op.withdraw_vesting,
  op.interest,
  op.transfer_to_savings,
  op.transfer_from_savings,
  op.fill_convert_request,
  op.fill_order,
  op.claim_reward_balance,
  op.producer_reward
])

function wrapCsvValue (val, formatFn) {
  let formatted = formatFn !== undefined ? formatFn(val) : val
  formatted = formatted === undefined || formatted === null ? '' : String(formatted)
  formatted = formatted.split('"').join('""')
  return `"${formatted}"`
}

export default {
  name: 'TaxPage',
  components: { accountOperations, PageHeader, StatCard, EmptyState, Skeleton, DataTable, FilterBar },
  data () {
    return {
      username: this.$route.query.user || '',
      hiveTransactions: [],
      bitmask: walletBitmask,
      accountHistoryPointer: -1,
      accountHistoryLimit: 1000,
      loading: false,
      hasLoaded: false,
      errorMessage: '',
      columns: [
        { name: 'date', key: 'date', required: true, label: 'Date (YMD)' },
        { name: 'hive', key: 'hive', label: 'HIVE', align: 'right' },
        { name: 'hbd', key: 'hbd', label: 'HBD', align: 'right' },
        { name: 'vests', key: 'vests', label: 'VESTS', align: 'right' }
      ]
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    hiveTransactionsByDay () {
      if (this.hiveTransactions.length === 0) return []
      const tidy = []
      this.hiveTransactions.forEach(item => {
        const timestamp = item?.[1]?.timestamp
        const op = item?.[1]?.op
        if (!timestamp || !Array.isArray(op)) return
        const date = new Moment(timestamp).format('YYYYMMDD')
        const existing = tidy.find(day => day.date === date)
        if (existing) existing.transactions.push(op)
        else tidy.push({ date, transactions: [op] })
      })
      return tidy
    },
    rows () {
      return this.hiveTransactionsByDay.map(day => {
        let hive = 0
        let hbd = 0
        let vests = 0
        day.transactions.forEach(tx => {
          const type = tx[0]
          const data = tx[1] || {}
          switch (type) {
            case 'claim_reward_balance':
              if (data.account === this.username) {
                hive += parseFloat(data.reward_hive || 0)
                hbd += parseFloat(data.reward_hbd || 0)
                vests += parseFloat(data.reward_vests || 0)
              }
              break
            case 'producer_reward':
              if (data.producer === this.username) vests += parseFloat(data.vesting_shares || 0)
              break
            case 'transfer':
              if (data.from === this.username && data.to !== this.username) {
                if (data.amount?.endsWith('HIVE')) hive -= parseFloat(data.amount)
                else if (data.amount?.endsWith('HBD')) hbd -= parseFloat(data.amount)
              }
              if (data.to === this.username && data.from !== this.username) {
                if (data.amount?.endsWith('HIVE')) hive += parseFloat(data.amount)
                else if (data.amount?.endsWith('HBD')) hbd += parseFloat(data.amount)
              }
              break
          }
        })
        return {
          date: day.date,
          hive: hive.toFixed(3),
          hbd: hbd.toFixed(3),
          vests: vests.toFixed(3)
        }
      })
    },
    net () {
      const total = this.rows.reduce((acc, row) => {
        acc.hive += parseFloat(row.hive)
        acc.hbd += parseFloat(row.hbd)
        acc.vests += parseFloat(row.vests)
        return acc
      }, { hive: 0, hbd: 0, vests: 0 })
      return {
        hive: total.hive.toFixed(3),
        hbd: total.hbd.toFixed(3),
        vests: total.vests.toFixed(3),
        hiveHint: total.hive >= 0 ? 'Net inflow across the loaded range' : 'Net outflow across the loaded range',
        hbdHint: total.hbd >= 0 ? 'Net inflow across the loaded range' : 'Net outflow across the loaded range'
      }
    },
    vestsHint () {
      const hve = this.globalProps && !this.globalProps.empty
      return hve ? 'Staked rewards; convert to HIVE using the current vesting rate' : 'Staked rewards'
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive tax export — wallet transaction history',
      description: 'Export Hive wallet transaction history as CSV for accounting and tax reporting, including transfers, rewards and conversions.',
      url: this.$route.path
    })
    if (this.globalProps.empty) this.$hiveStore.getGlobalProps()
    if (this.username) this.init()
  },
  methods: {
    formatCount (value) {
      return Number(value || 0).toLocaleString('en-US')
    },
    valueClass (value) {
      const number = Number(value)
      if (number > 0) return 'tax-positive'
      if (number < 0) return 'tax-negative'
      return ''
    },
    vestToHive (vests) {
      if (!this.globalProps || this.globalProps.empty) return '—'
      return this.$hive.formatter
        .vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive)
        .toFixed(3)
    },
    init () {
      const name = String(this.username || '').trim().replace(/^@/, '')
      if (!name) {
        this.errorMessage = 'Enter a Hive account name first.'
        return
      }
      this.username = name
      this.hiveTransactions = []
      this.accountHistoryPointer = -1
      this.hasLoaded = false
      this.errorMessage = ''
      this.loadBatches(1)
    },
    async loadBatches (count) {
      if (!this.username || this.loading) return
      this.loading = true
      this.errorMessage = ''
      try {
        for (let i = 0; i < count; i++) {
          const more = await this.loadHistoryPage()
          if (!more) break
        }
        this.hasLoaded = true
      } catch (error) {
        console.error('Failed to load tax history', error)
        this.errorMessage = 'Could not load account history. Please retry or load fewer transactions.'
      } finally {
        this.loading = false
      }
    },
    async loadHistoryPage () {
      let response
      try {
        response = await this.$hive.api.callAsync(
          'call',
          ['condenser_api', 'get_account_history', [this.username, this.accountHistoryPointer, this.accountHistoryLimit, ...this.bitmask]]
        )
      } catch (error) {
        const sequence = error?.data?.stack?.[0]?.data?.sequence
        const message = error?.cause?.message || error?.message || ''
        if (sequence && message.includes('Could not find filtered operation in')) {
          this.accountHistoryPointer = sequence
          return true
        }
        throw error
      }
      if (!Array.isArray(response) || response.length === 0) return false
      this.accountHistoryPointer = parseInt(response[0][0]) - 1
      this.hiveTransactions = this.hiveTransactions.concat([...response].reverse())
      return response.length >= this.accountHistoryLimit
    },
    exportTable () {
      if (this.rows.length === 0) return
      const content = [this.columns.map(col => wrapCsvValue(col.label))]
        .concat(this.rows.map(row => this.columns.map(col => wrapCsvValue(row[col.key])).join(',')))
        .join('\r\n')
      const status = exportFile('account-history-export.csv', content, 'text/csv')
      if (status !== true) {
        this.$q.notify({ message: 'Browser denied the file download.', color: 'negative', icon: 'warning' })
      }
    }
  }
}
</script>

<style scoped>
.tax-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.tax-shell {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.tax-username {
  flex: 1 1 220px;
  min-width: 0;
}

.tax-source {
  color: #78909c;
  font-size: 0.7rem;
}

.tax-warning {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: var(--space-3);
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(255, 183, 77, 0.35);
  border-radius: var(--radius-sm);
  color: #ffb74d;
  font-size: 0.75rem;
}

.ui-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.tax-stat-grid {
  margin-top: var(--space-3);
}

.tax-table-section {
  margin-top: var(--space-4);
}

.tax-table-note {
  color: #78909c;
  font-size: 0.7rem;
}

.tax-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tax-positive {
  color: #81c784;
  font-weight: 600;
}

.tax-negative {
  color: #ef9a9a;
  font-weight: 600;
}

.tax-details {
  margin-top: var(--space-4);
}

.tax-expansion {
  border-top: 1px solid var(--border-subtle);
}

.tax-raw {
  max-height: 300px;
  margin: 0;
  padding: 0.75rem 1rem;
  overflow: auto;
  color: #90a4ae;
  font-size: 0.7rem;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 599px) {
  .tax-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>
