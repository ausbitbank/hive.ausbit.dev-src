<template>
  <q-card flat bordered class="home-card home-panel market-trade-panel">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Trade</div>
        <h2 :id="headingId" class="home-panel__title">Place an order</h2>
      </div>
      <span class="market-trade-panel__authority">
        <q-icon name="lock" size="13px" aria-hidden="true" />
        Active key
      </span>
    </q-card-section>

    <div class="market-trade-panel__body">
      <p v-if="!loggedIn" class="market-trade-panel__login">
        <q-icon name="info" size="15px" aria-hidden="true" />
        Log in from the header to trade. You can still preview the calculator below.
      </p>

      <q-tabs
        v-model="side"
        dense
        align="justify"
        narrow-indicator
        indicator-color="primary"
        class="market-trade-panel__tabs"
        @update:model-value="onSideChange"
      >
        <q-tab name="buy" icon="trending_up" label="Buy HIVE" class="text-green" />
        <q-tab name="sell" icon="trending_down" label="Sell HIVE" class="text-red" />
      </q-tabs>
      <q-separator />

      <q-form class="market-trade-panel__form" @submit.prevent="submit">
        <q-input
          v-model="price"
          type="number"
          min="0"
          step="0.000001"
          inputmode="decimal"
          dense
          outlined
          label="Price (HBD per HIVE)"
          suffix="HBD"
          @update:model-value="onPriceInput"
        >
          <template #append>
            <q-btn
              type="button"
              flat
              dense
              no-caps
              size="sm"
              color="primary"
              :label="side === 'buy' ? 'Best ask' : 'Best bid'"
              :disable="bestPrice === null"
              @click="applyBestPrice"
            />
          </template>
        </q-input>

        <div class="market-trade-panel__quotes">
          <button type="button" class="market-trade-panel__quote" :disabled="stats.bestAsk === null" @click="usePrice(stats.bestAsk, 'buy')">
            Ask {{ priceLabel(stats.bestAsk) }}
          </button>
          <button type="button" class="market-trade-panel__quote" :disabled="stats.bestBid === null" @click="usePrice(stats.bestBid, 'sell')">
            Bid {{ priceLabel(stats.bestBid) }}
          </button>
          <button type="button" class="market-trade-panel__quote" :disabled="stats.latest === null" @click="usePrice(stats.latest)">
            Last {{ priceLabel(stats.latest) }}
          </button>
        </div>

        <q-input
          v-model="amount"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          dense
          outlined
          label="Amount"
          suffix="HIVE"
          @update:model-value="onAmountInput"
        />

        <q-input
          v-model="total"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          dense
          outlined
          :label="side === 'buy' ? 'Total cost' : 'Total receive'"
          suffix="HBD"
          @update:model-value="onTotalInput"
        />

        <div class="market-trade-panel__percentages" role="group" aria-label="Order size as a percentage of balance">
          <q-btn
            v-for="percent in [25, 50, 75, 100]"
            :key="percent"
            flat
            dense
            no-caps
            size="sm"
            :label="percent + '%'"
            :disable="!loggedIn || !(priceValue > 0)"
            @click="applyPercent(percent)"
          />
        </div>

        <div class="market-trade-panel__available">
          <span>Available: {{ availableLabel }}</span>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            label="Max"
            :disable="!loggedIn || !(priceValue > 0)"
            @click="applyPercent(100)"
          />
        </div>

        <q-checkbox
          v-model="fillOrKill"
          dense
          label="Fill or kill"
          title="Cancel the order unless it fills completely"
        />

        <div class="market-trade-panel__fee">
          <span><q-icon name="receipt" size="14px" aria-hidden="true" /> Trading fee <strong>{{ feePercent }}%</strong></span>
          <span>No deposit or withdrawal step</span>
        </div>

        <p v-if="formHint" class="market-trade-panel__hint">
          <q-icon name="info" size="14px" aria-hidden="true" />
          {{ formHint }}
        </p>

        <q-btn
          type="submit"
          no-caps
          unelevated
          class="market-trade-panel__submit"
          :color="side === 'buy' ? 'green' : 'red'"
          text-color="black"
          :icon="side === 'buy' ? 'trending_up' : 'trending_down'"
          :label="side === 'buy' ? 'Queue buy order' : 'Queue sell order'"
          :disable="!canSubmit"
        />
      </q-form>

      <section class="market-trade-panel__balances" aria-labelledby="trade-balances-title">
        <div class="market-trade-panel__balances-head">
          <h3 id="trade-balances-title">Balances</h3>
          <q-btn
            v-if="loggedIn"
            flat
            dense
            round
            icon="refresh"
            aria-label="Refresh balances"
            title="Refresh balances"
            @click="$emit('refresh')"
          />
        </div>
        <dl class="market-trade-panel__balance-list">
          <div class="market-trade-panel__balance-row">
            <dt><q-icon name="img:/statics/hive.svg" size="14px" aria-hidden="true" /> Liquid HIVE</dt>
            <dd>{{ formatAmount(balanceHive) }} HIVE</dd>
          </div>
          <div class="market-trade-panel__balance-row">
            <dt><q-icon name="img:/statics/hbd.svg" size="14px" aria-hidden="true" /> Liquid HBD</dt>
            <dd>{{ formatAmount(balanceHbd) }} HBD</dd>
          </div>
          <div class="market-trade-panel__balance-row">
            <dt><q-icon name="savings" size="14px" aria-hidden="true" /> HBD savings</dt>
            <dd>{{ formatAmount(balanceSavingsHbd) }} HBD</dd>
          </div>
        </dl>
      </section>
    </div>

    <q-card-section class="home-panel__footer">
      <span>Orders queue for review before broadcast.</span>
      <span>{{ feePercent }}% fee · limit orders expire in {{ expiryDays }} days</span>
    </q-card-section>
  </q-card>
