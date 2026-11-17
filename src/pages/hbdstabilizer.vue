<template>
  <q-page class="stabilizer-page">
    <div class="stabilizer-shell">
      <page-header
        eyebrow="Hive DAO"
        title="HBD Stabilizer"
        :live="!loading"
        intro="@hbdstabilizer is a project by @smooth that uses HBD from @hive.fund to buy HIVE and return it to @hive.fund when HBD trades above its $1 fair value."
      >
        <template #actions>
          <q-btn no-caps outline color="primary" icon="attach_money" label="HBD monitor" to="/hbd" />
          <q-btn flat round dense icon="refresh" aria-label="Refresh HBD stabilizer" title="Refresh HBD stabilizer" :loading="loading" @click="refreshAll" />
        </template>
      </page-header>

      <div v-if="loadError" class="stabilizer-warning" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        {{ loadError }}
        <q-btn flat dense no-caps color="primary" label="Retry" @click="refreshAll" />
      </div>

      <skeleton v-if="loading && accountRows.length === 0" :rows="5" label="Loading HBD stabilizer" />

      <template v-else>
        <div class="ui-stat-grid">
          <stat-card label="DAO value" :value="daoValueLabel" icon="account_balance" :hint="'HIVE + HBD + HP across the three accounts'" />
          <stat-card label="Stabilizer HBD" :value="stabilizerHbdLabel" unit="HBD" icon="attach_money" :hint="'Available for stabilizer orders'" />
          <stat-card label="Open orders" :value="openOrderRows.length" icon="list_alt" :status-label="openOrderRows.length ? 'Active' : 'None'" :status-color="openOrderRows.length ? 'orange' : 'green'" hint="HIVE / HBD limit orders" />
          <stat-card label="HIVE median price" :value="medianLabel" icon="price_change" :hint="'Used to value HBD and HP'" />
        </div>

        <section class="stabilizer-section" aria-labelledby="stabilizer-accounts-title">
          <div class="stabilizer-section__head">
            <div>
              <div class="home-eyebrow">Treasury</div>
              <h2 id="stabilizer-accounts-title" class="stabilizer-section__title">Accounts</h2>
            </div>
            <span class="stabilizer-section__hint">Balances are read from the chain and valued at the median HIVE price.</span>
          </div>
          <data-table
            :columns="accountColumns"
            :rows="accountRows"
            row-key="account"
            caption="HBD stabilizer and related account balances"
            :loading="loading"
            empty-message="Account balances are unavailable."
          >
            <template #cell-account="{ row }">
              <router-link :to="'/@' + row.account" class="stabilizer-account-link">@{{ row.account }}</router-link>
            </template>
            <template #cell-hive="{ value }">{{ value }} HIVE</template>
            <template #cell-hbd="{ value }">{{ value }} HBD</template>
            <template #cell-hp="{ value }">{{ value }} HP</template>
            <template #cell-value="{ value }">{{ value }}</template>
            <template #footer>
              <span>Estimated value based on HIVE {{ medianLabel }} and HBD at $1.</span>
            </template>
          </data-table>
        </section>

        <section class="stabilizer-section" aria-labelledby="stabilizer-orders-title">
          <div class="stabilizer-section__head">
            <div>
              <div class="home-eyebrow">Market</div>
              <h2 id="stabilizer-orders-title" class="stabilizer-section__title">Open market orders</h2>
            </div>
            <router-link to="/market" class="stabilizer-link">Internal market</router-link>
          </div>
          <data-table
            :columns="orderColumns"
            :rows="openOrderRows"
            row-key="id"
            caption="HBD stabilizer open market orders"
            :loading="loading"
            empty-icon="check_circle"
            empty-message="hbdstabilizer has no outstanding market orders."
          >
            <template #cell-side="{ value }">
              <span :class="value === 'buy' ? 'stabilizer-buy' : 'stabilizer-sell'">{{ value === 'buy' ? 'Buy HIVE' : 'Sell HIVE' }}</span>
            </template>
            <template #cell-amount="{ row }">{{ formatAmount(row.amount) }} {{ row.asset }}</template>
            <template #cell-receive="{ row }">{{ formatAmount(row.receive) }} {{ row.receiveAsset }}</template>
            <template #cell-price="{ value }">{{ formatPrice(value) }}</template>
            <template #cell-expiry="{ value }">{{ expiryLabel(value) }}</template>
          </data-table>
        </section>

        <section class="stabilizer-section" aria-labelledby="stabilizer-history-title">
          <div class="stabilizer-section__head">
            <div>
              <div class="home-eyebrow">History</div>
              <h2 id="stabilizer-history-title" class="stabilizer-section__title">Recent transactions</h2>
            </div>
            <span class="stabilizer-section__hint">Transfers, proposals, fills, conversions and interest.</span>
          </div>
          <q-card flat bordered class="home-card home-panel stabilizer-history">
            <div v-if="historyLoading && hiveTransactions.length === 0" class="stabilizer-history__loading">
              <q-skeleton type="text" v-for="i in 5" :key="i" />
            </div>
            <div v-else-if="hiveTransactions.length === 0" class="stabilizer-history__empty">
              <q-icon name="receipt_long" size="24px" color="grey" aria-hidden="true" />
              <span>No matching stabilizer operations found.</span>
            </div>
            <q-scroll-area v-else style="height: 420px; max-width: 100%">
              <account-operations :account-operations="hiveTransactions" />
            </q-scroll-area>
            <q-card-section class="home-panel__footer">
              <span>Latest {{ hiveTransactions.length }} matching operations<span v-if="updatedLabel"> · {{ updatedLabel }}</span></span>
              <q-btn flat dense no-caps color="primary" icon="refresh" label="Reload history" :loading="historyLoading" @click="loadHistory({ reset: true })" />
            </q-card-section>
          </q-card>
        </section>
      </template>
    </div>
  </q-page>
