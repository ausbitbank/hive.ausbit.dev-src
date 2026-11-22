<template>
  <q-card flat bordered class="home-card home-panel market-trades">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Tape</div>
        <h2 :id="headingId" class="home-panel__title">Recent trades</h2>
      </div>
      <span class="market-trades__unit">Newest first</span>
    </q-card-section>

    <div v-if="loading && trades.length === 0" class="market-trades__skeleton">
      <q-skeleton v-for="i in 8" :key="i" type="text" height="18px" />
    </div>

    <div v-else-if="trades.length === 0" class="home-panel__state">
      <q-icon name="receipt_long" size="24px" color="grey" aria-hidden="true" />
      <span>No trades have been recorded yet.</span>
    </div>

    <div v-else class="market-trades__body">
      <table class="market-trades__table">
        <caption class="sr-only">Most recent internal market trades, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Price</th>
            <th scope="col">HIVE</th>
            <th scope="col">HBD</th>
            <th scope="col">Time</th>
            <th scope="col" class="market-trades__taker-col">Taker</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(trade, index) in visibleTrades" :key="trade.date + '-' + trade.taker + '-' + index">
            <td>
              <span class="sr-only">{{ trade.side === 'buy' ? 'Buy' : 'Sell' }} </span>
              <q-icon
                :name="trade.side === 'buy' ? 'arrow_upward' : 'arrow_downward'"
                :color="trade.side === 'buy' ? 'green' : 'red'"
                size="13px"
                aria-hidden="true"
              />
              <span :class="trade.side === 'buy' ? 'market-trades__buy' : 'market-trades__sell'">
                {{ formatPrice(trade.price) }}
              </span>
            </td>
            <td>{{ formatAmount(trade.hive) }}</td>
            <td>{{ formatAmount(trade.hbd) }}</td>
            <td>
              <time :datetime="trade.date">{{ timeAgo(trade.date) }}</time>
            </td>
            <td class="market-trades__taker-col">
              <router-link :to="accountLink(trade.taker)">{{ trade.taker }}</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <q-card-section class="home-panel__footer">
      <span>Showing {{ visibleTrades.length }} of {{ trades.length }} loaded trades</span>
      <span>HBD per HIVE</span>
    </q-card-section>
  </q-card>
</template>

<script>
import moment from 'src/utils/time'
import { formatAmount, formatPrice } from 'src/services/market'

export default {
  name: 'MarketTrades',
  props: {
    trades: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    limit: { type: Number, default: 20 },
    headingId: { type: String, default: 'recent-trades-title' }
  },
  computed: {
    visibleTrades () {
      return this.trades.slice(0, this.limit)
    }
  },
  methods: {
    formatAmount,
    formatPrice,
    accountLink (account) {
      return '/@' + encodeURIComponent(account || '')
    },
    timeAgo (value) {
      if (!value) return '—'
      return moment.utc(value).fromNow()
    }
  }
}
</script>

<style scoped>
.market-trades__unit {
  color: var(--c-text-faint);
  font-size: 0.7rem;
  white-space: nowrap;
}

.market-trades__body {
  padding: 0.35rem 0.5rem 0.4rem;
  overflow-x: auto;
}

.market-trades__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem 1rem;
}

.market-trades__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.market-trades__table th {
  padding: 0.22rem 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-align: right;
  text-transform: uppercase;
}

.market-trades__table th:first-child,
.market-trades__table td:first-child {
  text-align: left;
}

.market-trades__table td {
  padding: 0.26rem 0.45rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-soft);
  text-align: right;
  white-space: nowrap;
}

.market-trades__table td:first-child {
  white-space: nowrap;
}

.market-trades__buy {
  color: var(--c-positive);
  font-weight: 600;
}

.market-trades__sell {
  color: var(--c-negative);
  font-weight: 600;
}

.market-trades__table time {
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.market-trades__table a {
  color: var(--c-link);
  text-decoration: none;
}

.market-trades__table a:hover {
  text-decoration: underline;
}

.market-trades__taker-col {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 599px) {
  .market-trades__taker-col {
    display: none;
  }
}
</style>