</template>

<script>
import {
  MARKET_FEE_PERCENT,
  ORDER_EXPIRY_DAYS,
  formatAmount,
  formatPrice,
  parseAssetAmount,
  roundAmount,
  validateOrder
} from 'src/services/market'

function balanceOf (account, field) {
  return account ? parseAssetAmount(account[field]) : 0
}

export default {
  name: 'MarketTradePanel',
  props: {
    loggedIn: { type: Boolean, default: false },
    account: { type: Object, default: null },
    stats: { type: Object, default: () => ({}) },
    loading: { type: Boolean, default: false },
    headingId: { type: String, default: 'trade-order-title' }
  },
  emits: ['submit', 'refresh'],
  data () {
    return {
      side: 'buy',
      price: '',
      amount: '',
      total: '',
      fillOrKill: false,
      feePercent: MARKET_FEE_PERCENT,
      expiryDays: ORDER_EXPIRY_DAYS
    }
  },
  computed: {
    balanceHive () {
      return balanceOf(this.account, 'balance')
    },
    balanceHbd () {
      return balanceOf(this.account, 'hbd_balance')
    },
    balanceSavingsHbd () {
      return balanceOf(this.account, 'savings_hbd_balance')
    },
    priceValue () {
      return Number(this.price)
    },
    amountValue () {
      return Number(this.amount)
    },
    totalValue () {
      return Number(this.total)
    },
    bestPrice () {
      const price = this.side === 'buy' ? this.stats.bestAsk : this.stats.bestBid
      return Number.isFinite(Number(price)) ? Number(price) : null
    },
    validation () {
      return validateOrder({
        side: this.side,
        price: this.priceValue,
        amount: this.amountValue,
        total: this.totalValue,
        balanceHive: this.balanceHive,
        balanceHbd: this.balanceHbd,
        loggedIn: this.loggedIn
      })
    },
    canSubmit () {
      return this.loggedIn && this.validation.valid && !this.loading
    },
    availableLabel () {
      if (!this.loggedIn) return 'log in to load balances'
      if (this.side === 'buy') return formatAmount(this.balanceHbd) + ' HBD'
      return formatAmount(this.balanceHive) + ' HIVE'
    },
    formHint () {
      if (!this.loggedIn) return 'Log in from the header to place an order.'
      if (!(this.priceValue > 0)) return 'Enter a price or select an order-book level.'
      if (!(this.amountValue > 0)) return 'Enter an HIVE amount.'
      const balanceError = this.validation.errors.find(error => error.startsWith('Not enough'))
      return balanceError || ''
    }
  },
  watch: {
    bestPrice (value) {
      if (!this.price && Number(value) > 0) this.price = this.priceInput(value)
    }
  },
  methods: {
    formatAmount,
    priceLabel (value) {
      return Number(value) > 0 ? formatPrice(value) : '—'
    },
    priceInput (value) {
      return String(roundAmount(value, 6))
    },
    numberInput (value) {
      return String(roundAmount(value, 3))
    },
    onSideChange (side) {
      this.side = side
      const price = side === 'buy' ? this.stats.bestAsk : this.stats.bestBid
      if (Number(price) > 0) this.price = this.priceInput(price)
      this.syncTotal()
    },
    onPriceInput () {
      this.syncTotal()
    },
    onAmountInput () {
      this.syncTotal()
    },
    onTotalInput () {
      if (!(this.priceValue > 0)) return
      const amount = this.totalValue / this.priceValue
      this.amount = amount > 0 ? this.numberInput(amount) : ''
    },
    syncTotal () {
      if (!(this.priceValue > 0) || !(this.amountValue > 0)) {
        this.total = ''
        return
      }
      this.total = this.numberInput(this.priceValue * this.amountValue)
    },
    applyBestPrice () {
      const price = this.side === 'buy' ? this.stats.bestAsk : this.stats.bestBid
      if (Number(price) > 0) this.price = this.priceInput(price)
      this.syncTotal()
    },
    usePrice (price, side = this.side) {
      if (!(Number(price) > 0)) return
      this.side = side
      this.price = this.priceInput(price)
      this.syncTotal()
    },
    applyPercent (percent) {
      if (!(this.priceValue > 0)) return
      if (this.side === 'buy') {
        const total = this.balanceHbd * (percent / 100)
        this.total = this.numberInput(total)
        this.amount = total > 0 ? this.numberInput(total / this.priceValue) : ''
      } else {
        const amount = this.balanceHive * (percent / 100)
        this.amount = amount > 0 ? this.numberInput(amount) : ''
        this.total = amount > 0 ? this.numberInput(amount * this.priceValue) : ''
      }
    },
    /** Called by the parent when an order-book level is clicked. */
    applyBookPrice ({ price, side }) {
      this.usePrice(price, side)
    },
    resetAmount () {
      this.amount = ''
      this.total = ''
      this.fillOrKill = false
    },
    submit () {
      if (!this.validation.valid) return
      this.$emit('submit', {
        side: this.side,
        price: this.priceValue,
        amount: this.amountValue,
        total: this.totalValue,
        fillOrKill: this.fillOrKill
      })
    }
  }
}
</script>

