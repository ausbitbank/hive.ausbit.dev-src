<template>
  <div class="dw-wallet">
    <dashboard-widget-state
      :state="state"
      :error="loadError"
      guest-title="Log in to see your wallet"
      guest-text="Portfolio value, liquid balances and claimable rewards for your account."
      @retry="reload"
    />

    <template v-if="state === 'ready' || state === 'stale'">
      <q-card-section v-if="summary" class="dw-wallet__body">
        <div class="dw-wallet__hero">
          <div>
            <span class="dw-wallet__label">Portfolio<template v-if="accountName"> · @{{ accountName }}</template></span>
            <span class="dw-wallet__total">{{ totalLabel }}</span>
          </div>
          <span
            v-if="summary.changeLabel"
            class="dw-wallet__change"
            :class="'is-' + summary.changeDirection"
          >
            <q-icon
              :name="summary.changeDirection === 'up' ? 'north_east' : summary.changeDirection === 'down' ? 'south_east' : 'remove'"
              size="14px"
              aria-hidden="true"
            />
            {{ summary.changeLabel }}
          </span>
        </div>

        <dl class="dw-wallet__rows">
          <div v-for="row in rows" :key="row.id" class="dw-wallet__row">
            <dt>{{ row.label }}</dt>
            <dd>
              <span class="dw-wallet__amount">{{ row.amount }}</span>
              <span class="dw-wallet__usd">{{ row.usd }}</span>
            </dd>
          </div>
        </dl>

        <div v-if="summary.rewards.has" class="dw-wallet__rewards">
          <div>
            <span class="dw-wallet__label">Claimable rewards</span>
            <span class="dw-wallet__reward-parts">{{ summary.rewards.parts.join(' · ') }}</span>
          </div>
          <span class="dw-wallet__reward-usd">{{ money(summary.portfolio.pendingUsd) }}</span>
        </div>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link :to="walletPath">Open wallet</router-link>
        <span v-if="heLoading">Loading Hive-Engine…</span>
        <span v-else-if="heError" class="dw-wallet__note">{{ heError }}</span>
        <span v-if="magiLoading">Loading Magi…</span>
        <span v-else-if="magiError" class="dw-wallet__note">{{ magiError }}</span>
        <span>{{ pricesReady ? 'Prices from CoinGecko' : 'Prices unavailable' }}</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-wallet__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.7rem;
}

