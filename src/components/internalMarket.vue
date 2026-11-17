<template>
  <div class="internal-market">
    <q-card flat bordered class="home-card market-ticker">
      <div class="market-ticker__main">
        <div class="market-ticker__pair">
          <div class="home-eyebrow">
            <span class="home-live-dot" :class="{ 'is-live': !loading && hasData }" aria-hidden="true"></span>
            Internal market
          </div>
          <div class="market-ticker__pair-name">
            <q-icon name="img:/statics/hive.svg" size="20px" aria-hidden="true" />
            <span>HIVE / HBD</span>
          </div>
          <span class="market-ticker__pair-note">HBD per HIVE</span>
        </div>

        <div class="market-ticker__stat">
          <span class="market-ticker__label">Last price</span>
          <span class="market-ticker__value">{{ formatPrice(stats.latest) }}</span>
          <span class="market-ticker__sub" :class="changeClass">{{ changeLabel }}</span>
        </div>

        <div class="market-ticker__stat">
          <span class="market-ticker__label">Best bid / ask</span>
          <span class="market-ticker__value market-ticker__value--small">
            {{ formatPrice(stats.bestBid) }} / {{ formatPrice(stats.bestAsk) }}
          </span>
          <span class="market-ticker__sub">Spread {{ spreadLabel }}</span>
        </div>

        <div class="market-ticker__stat">
          <span class="market-ticker__label">24h volume</span>
          <span class="market-ticker__value market-ticker__value--small">{{ formatVolume(stats.hiveVolume) }} HIVE</span>
          <span class="market-ticker__sub">{{ formatVolume(stats.hbdVolume) }} HBD</span>
        </div>
      </div>

      <div class="market-ticker__meta">
        <span>
          <q-icon name="schedule" size="13px" aria-hidden="true" />
          {{ updatedLabel }}
        </span>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh internal market data"
          title="Refresh internal market data"
          :loading="loading || refreshing"
          @click="loadMarketData()"
        />
      </div>
    </q-card>

    <div v-if="loadError && hasData" class="market-warning" role="status">
      <q-icon name="warning" size="15px" aria-hidden="true" />
      {{ loadError }}
      <q-btn flat dense no-caps color="primary" label="Retry" @click="loadMarketData()" />
    </div>

    <q-card v-if="loadError && !hasData" flat bordered class="net-state net-state--error">
      <q-icon name="error_outline" size="2em" aria-hidden="true" />
      <div>{{ loadError }}</div>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadMarketData()" />
    </q-card>

    <div v-else class="market-layout">
      <div class="market-main">
        <div class="market-data-grid">
          <market-order-book
            :asks="book.asks"
            :bids="book.bids"
            :spread="stats.spread"
            :spread-percent="stats.spreadPercent"
            :loading="loading"
            @select="onBookSelect"
          />
          <market-trades :trades="trades" :loading="loading" />
        </div>

        <market-open-orders
          :orders="openOrders"
          :loading="loading"
          :logged-in="Boolean(loggedInUser)"
          :cancelling-id="cancellingId"
          @cancel="cancelOrder"
        />

        <q-card flat bordered class="home-card home-panel market-info">
          <q-card-section class="home-panel__head">
            <div>
              <div class="home-eyebrow">About</div>
              <h2 class="home-panel__title">How the internal market works</h2>
            </div>
          </q-card-section>
          <div class="market-info__body">
            <ul class="market-info__list">
              <li>The Hive internal market is a native on-chain exchange for HIVE and HBD. There is no trading fee, no deposit step and no intermediary.</li>
              <li>Orders are limit orders. They stay open until filled or cancelled and expire after 27 days.</li>
              <li>The book can be thin. Larger orders may fill by arbitrage against external exchanges rather than against resting orders.</li>
              <li>Creating or cancelling an order uses the active key. Queue actions are reviewed before broadcast.</li>
            </ul>
            <p class="market-info__links">
              <router-link to="/markets">Price charts and HBD tools</router-link>
              <router-link to="/hbdstabilizer">HBD stabilizer</router-link>
              <a href="https://wallet.hive.blog/market" target="_blank" rel="noopener noreferrer">Original market interface</a>
            </p>
          </div>
        </q-card>
      </div>

      <aside class="market-side" aria-label="Order form and balances">
        <market-trade-panel
          ref="tradePanel"
          :logged-in="Boolean(loggedInUser)"
          :account="account"
          :stats="stats"
          :loading="loading"
          @submit="queueOrder"
          @refresh="refreshAccount"
        />
      </aside>
    </div>
  </div>