<style scoped>
.market-trade-panel__authority {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #ffb74d;
  font-size: 0.7rem;
  white-space: nowrap;
}

.market-trade-panel__body {
  padding: 0.35rem 0.85rem 0.55rem;
}

.market-trade-panel__login {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0.45rem 0 0.2rem;
  color: #ffb74d;
  font-size: 0.74rem;
  line-height: 1.4;
}

.market-trade-panel__tabs {
  margin: 0 -0.35rem;
}

.market-trade-panel__form {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-top: 0.55rem;
}

.market-trade-panel__quotes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.market-trade-panel__quote {
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #90a4ae;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.market-trade-panel__quote:hover:not(:disabled) {
  border-color: rgba(79, 195, 247, 0.5);
  color: #e4eaed;
}

.market-trade-panel__quote:disabled {
  opacity: 0.5;
  cursor: default;
}

.market-trade-panel__percentages {
  display: flex;
  gap: 0.15rem;
}

.market-trade-panel__percentages :deep(.q-btn) {
  flex: 1;
  min-width: 0;
}

.market-trade-panel__available {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  color: #90a4ae;
  font-size: 0.72rem;
}

.market-trade-panel__fee {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding-top: 0.1rem;
  color: #78909c;
  font-size: 0.7rem;
}

.market-trade-panel__fee strong {
  color: #81c784;
}

.market-trade-panel__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0;
  color: #ffb74d;
  font-size: 0.72rem;
  line-height: 1.4;
}

.market-trade-panel__submit {
  margin-top: 0.1rem;
}

.market-trade-panel__submit.q-btn--disabled {
  opacity: 0.5;
}

.market-trade-panel__balances {
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.market-trade-panel__balances-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.market-trade-panel__balances-head h3 {
  margin: 0;
  color: #cfd8dc;
  font-size: 0.82rem;
  font-weight: 600;
}

.market-trade-panel__balance-list {
  margin: 0.2rem 0 0;
}

.market-trade-panel__balance-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.3rem 0;
  border-top: 1px solid var(--border-subtle);
}

.market-trade-panel__balance-row:first-child {
  border-top: 0;
}

.market-trade-panel__balance-row dt {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #78909c;
  font-size: 0.72rem;
}

.market-trade-panel__balance-row dd {
  margin: 0;
  color: #e4eaed;
  font-size: 0.76rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
