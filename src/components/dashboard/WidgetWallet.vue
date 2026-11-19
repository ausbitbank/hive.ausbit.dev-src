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
            <span class="dw-wallet__label">Portfolio value</span>
            <span class="dw-wallet__total">{{ summary.totalUsd }}</span>
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
          <div v-for="row in summary.rows" :key="row.id" class="dw-wallet__row">
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
          <span class="dw-wallet__reward-usd">{{ summary.rewards.usd }}</span>
        </div>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link :to="walletPath">Open wallet</router-link>
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
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { price, walletWidgetSummary } from 'src/services/dashboardWidgets'

export default {
  name: 'WidgetWallet',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' }
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
    walletPath () {
      return '/@' + (this.accountName || this.targetAccount) + '/wallet'
    }
  }
}
</script>
