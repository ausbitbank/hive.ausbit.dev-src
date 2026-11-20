<template>
  <section v-if="hasAssets" id="magi" class="wallet-section" aria-labelledby="wallet-magi-title">
    <q-card flat bordered class="wallet-card wallet-magi">
      <q-card-section class="wallet-card__head">
        <div>
          <div class="wallet-eyebrow">Sidechain</div>
          <h2 id="wallet-magi-title" class="wallet-card__title">Magi Network</h2>
          <p class="wallet-magi__hint">
            HIVE and HBD held on Magi (formerly VSC). These balances are separate from your
            Hive wallet and are used by Magi apps and contracts.
          </p>
        </div>
        <div class="wallet-magi__actions">
          <q-btn flat round dense icon="refresh" aria-label="Refresh Magi balances" title="Refresh Magi balances" :loading="loading" @click="load" />
          <a href="https://altera.magi.eco" target="_blank" rel="noopener noreferrer" class="wallet-magi__link">
            Open Altera <q-icon name="open_in_new" size="13px" aria-hidden="true" />
          </a>
        </div>
      </q-card-section>

      <q-banner v-if="error" class="wallet-magi__banner" rounded>
        <template #avatar><q-icon name="cloud_off" aria-hidden="true" /></template>
        {{ error }}
        <template #action><q-btn flat no-caps color="primary" label="Retry" @click="load" /></template>
      </q-banner>

      <div v-else-if="loading && !balances" class="wallet-magi__state" aria-label="Loading Magi balances">
        <q-spinner-puff color="primary" size="2em" />
        <span>Reading Magi Network balances…</span>
      </div>

      <template v-else-if="balances">
        <div class="wallet-magi__total">
          <span>Magi portfolio value</span>
          <strong>{{ formatUsd(totalUsd) }}</strong>
        </div>

        <div class="wallet-magi__grid">
          <div v-for="row in rows" :key="row.id" class="wallet-magi__cell">
            <span>{{ row.label }}</span>
            <strong>{{ row.amount }}</strong>
            <small>{{ formatUsd(row.usd) }}</small>
          </div>
        </div>

        <div v-if="transactions.length" class="wallet-magi__activity">
          <div class="wallet-magi__activity-title">Recent Magi activity</div>
          <ul>
            <li v-for="entry in transactions.slice(0, 5)" :key="entry.id">
              <q-icon :name="entry.direction === 'out' ? 'north_east' : 'south_west'" size="14px" aria-hidden="true" />
              <span class="wallet-magi__activity-label">{{ entry.label }}</span>
              <span class="wallet-magi__activity-amount" :class="entry.direction === 'out' ? 'is-out' : 'is-in'">{{ entry.amountLabel }}</span>
              <time :datetime="entry.timestamp">{{ timeLabel(entry.timestamp) }}</time>
            </li>
          </ul>
        </div>
      </template>
    </q-card>
  </section>
</template>

<style scoped>
.wallet-magi__hint {
  margin: 0.3rem 0 0;
  max-width: 70ch;
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.45;
}

.wallet-magi__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.wallet-magi__link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: #4fc3f7;
  font-size: 0.74rem;
  font-weight: 600;
  text-decoration: none;
}

.wallet-magi__link:hover {
  text-decoration: underline;
}

.wallet-magi__banner {
  margin: 0 0.85rem 0.6rem;
}

.wallet-magi__state {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 1rem 0.9rem;
  color: #90a4ae;
  font-size: 0.8rem;
}

.wallet-magi__total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.9rem 0.6rem;
  color: #90a4ae;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wallet-magi__total strong {
  color: #e4eaed;
  font-size: 1.35rem;
  letter-spacing: 0;
  text-transform: none;
  font-variant-numeric: tabular-nums;
}

.wallet-magi__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 0.5rem;
  padding: 0 0.9rem 0.8rem;
}

