<template>
  <q-card flat bordered class="home-card home-panel market-book">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Market depth</div>
        <h2 :id="headingId" class="home-panel__title">Order book</h2>
      </div>
      <span class="market-book__unit">HBD per HIVE</span>
    </q-card-section>

    <div v-if="loading && !hasOrders" class="market-book__skeleton">
      <q-skeleton v-for="i in 8" :key="i" type="text" height="18px" />
    </div>

    <div v-else-if="!hasOrders" class="home-panel__state">
      <q-icon name="menu_book" size="24px" color="grey" aria-hidden="true" />
      <span>The order book is empty right now.</span>
    </div>

    <div v-else class="market-book__body">
      <section aria-labelledby="book-asks-heading">
        <div id="book-asks-heading" class="market-book__side market-book__side--ask">
          <span>Asks · sell HIVE</span>
          <span>{{ displayAsks.length }} of {{ asks.length }}</span>
        </div>
        <table class="market-book__table">
          <caption class="sr-only">Offers to sell HIVE for HBD, best ask nearest the spread</caption>
          <thead>
            <tr>
              <th scope="col">Price</th>
              <th scope="col">HIVE</th>
              <th scope="col">Total HBD</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ask in displayAsks" :key="'ask-' + ask.price + '-' + ask.created">
              <td>
                <button
                  type="button"
                  class="market-book__price market-book__price--ask"
                  :aria-label="'Use ask price ' + formatPrice(ask.price) + ' HBD per HIVE'"
                  @click="$emit('select', { price: ask.price, side: 'buy' })"
                >{{ formatPrice(ask.price) }}</button>
              </td>
              <td>{{ formatAmount(ask.hive) }}</td>
              <td>{{ formatAmount(ask.cumulativeHbd) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="market-book__spread">
        <span>Spread</span>
        <strong>{{ spreadLabel }}</strong>
      </div>

      <section aria-labelledby="book-bids-heading">
        <div id="book-bids-heading" class="market-book__side market-book__side--bid">
          <span>Bids · buy HIVE</span>
          <span>{{ displayBids.length }} of {{ bids.length }}</span>
        </div>
        <table class="market-book__table">
          <caption class="sr-only">Offers to buy HIVE with HBD, best bid nearest the spread</caption>
          <thead>
            <tr>
              <th scope="col">Price</th>
              <th scope="col">HIVE</th>
              <th scope="col">Total HBD</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bid in displayBids" :key="'bid-' + bid.price + '-' + bid.created">
              <td>
                <button
                  type="button"
                  class="market-book__price market-book__price--bid"
                  :aria-label="'Use bid price ' + formatPrice(bid.price) + ' HBD per HIVE'"
                  @click="$emit('select', { price: bid.price, side: 'sell' })"
                >{{ formatPrice(bid.price) }}</button>
              </td>
              <td>{{ formatAmount(bid.hive) }}</td>
              <td>{{ formatAmount(bid.cumulativeHbd) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <q-card-section class="home-panel__footer">
      <span>Click a price to prefill the order form</span>
      <span>Cumulative depth</span>
    </q-card-section>
  </q-card>
</template>

<script>
import { formatAmount, formatPrice } from 'src/services/market'

export default {
  name: 'MarketOrderBook',
  props: {
    asks: { type: Array, default: () => [] },
    bids: { type: Array, default: () => [] },
    spread: { type: Number, default: null },
    spreadPercent: { type: Number, default: null },
    loading: { type: Boolean, default: false },
    limit: { type: Number, default: 14 },
    headingId: { type: String, default: 'order-book-title' }
  },
  emits: ['select'],
  computed: {
    hasOrders () {
      return this.asks.length > 0 || this.bids.length > 0
    },
    displayAsks () {
      return this.asks.slice(0, this.limit).reverse()
    },
    displayBids () {
      return this.bids.slice(0, this.limit)
    },
    spreadLabel () {
      if (this.spread === null || this.spread === undefined) return '—'
      if (this.spreadPercent === null || this.spreadPercent === undefined) return formatPrice(this.spread)
      return formatPrice(this.spread) + ' · ' + this.spreadPercent.toFixed(2) + '%'
    }
  },
  methods: {
    formatAmount,
    formatPrice
  }
}
</script>

<style scoped>
.market-book__unit {
  color: #78909c;
  font-size: 0.7rem;
  white-space: nowrap;
}

.market-book__body {
  padding: 0.35rem 0.5rem 0.45rem;
}

.market-book__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem 1rem;
}

.market-book__side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.28rem 0.5rem;
  color: #90a4ae;
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.market-book__side--ask {
  color: #ef9a9a;
}

.market-book__side--bid {
  color: #a5d6a7;
}

.market-book__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

.market-book__table th {
  padding: 0.22rem 0.5rem;
  color: #78909c;
  font-size: 0.64rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-align: right;
  text-transform: uppercase;
}

.market-book__table th:first-child {
  text-align: left;
}

.market-book__table td {
  padding: 0.24rem 0.5rem;
  border-top: 1px solid var(--border-subtle);
  color: #cfd8dc;
  text-align: right;
  white-space: nowrap;
}

.market-book__table td:first-child {
  text-align: left;
}

.market-book__price {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.market-book__price:hover,
.market-book__price:focus-visible {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.market-book__price--ask {
  color: #ef9a9a;
}

.market-book__price--bid {
  color: #a5d6a7;
}

.market-book__spread {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin: 0.28rem 0.5rem;
  padding: 0.34rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  color: #90a4ae;
  font-size: 0.7rem;
}

.market-book__spread strong {
  color: #e4eaed;
  font-variant-numeric: tabular-nums;
}
</style>