</template>

<script>
import moment from 'src/utils/time'
import VueTimers from 'src/mixins/timers.js'
import MarketOrderBook from 'components/market/MarketOrderBook.vue'
import MarketTrades from 'components/market/MarketTrades.vue'
import MarketOpenOrders from 'components/market/MarketOpenOrders.vue'
import MarketTradePanel from 'components/market/MarketTradePanel.vue'
import {
  buildCancelOrder,
  buildLimitOrder,
  formatPrice,
  formatSignedPercent,
  formatVolume,
  marketStats,
  normalizeOpenOrders,
  normalizeOrderBook,
  normalizeTrades,
  validateOrder
} from 'src/services/market'

const EMPTY_BOOK = { asks: [], bids: [] }

export default {
  name: 'internalMarket',
  components: {
    MarketOrderBook,
    MarketTrades,
    MarketOpenOrders,
    MarketTradePanel
  },
  mixins: [VueTimers],
  props: {
    tradeEnabled: { type: Boolean, default: true }
  },
  data () {
    return {
      ticker: {},
      book: { ...EMPTY_BOOK },
      trades: [],
      openOrders: [],
      loading: true,
      refreshing: false,
      loadError: '',
      lastUpdated: null,
      cancellingId: null
    }
  },
  timers: {
    refreshMarket: { time: 15000, autostart: true, repeat: true, immediate: true }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    account () {
      return this.loggedInUser ? this.$hiveStore.accounts[this.loggedInUser] : null
    },
    stats () {
      return marketStats(this.ticker, this.book)
    },
    hasData () {
      return Boolean(this.stats.latest) || this.book.asks.length > 0 || this.book.bids.length > 0 || this.trades.length > 0
    },
    changeLabel () {
      return this.stats.change === null ? '—' : formatSignedPercent(this.stats.change)
    },
    changeClass () {
      if (this.stats.change === null) return 'is-flat'
      return this.stats.change > 0 ? 'is-up' : this.stats.change < 0 ? 'is-down' : 'is-flat'
    },
    spreadLabel () {
      if (this.stats.spread === null) return '—'
      if (this.stats.spreadPercent === null) return formatPrice(this.stats.spread)
      return formatPrice(this.stats.spread) + ' · ' + this.stats.spreadPercent.toFixed(2) + '%'
    },
    updatedLabel () {
      return this.lastUpdated ? moment.utc(this.lastUpdated).fromNow() : 'Not updated yet'
    }
  },
  watch: {
    loggedInUser (value, previous) {
      if (value !== previous) this.refreshAccount()
      if (!value) this.openOrders = []
    }
  },
  methods: {
    formatPrice,
    formatVolume,
    async loadMarketData ({ quiet = false } = {}) {
      if (quiet) this.refreshing = true
      else this.loading = true
      this.loadError = ''

      const calls = [
        this.$hive.api.getTickerAsync(),
        this.$hive.api.getOrderBookAsync(200),
        this.$hive.api.getRecentTradesAsync(100)
      ]
      const [tickerResult, bookResult, tradesResult] = await Promise.allSettled(calls)
      let failed = false

      if (tickerResult.status === 'fulfilled') {
        this.ticker = tickerResult.value || {}
      } else {
        failed = true
      }
      if (bookResult.status === 'fulfilled') {
        this.book = normalizeOrderBook(bookResult.value)
      } else {
        failed = true
      }
      if (tradesResult.status === 'fulfilled') {
        this.trades = normalizeTrades(tradesResult.value)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      } else {
        failed = true
      }

      if (this.loggedInUser && !this.account) {
        await this.$hiveStore.getAccount(this.loggedInUser)
      }
      await this.loadOpenOrders()

      if (failed) {
        this.loadError = 'Some internal market data could not be loaded. Showing the latest available values.'
      } else {
        this.lastUpdated = Date.now()
      }

      this.loading = false
      this.refreshing = false
    },
    async refreshMarket () {
      await this.loadMarketData({ quiet: true })
    },
    async refreshAccount () {
      if (!this.loggedInUser) return
      await this.$hiveStore.getAccount(this.loggedInUser)
      await this.loadOpenOrders()
    },
    async loadOpenOrders () {
      if (!this.loggedInUser) {
        this.openOrders = []
        return
      }
      try {
        this.openOrders = normalizeOpenOrders(await this.$hive.api.getOpenOrdersAsync(this.loggedInUser))
      } catch {
        this.openOrders = []
      }
    },
    onBookSelect ({ price, side }) {
      this.$refs.tradePanel?.applyBookPrice({ price, side })
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        this.$refs.tradePanel?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    queueOrder (order) {
      if (!this.loggedInUser) {
        this.$q.notify({ message: 'Log in to place an order.', color: 'orange', icon: 'lock' })
        return
      }

      const account = this.account || {}
      const validation = validateOrder({
        side: order.side,
        price: order.price,
        amount: order.amount,
        total: order.total,
        balanceHive: parseFloat(account.balance || 0),
        balanceHbd: parseFloat(account.hbd_balance || 0),
        loggedIn: true
      })

      if (!validation.valid) {
        this.$q.notify({
          message: validation.errors[0] || 'Check the order details.',
          color: 'orange',
          icon: 'warning'
        })
        return
      }

      const queued = buildLimitOrder({
        owner: this.loggedInUser,
        side: order.side,
        price: order.price,
        amount: order.amount,
        total: order.total,
        fillOrKill: order.fillOrKill
      })
      this.$hiveStore.addToQueue(queued)
      this.$refs.tradePanel?.resetAmount()
      this.$q.notify({
        message: (order.side === 'buy' ? 'Buy' : 'Sell') + ' order queued. Review and broadcast it with your active key.',
        color: 'orange',
        icon: 'schedule',
        position: 'top'
      })
    },
    cancelOrder (orderid) {
      if (!this.loggedInUser) return
      this.cancellingId = orderid
      this.$hiveStore.addToQueue(buildCancelOrder(this.loggedInUser, orderid))
      this.$q.notify({
        message: 'Cancel queued. Review and broadcast it with your active key.',
        color: 'orange',
        icon: 'schedule',
        position: 'top'
      })
      setTimeout(() => { this.cancellingId = null }, 800)
    }
  }
}
</script>

<style scoped>
.internal-market {
  min-width: 0;
}

.market-ticker {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 0.8rem 1rem;
}

.market-ticker__main {
  display: flex;
  align-items: stretch;
  gap: var(--space-5);
  flex-wrap: wrap;
  min-width: 0;
}

.market-ticker__pair {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
  min-width: 145px;
}

.market-ticker__pair-name {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #e4eaed;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.2;
}

.market-ticker__pair-note {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.market-ticker__stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.05rem;
  min-width: 120px;
}

.market-ticker__label {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.market-ticker__value {
  color: #e4eaed;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.market-ticker__value--small {
  font-size: 0.85rem;
}

.market-ticker__sub {
  color: #90a4ae;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.market-ticker__meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #78909c;
  font-size: 0.7rem;
}

.market-ticker__meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.market-warning {
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

.market-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.market-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.market-data-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
  min-width: 0;
}

.market-side {
  min-width: 0;
}

.market-info__body {
  padding: 0.75rem 1rem 0.8rem;
}

.market-info__list {
  margin: 0;
  padding-left: 1.1rem;
  color: #90a4ae;
  font-size: 0.8rem;
  line-height: 1.55;
}

.market-info__list li + li {
  margin-top: 0.4rem;
}

.market-info__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin: 0.8rem 0 0;
  font-size: 0.76rem;
  font-weight: 600;
}

.market-info__links a {
  color: #4fc3f7;
  text-decoration: none;
}

.market-info__links a:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.is-up {
  color: #66bb6a;
}

.is-down {
  color: #ef5350;
}

.is-flat {
  color: #90a4ae;
}

@media (max-width: 1199px) {
  .market-ticker__main {
    gap: var(--space-4);
  }
}

@media (max-width: 1023px) {
  .market-layout {
    display: flex;
    flex-direction: column;
  }

  .market-side {
    order: -1;
    width: 100%;
  }

  .market-main {
    width: 100%;
  }
}

@media (max-width: 799px) {
  .market-data-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .market-ticker {
    padding: 0.7rem 0.8rem;
  }

  .market-ticker__main {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    width: 100%;
  }

  .market-ticker__pair {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .market-ticker__stat {
    min-width: 0;
  }

  .market-ticker__meta {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