.wallet-magi__cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.wallet-magi__cell span {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wallet-magi__cell strong {
  color: #e4eaed;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.wallet-magi__cell small {
  color: #78909c;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.wallet-magi__activity {
  padding: 0.6rem 0.9rem 0.9rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-magi__activity-title {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wallet-magi__activity ul {
  margin: 0.3rem 0 0;
  padding: 0;
  list-style: none;
}

.wallet-magi__activity li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border-top: 1px solid var(--border-subtle);
  color: #90a4ae;
  font-size: 0.74rem;
}

.wallet-magi__activity li:first-child {
  border-top: 0;
}

.wallet-magi__activity-label {
  color: #cfd8dc;
}

.wallet-magi__activity-amount {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.wallet-magi__activity-amount.is-in {
  color: #a5d6a7;
}

.wallet-magi__activity-amount.is-out {
  color: #ef9a9a;
}

.wallet-magi__activity time {
  flex: none;
  width: 6.5rem;
  color: #78909c;
  font-size: 0.68rem;
  text-align: right;
}
</style>

<script>
import moment from 'src/utils/time'
import { fetchMagiAccount } from 'src/services/magi'
import { formatUsd } from 'src/services/wallet'

function amount (value, digits = 3) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export default {
  name: 'MagiBalances',
  props: {
    username: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    hivePriceUsd: { type: Number, default: 0 },
    hbdPriceUsd: { type: Number, default: 0 }
  },
  emits: ['update:has-assets'],
  data () {
    return {
      balances: null,
      transactions: [],
      loading: false,
      error: ''
    }
  },
  computed: {
    hasAssets () {
      if (!this.balances) return false
      const b = this.balances
      return (b.hive + b.hbd + b.consensus + b.hbdSavings + b.unstaking + b.pendingUnstaking) > 0
    },
    hiveTotal () {
      if (!this.balances) return 0
      return this.balances.hive + this.balances.consensus + this.balances.unstaking
    },
    hbdTotal () {
      if (!this.balances) return 0
      return this.balances.hbd + this.balances.hbdSavings + this.balances.pendingUnstaking
    },
    totalUsd () {
      return this.hiveTotal * (Number(this.hivePriceUsd) || 0) +
        this.hbdTotal * (Number(this.hbdPriceUsd) || 0)
    },
    rows () {
      if (!this.balances) return []
      const rows = [
        { id: 'hive', label: 'Liquid HIVE', amount: amount(this.balances.hive) + ' HIVE', usd: this.balances.hive * this.hivePriceUsd },
        { id: 'hbd', label: 'Liquid HBD', amount: amount(this.balances.hbd) + ' HBD', usd: this.balances.hbd * this.hbdPriceUsd }
      ]
      if (this.balances.consensus > 0) {
        rows.push({ id: 'consensus', label: 'Magi staked', amount: amount(this.balances.consensus) + ' HIVE', usd: this.balances.consensus * this.hivePriceUsd })
      }
      if (this.balances.hbdSavings > 0) {
        rows.push({ id: 'savings', label: 'Magi HBD savings', amount: amount(this.balances.hbdSavings) + ' HBD', usd: this.balances.hbdSavings * this.hbdPriceUsd })
      }
      if (this.balances.unstaking > 0) {
        rows.push({ id: 'unstaking', label: 'Unstaking HIVE', amount: amount(this.balances.unstaking) + ' HIVE', usd: this.balances.unstaking * this.hivePriceUsd })
      }
      if (this.balances.pendingUnstaking > 0) {
        rows.push({ id: 'pending', label: 'Pending HBD', amount: amount(this.balances.pendingUnstaking) + ' HBD', usd: this.balances.pendingUnstaking * this.hbdPriceUsd })
      }
      return rows
    }
  },
  watch: {
    username () {
      this.balances = null
      this.transactions = []
      this.load()
    },
    hasAssets (value) {
      this.$emit('update:has-assets', value)
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    formatUsd,
    timeLabel (timestamp) {
      return timestamp ? moment.utc(timestamp).fromNow() : ''
    },
    async load () {
      if (!this.username) return
      this.loading = true
      this.error = ''
      try {
        const data = await fetchMagiAccount(this.username, { limit: 10, force: true })
        this.balances = data?.balances || null
        this.transactions = data?.transactions || []
      } catch {
        this.error = 'Magi Network is unavailable right now.'
        this.balances = null
        this.transactions = []
      } finally {
        this.loading = false
        this.$emit('update:has-assets', this.hasAssets)
      }
    }
  }
}
</script>
