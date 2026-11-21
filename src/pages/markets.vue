<template>
  <q-page class="market-page">
    <div class="market-shell">
      <header class="market-head">
        <div class="market-head__text">
          <div class="market-eyebrow">
            <span class="home-live-dot" :class="{ 'is-live': !loading }" aria-hidden="true"></span>
            Markets
          </div>
          <h1 class="market-head__title">Hive markets</h1>
          <p class="market-intro">
            Follow HIVE on external exchanges, check where HBD trades against its
            dollar peg, and estimate a HIVE ↔ HBD conversion before you use the
            internal market or your wallet.
          </p>
        </div>
        <div class="market-actions">
          <q-btn no-caps outline color="primary" icon="store" label="Internal market" to="/market" />
          <q-btn no-caps outline color="primary" icon="attach_money" label="HBD monitor" to="/hbd" />
        </div>
      </header>

      <div v-if="loadError" class="markets-warning" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        {{ loadError }}
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadMarketData()" />
      </div>

      <div class="markets-layout">
        <market-chart-card
          :pair="pair"
          :interval="interval"
          @update:pair="selectPair"
          @update:interval="selectInterval"
        />

        <div class="markets-side">
          <market-snapshot-card
            :stats="stats"
            :prices="prices"
            :peg="peg"
            :loading="loading || refreshing"
            :updated-label="updatedLabel"
            @refresh="loadMarketData()"
          />

          <sats-quote-card />

          <q-card flat bordered class="home-card home-panel markets-cta">
            <q-card-section class="home-panel__head">
              <div>
                <div class="home-eyebrow">On-chain</div>
                <h2 class="home-panel__title">Trade HIVE and HBD</h2>
              </div>
            </q-card-section>
            <div class="markets-cta__body">
              <p>
                The internal market is the native Hive exchange: no trading fee,
                no deposit step and no intermediary.
              </p>
              <div class="markets-cta__actions">
                <q-btn no-caps unelevated color="primary" icon="store" label="Open internal market" to="/market" class="markets-cta__button" />
                <q-btn no-caps outline color="primary" icon="account_balance_wallet" label="Open wallet" :to="walletLink" class="markets-cta__button" />
              </div>
              <router-link to="/markets#hbd-tools" class="home-panel__link">HBD peg, APR and converter</router-link>
            </div>
          </q-card>
        </div>
      </div>

      <section id="hbd-tools" class="market-section" aria-labelledby="hbd-tools-title">
        <div class="market-section__head">
          <div>
            <div class="market-eyebrow">HBD</div>
            <h2 id="hbd-tools-title" class="market-section__title">HBD peg and yield</h2>
          </div>
          <span class="market-section__hint">External quote, internal market and median feed</span>
        </div>

        <div class="markets-tools-grid">
          <hbd-peg-card :peg="peg" />
          <savings-apr-card :apr="hbdApr" />
          <hbd-conversion-calculator
            :internal-price="internalPrice"
            :median-price="medianPrice"
            :hive-usd="hiveUsd"
            :hbd-usd="hbdUsd"
            :logged-in="Boolean(loggedInUser)"
            :username="loggedInUser || ''"
          />
        </div>
      </section>

      <section class="market-section" aria-labelledby="market-resources-title">
        <div class="market-section__head">
          <div>
            <div class="market-eyebrow">Next steps</div>
            <h2 id="market-resources-title" class="market-section__title">Market resources</h2>
          </div>
        </div>

        <q-card flat bordered class="home-card markets-resources">
          <div class="markets-resources__grid">
            <div class="markets-resources__item">
              <h3>Internal market</h3>
              <p>Order book, recent trades, balances, open orders and zero-fee limit orders.</p>
              <router-link to="/market">Trade HIVE / HBD</router-link>
            </div>
            <div class="markets-resources__item">
              <h3>HBD stability</h3>
              <p>Debt ratio, print rate, haircut conditions and how HBD savings interest works.</p>
              <router-link to="/hbd">Open the HBD monitor</router-link>
            </div>
            <div class="markets-resources__item">
              <h3>External interfaces</h3>
              <p>Compare with the original Hive market interface and Liquidity provider tools.</p>
              <a href="https://wallet.hive.blog/market" target="_blank" rel="noopener noreferrer">wallet.hive.blog/market</a>
              <router-link to="/hbdstabilizer">HBD stabilizer</router-link>
            </div>
          </div>
          <q-card-section class="home-panel__footer">
            <span>Charts by TradingView · external prices via CoinGecko</span>
            <span v-if="updatedLabel">{{ updatedLabel }}</span>
          </q-card-section>
        </q-card>
      </section>
    </div>
  </q-page>
</template>