.dw-wallet__hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dw-wallet__label {
  display: block;
  color: #90a4ae;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-wallet__total {
  color: #e4eaed;
  font-size: 1.55rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-wallet__change {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.16rem 0.5rem;
  border-radius: var(--radius-pill);
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-wallet__change.is-up {
  background: rgba(102, 187, 106, 0.14);
  color: #a5d6a7;
}

.dw-wallet__change.is-down {
  background: rgba(239, 83, 80, 0.14);
  color: #ef9a9a;
}

.dw-wallet__change.is-flat {
  background: rgba(255, 255, 255, 0.07);
  color: #b0bec5;
}

.dw-wallet__rows {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 0;
}

.dw-wallet__row {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.dw-wallet__row dt {
  color: #90a4ae;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-wallet__row dd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.3rem;
  margin: 0;
}

.dw-wallet__amount {
  color: #e4eaed;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-wallet__usd {
  color: #78909c;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.dw-wallet__rewards {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  background: rgba(79, 195, 247, 0.07);
}

.dw-wallet__reward-parts {
  display: block;
  margin-top: 0.1rem;
  color: #cfd8dc;
  font-size: 0.74rem;
}

.dw-wallet__reward-usd {
  color: #81d4fa;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-wallet__note {
  margin: 0;
  color: #78909c;
  font-size: 0.68rem;
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { price, walletWidgetSummary } from 'src/services/dashboardWidgets'
import { fetchHiveEnginePortfolio } from 'src/services/hiveEnginePortfolio'
import { fetchMagiAccount } from 'src/services/magi'
import { currencySymbol, isForexCurrency, loadForexRate } from 'src/services/homeMarket'

export default {
  name: 'WidgetWallet',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    currency: { type: String, default: 'usd' },
    includeHiveEngine: { type: Boolean, default: true },
    includeMagi: { type: Boolean, default: true }
  },
  data () {
    return {
      forexRate: 1,
      heTokens: [],
      heTotalHive: 0,
      heValueUsd: 0,
      heLoading: false,
      heError: '',
      magi: null,
      magiLoading: false,
      magiError: ''
    }
  },
  computed: {
    // The same `buildPortfolio` maths as the wallet page, so the totals agree.
    summary () {
      if (!this.accountRecord) return null
      return walletWidgetSummary(
        this.accountRecord,
        this.globalProps,
        price(this.prices, 'hive'),
        price(this.prices, 'hive_dollar')
      )
    },
    pricesReady () {
      return Boolean(this.summary && this.summary.portfolio.pricesReady)
    },
    symbol () {
      return currencySymbol(this.currency)
    },
    rate () {
      return this.currency === 'usd' ? 1 : this.forexRate
    },
    totalUsd () {
      const base = this.summary ? this.summary.portfolio.totalUsd : 0
      return base +
        (this.includeHiveEngine ? this.heValueUsd : 0) +
        (this.includeMagi ? this.magiValueUsd : 0)
    },
    magiValueUsd () {
      if (!this.magi) return 0
      const hiveUsd = Number(price(this.prices, 'hive')?.usd) || 0
      const hbdUsd = Number(price(this.prices, 'hive_dollar')?.usd) || hiveUsd
      const hive = this.magi.hive + this.magi.consensus + this.magi.unstaking
      const hbd = this.magi.hbd + this.magi.hbdSavings + this.magi.pendingUnstaking
      return hive * hiveUsd + hbd * hbdUsd
    },
    totalLabel () {
      return this.money(this.totalUsd)
    },
    rows () {
      if (!this.summary) return []
      const rows = this.summary.rows.map(row => ({ ...row, usd: this.money(row.usdValue) }))
      if (this.includeHiveEngine && this.heTokens.length) {
        rows.push({
          id: 'hive-engine',
          label: 'Hive-Engine',
          amount: this.heTokens.length + (this.heTokens.length === 1 ? ' token' : ' tokens'),
          usd: this.money(this.heValueUsd)
        })
      }
      if (this.includeMagi && this.magi) {
        const hiveUsd = Number(price(this.prices, 'hive')?.usd) || 0
        const hbdUsd = Number(price(this.prices, 'hive_dollar')?.usd) || hiveUsd
        if (this.magi.hbd || this.magi.hbdSavings) {
          rows.push({
            id: 'magi-hbd',
            label: 'Magi HBD',
            amount: (this.magi.hbd + this.magi.hbdSavings).toFixed(3) + ' HBD',
            usd: this.money((this.magi.hbd + this.magi.hbdSavings) * hbdUsd)
          })
        }
        if (this.magi.hive || this.magi.consensus) {
          rows.push({
            id: 'magi-hive',
            label: 'Magi HIVE',
            amount: (this.magi.hive + this.magi.consensus).toFixed(3) + ' HIVE',
            usd: this.money((this.magi.hive + this.magi.consensus) * hiveUsd)
          })
        }
      }
      return rows
    },
    walletPath () {
      return '/@' + (this.accountName || this.targetAccount) + '/wallet'
    }
  },
  watch: {
    currency () {
      this.loadCurrencyRate()
    },
    includeHiveEngine (value) {
      if (value && this.accountName) this.loadHiveEngine(this.accountName)
    },
    includeMagi (value) {
      if (value && this.accountName) this.loadMagi(this.accountName)
      else if (!value) this.magi = null
    }
  },
  methods: {
    money (value) {
      if (value === null || value === undefined) return '—'
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return this.symbol + (number * this.rate).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    },
    applyAccountData (result) {
      this.loadCurrencyRate()
      if (this.includeHiveEngine) this.loadHiveEngine(result.accountName || this.targetAccount)
      if (this.includeMagi) this.loadMagi(result.accountName || this.targetAccount)
    },
    async loadCurrencyRate () {
      if (!isForexCurrency(this.currency)) {
        this.forexRate = 1
        return
      }
      try {
        this.forexRate = await loadForexRate(this.currency)
      } catch {
        this.forexRate = 1
      }
    },
    async loadMagi (name) {
      if (!name || !this.includeMagi) {
        this.magi = null
        return
      }
      this.magiLoading = true
      this.magiError = ''
      try {
        const result = await fetchMagiAccount(name, { limit: 20 })
        this.magi = result?.balances || null
      } catch (error) {
        console.error('Failed to load Magi balances', error)
        this.magiError = 'Magi Network unavailable'
        this.magi = null
      } finally {
        this.magiLoading = false
      }
    },
    async loadHiveEngine (name) {
      if (!name || !this.includeHiveEngine) {
        this.heTokens = []
        this.heTotalHive = 0
        this.heValueUsd = 0
        return
      }
      this.heLoading = true
      this.heError = ''
      try {
        const result = await fetchHiveEnginePortfolio(name)
        this.heTokens = result.tokens
        this.heTotalHive = result.totalHive
        const hive = price(this.prices, 'hive')
        const hbd = price(this.prices, 'hive_dollar')
        const hiveUsd = Number(hive?.usd) || 0
        const hbdUsd = Number(hbd?.usd) || hiveUsd
        this.heValueUsd = result.tokens.reduce((sum, token) => {
          const unit = token.usdPegged ? hbdUsd : hiveUsd
          return sum + token.balance * token.priceHive * unit
        }, 0)
      } catch (error) {
        console.error('Failed to load Hive-Engine balances', error)
        this.heError = 'Hive-Engine balances unavailable.'
        this.heTokens = []
        this.heTotalHive = 0
        this.heValueUsd = 0
      } finally {
        this.heLoading = false
      }
    }
  }
}
</script>