</template>

<script>
import moment from 'src/utils/time'
import VueTimers from 'src/mixins/timers.js'
import accountOperations from 'components/accountOperations.vue'
import PageHeader from 'components/ui/PageHeader.vue'
import StatCard from 'components/ui/StatCard.vue'
import Skeleton from 'components/ui/Skeleton.vue'
import DataTable from 'components/ui/DataTable.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccounts, fetchMedianHistoryPrice, fetchOpenOrders } from 'src/services/chainData'
import { normalizeOpenOrders, formatAmount, formatPrice } from 'src/services/market'
import { medianPrice, parseAsset } from 'src/services/network'
import { vestToHive as vestToHiveValue } from 'src/services/wallet'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'

const op = ChainTypes.operations
const stabilizerBitmask = makeBitMaskFilter([
  op.transfer,
  op.withdraw_vesting,
  op.interest,
  op.fill_convert_request,
  op.fill_order,
  op.limit_order_create,
  op.proposal_pay,
  op.convert
])

const ACCOUNTS = ['hive.fund', 'hbdstabilizer', 'hbd.funder']

export default {
  name: 'HbdStabilizerPage',
  components: { accountOperations, PageHeader, StatCard, Skeleton, DataTable },
  mixins: [VueTimers],
  timers: {
    refreshStabilizer: { time: 60000, autostart: true, repeat: true, immediate: true }
  },
  data () {
    return {
      accounts: [],
      openOrders: [],
      medianHistory: null,
      loading: true,
      loadError: '',
      historyLoading: false,
      hiveTransactions: [],
      accountHistoryPointer: -1,
      accountHistoryLimit: 100,
      bitmask: stabilizerBitmask,
      lastUpdated: null
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    medianHiveUsd () {
      return medianPrice(this.medianHistory).hiveUsd
    },
    medianLabel () {
      return this.medianHiveUsd > 0 ? '$' + this.medianHiveUsd.toFixed(4) : '—'
    },
    accountRows () {
      return ACCOUNTS.map(name => {
        const account = this.accounts.find(item => item?.name === name)
        if (!account) return null
        const hive = parseAsset(account.balance)
        const hbd = parseAsset(account.hbd_balance)
        const hp = vestToHiveValue(parseAsset(account.vesting_shares), this.globalProps)
        const value = hive * this.medianHiveUsd + hbd
        return {
          account: name,
          hive: hive.toFixed(3),
          hbd: hbd.toFixed(3),
          hp: hp.toFixed(3),
          value: '$' + value.toFixed(2)
        }
      }).filter(Boolean)
    },
    accountColumns () {
      return [
        { key: 'account', label: 'Account' },
        { key: 'hive', label: 'HIVE', align: 'right' },
        { key: 'hbd', label: 'HBD', align: 'right' },
        { key: 'hp', label: 'HP', align: 'right' },
        { key: 'value', label: 'Value', align: 'right' }
      ]
    },
    openOrderRows () {
      return normalizeOpenOrders(this.openOrders)
    },
    orderColumns () {
      return [
        { key: 'side', label: 'Side' },
        { key: 'amount', label: 'Sell', align: 'right' },
        { key: 'receive', label: 'Receive', align: 'right' },
        { key: 'price', label: 'Price', align: 'right' },
        { key: 'expiry', label: 'Expires', align: 'right' }
      ]
    },
    daoValueLabel () {
      const total = this.accountRows.reduce((sum, row) => sum + parseFloat(row.value.replace('$', '')), 0)
      return '$' + total.toFixed(2)
    },
    stabilizerHbdLabel () {
      const row = this.accountRows.find(item => item.account === 'hbdstabilizer')
      return row ? row.hbd : '—'
    },
    updatedLabel () {
      return this.lastUpdated ? moment.utc(this.lastUpdated).fromNow() : ''
    }
  },
  mounted () {
    setPageMeta({
      title: 'HBD Stabilizer monitor — Hive DAO conversions',
      description: 'Track the HBD Stabilizer: DAO and stabilizer balances, open market orders and conversion transactions on the Hive blockchain.',
      url: '/hbdstabilizer'
    })
    if (this.globalProps.empty) this.$hiveStore.getGlobalProps()
    this.loadHistory()
  },
  methods: {
    formatAmount,
    formatPrice,
    refreshStabilizer () {
      return this.load()
    },
    expiryLabel (value) {
      return value ? moment.utc(value).fromNow() : '—'
    },
    refreshAll () {
      this.load({ force: true })
      this.loadHistory({ reset: true })
    },
    async load ({ force = false } = {}) {
      this.loading = this.accountRows.length === 0
      this.loadError = ''
      const results = await Promise.allSettled([
        fetchAccounts(ACCOUNTS, { force }),
        fetchOpenOrders('hbdstabilizer', { force }),
        fetchMedianHistoryPrice({ force }),
        this.$hiveStore.getGlobalProps({ force })
      ])

      if (results[0].status === 'fulfilled') this.accounts = results[0].value
      if (results[1].status === 'fulfilled') this.openOrders = results[1].value || []
      if (results[2].status === 'fulfilled') this.medianHistory = results[2].value

      const failed = results.some(result => result.status === 'rejected')
      if (failed) this.loadError = 'Some stabilizer data could not be loaded. Showing the latest available values.'
      this.lastUpdated = Date.now()
      this.loading = false
    },
    async loadHistory ({ reset = false } = {}) {
      if (this.historyLoading) return
      this.historyLoading = true
      if (reset) {
        this.hiveTransactions = []
        this.accountHistoryPointer = -1
      }
      try {
        const response = await this.$hive.api.callAsync(
          'call',
          ['condenser_api', 'get_account_history', ['hbdstabilizer', this.accountHistoryPointer, this.accountHistoryLimit, ...this.bitmask]]
        )
        if (Array.isArray(response) && response.length > 0) {
          this.accountHistoryPointer = parseInt(response[0][0]) - 1
          this.hiveTransactions = this.hiveTransactions.concat([...response].reverse())
        }
      } catch (error) {
        const sequence = error?.data?.stack?.[0]?.data?.sequence
        const message = error?.cause?.message || error?.message || ''
        if (sequence && message.includes('Could not find filtered operation in')) {
          this.accountHistoryPointer = sequence
        } else {
          console.error('Failed to load stabilizer history', error)
        }
      } finally {
        this.historyLoading = false
      }
    }
  }
}
</script>

<style scoped>
.stabilizer-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.stabilizer-shell {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.ui-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.stabilizer-warning {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(255, 183, 77, 0.35);
  border-radius: var(--radius-sm);
  color: #ffb74d;
  font-size: 0.75rem;
}

.stabilizer-section {
  margin-top: var(--space-5);
}

.stabilizer-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.stabilizer-section__title {
  margin: 0;
  color: #e4eaed;
  font-size: 1.08rem;
  font-weight: 600;
}

.stabilizer-section__hint {
  color: #78909c;
  font-size: 0.74rem;
}

.stabilizer-link,
.stabilizer-account-link {
  color: #4fc3f7;
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
}

.stabilizer-link:hover,
.stabilizer-account-link:hover {
  text-decoration: underline;
}

.stabilizer-buy {
  color: #81c784;
  font-weight: 600;
}

.stabilizer-sell {
  color: #ef9a9a;
  font-weight: 600;
}

.stabilizer-history__loading,
.stabilizer-history__empty {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem 1rem;
}

.stabilizer-history__empty {
  align-items: center;
  color: #90a4ae;
  font-size: 0.8rem;
}

@media (max-width: 599px) {
  .stabilizer-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .stabilizer-section__hint {
    display: none;
  }
}
</style>