<script>
import moment from 'src/utils/time'
import VueTimers from 'src/mixins/timers.js'
import MarketChartCard from 'components/market/MarketChartCard.vue'
import MarketSnapshotCard from 'components/market/MarketSnapshotCard.vue'
import SatsQuoteCard from 'components/market/SatsQuoteCard.vue'
import HbdPegCard from 'components/market/HbdPegCard.vue'
import SavingsAprCard from 'components/market/SavingsAprCard.vue'
import HbdConversionCalculator from 'components/market/HbdConversionCalculator.vue'
import { getHivePrices } from 'src/services/prices'
import {
  hbdPeg,
  marketStats,
  resolveChartInterval,
  resolveTradingPair,
  savingsApr
} from 'src/services/market'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'MarketsPage',
  components: {
    MarketChartCard,
    MarketSnapshotCard,
    SatsQuoteCard,
    HbdPegCard,
    SavingsAprCard,
    HbdConversionCalculator
  },
  mixins: [VueTimers],
  data () {
    return {
      pair: resolveTradingPair(this.$route.query.pair),
      interval: resolveChartInterval(this.$route.query.interval),
      ticker: {},
      median: null,
      prices: null,
      loading: true,
      refreshing: false,
      loadError: '',
      lastUpdated: null
    }
  },
  timers: {
    refreshMarket: { time: 60000, autostart: true, repeat: true, immediate: true }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    stats () {
      return marketStats(this.ticker, { asks: [], bids: [] })
    },
    internalPrice () {
      const mid = Number(this.stats.mid)
      if (Number.isFinite(mid) && mid > 0) return mid
      const latest = Number(this.stats.latest)
      return Number.isFinite(latest) && latest > 0 ? latest : null
    },
    medianPrice () {
      const base = parseFloat(this.median?.base)
      const quote = parseFloat(this.median?.quote)
      return Number.isFinite(base) && Number.isFinite(quote) && quote > 0 ? base / quote : null
    },
    hiveUsd () {
      const value = Number(this.prices?.hive?.usd)
      return Number.isFinite(value) && value > 0 ? value : null
    },
    hbdUsd () {
      const value = Number(this.prices?.hive_dollar?.usd)
      return Number.isFinite(value) && value > 0 ? value : null
    },
    peg () {
      return hbdPeg({
        hbdUsd: this.hbdUsd,
        hiveUsd: this.hiveUsd,
        internalHivePrice: this.internalPrice,
        medianHivePrice: this.medianPrice
      })
    },
    hbdApr () {
      return savingsApr(this.$hiveStore.globalProps)
    },
    updatedLabel () {
      return this.lastUpdated ? moment.utc(this.lastUpdated).fromNow() : ''
    },
    walletLink () {
      return this.loggedInUser
        ? '/@' + encodeURIComponent(this.loggedInUser) + '/wallet'
        : '/market'
    }
  },
  watch: {
    '$route.query.pair' (value) {
      const next = resolveTradingPair(value)
      if (next !== this.pair) this.pair = next
    },
    '$route.query.interval' (value) {
      const next = resolveChartInterval(value)
      if (next !== this.interval) this.interval = next
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive markets — HIVE charts, HBD peg, APR and converter',
      description: 'HIVE price charts, HBD peg and premium, savings APR and a HIVE/HBD conversion calculator on hive.ausbit.dev.',
      url: '/markets'
    })
  },
  methods: {
    async refreshMarket () {
      await this.loadMarketData({ quiet: true })
    },
    async loadMarketData ({ quiet = false } = {}) {
      if (quiet) this.refreshing = true
      else this.loading = true
      this.loadError = ''

      const results = await Promise.allSettled([
        this.$hive.api.getTickerAsync(),
        this.$hive.api.getCurrentMedianHistoryPriceAsync(),
        getHivePrices()
      ])

      let failed = false
      if (results[0].status === 'fulfilled') this.ticker = results[0].value || {}
      else failed = true
      if (results[1].status === 'fulfilled') this.median = results[1].value || null
      else failed = true
      if (results[2].status === 'fulfilled') this.prices = results[2].value
      else failed = true

      if (this.$hiveStore.globalProps?.empty) {
        await this.$hiveStore.getGlobalProps()
      }

      if (failed) {
        this.loadError = 'Some market data could not be loaded. Showing the latest available values.'
      } else {
        this.lastUpdated = Date.now()
      }

      this.loading = false
      this.refreshing = false
    },
    selectPair (value) {
      this.pair = resolveTradingPair(value)
      this.syncQuery()
    },
    selectInterval (value) {
      this.interval = resolveChartInterval(value)
      this.syncQuery()
    },
    syncQuery () {
      if (this.$route.query.pair === this.pair && this.$route.query.interval === this.interval) return
      this.$router.replace({
        query: { ...this.$route.query, pair: this.pair, interval: this.interval },
        hash: this.$route.hash
      })
    }
  }
}
</script>

<style scoped>
.markets-warning {
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

.markets-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
  gap: var(--space-4);
}

.markets-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.markets-cta__body {
  padding: 0.7rem 1rem 0.8rem;
}

.markets-cta__body p {
  margin: 0 0 0.6rem;
  color: #90a4ae;
  font-size: 0.78rem;
  line-height: 1.45;
}

.markets-cta__actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.markets-cta__button {
  width: 100%;
}

.markets-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  align-items: start;
  gap: var(--space-3);
}

.markets-resources__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-4);
  padding: 0.9rem 1rem 1rem;
}

.markets-resources__item h3 {
  margin: 0 0 0.25rem;
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
}

.markets-resources__item p {
  margin: 0 0 0.4rem;
  color: #78909c;
  font-size: 0.76rem;
  line-height: 1.45;
}

.markets-resources__item a {
  display: block;
  color: #4fc3f7;
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
}

.markets-resources__item a + a {
  margin-top: 0.25rem;
}

.markets-resources__item a:hover {
  color: #81d4fa;
  text-decoration: underline;
}

@media (max-width: 1023px) {
  .markets-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .markets-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 799px) {
  .markets-side {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .markets-tools-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
