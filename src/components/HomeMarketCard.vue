<template>
  <q-card flat bordered class="home-card home-panel home-market">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Markets</div>
        <h2 class="home-panel__title">Coin prices</h2>
      </div>
      <div class="home-panel__actions">
        <q-btn flat dense round icon="refresh" aria-label="Refresh prices" title="Refresh prices" :loading="refreshing" @click="loadPrices" />
        <router-link to="/markets" class="home-panel__link">Markets</router-link>
      </div>
    </q-card-section>

    <q-card-section v-if="loading && coins.length === 0" class="home-panel__body">
      <div v-for="i in 4" :key="i" class="home-market-skeleton">
        <q-skeleton type="circle" size="26px" />
        <div class="home-market-skeleton__body">
          <q-skeleton type="text" width="35%" />
          <q-skeleton type="text" width="22%" />
        </div>
        <q-skeleton type="text" width="60px" />
      </div>
    </q-card-section>

    <q-card-section v-else-if="error && coins.length === 0" class="home-panel__state">
      <q-icon name="cloud_off" size="24px" color="orange" aria-hidden="true" />
      <span>Price data unavailable.</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadPrices" />
    </q-card-section>

    <template v-else>
      <div class="home-market-list">
        <a
          v-for="coin in rows"
          :key="coin.id"
          :href="coin.href"
          target="_blank"
          rel="noopener noreferrer"
          class="home-market-row"
          :class="{ 'home-market-row--hive': coin.isHive }"
          :title="coin.title"
          :aria-label="coin.ariaLabel"
        >
          <q-avatar size="28px">
            <q-img :src="coin.image" :alt="coin.name + ' logo'" />
          </q-avatar>
          <div class="home-market-row__name">
            <span class="home-market-row__symbol">{{ coin.symbol }}</span>
            <span class="home-market-row__coin">{{ coin.name }}</span>
          </div>
          <sparkline
            v-if="coin.sparkline"
            :data="coin.sparkline"
            :width="64"
            :height="22"
            :stroke="coin.stroke"
            fill="none"
            class="home-market-row__spark"
          />
          <div class="home-market-row__quote">
            <span class="home-market-row__price">{{ coin.price }}</span>
            <span class="home-market-row__change" :class="coin.changeClass">{{ coin.change }}</span>
          </div>
          <q-icon name="open_in_new" size="14px" class="home-market-row__external" aria-hidden="true" />
        </a>
      </div>

      <div v-if="error" class="home-market__error">
        <q-icon name="warning" size="14px" color="orange" aria-hidden="true" />
        Last refresh failed.
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadPrices" />
      </div>

      <q-card-section class="home-panel__footer">
        <span>24h change · priced in USD</span>
        <span>via CoinGecko<span v-if="updatedLabel"> · {{ updatedLabel }}</span></span>
      </q-card-section>
    </template>
  </q-card>
</template>

<style scoped>
.home-market-list {
  display: flex;
  flex-direction: column;
}

.home-market-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.58rem 1rem;
  border-top: 1px solid var(--border-subtle);
  color: inherit;
  text-decoration: none;
}

.home-market-row:first-child {
  border-top: 0;
}

.home-market-row:hover {
  background: rgba(255, 255, 255, 0.035);
}

.home-market-row__name {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.home-market-row__symbol {
  color: #e4eaed;
  font-size: 0.82rem;
  font-weight: 600;
}

.home-market-row--hive .home-market-row__symbol {
  color: #81d4fa;
}

.home-market-row__coin {
  overflow: hidden;
  color: #78909c;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-market-row__spark {
  flex: none;
  opacity: 0.9;
}

.home-market-row__quote {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.05rem;
  min-width: 76px;
}

.home-market-row__price {
  color: #e4eaed;
  font-size: 0.82rem;
  font-weight: 600;
}

.home-market-row__change {
  font-size: 0.68rem;
  font-weight: 600;
}

.home-market-row__external {
  flex: none;
  color: #607d8b;
}

.home-market__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  padding: 0.35rem 0.8rem;
  color: #ffb74d;
  font-size: 0.72rem;
}

.home-market-skeleton {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0;
}

.home-market-skeleton__body {
  flex: 1;
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

@media (max-width: 599px) {
  .home-market-row {
    padding: 0.55rem 0.8rem;
  }

  .home-market-row__external {
    display: none;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import Sparkline from 'components/Sparkline.vue'
import {
  changeClass,
  formatPercent,
  formatUsd,
  sortMarketCoins
} from 'src/services/home'

const API_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hive,hive_dollar,bitcoin,ethereum&order=market_cap_desc&per_page=4&page=1&sparkline=true&price_change_percentage=24h'
const COIN_ORDER = ['hive', 'hive_dollar', 'bitcoin', 'ethereum']

export default {
  name: 'homeMarketCard',
  components: { Sparkline },
  data () {
    return {
      coins: [],
      loading: true,
      refreshing: false,
      error: '',
      updatedAt: null
    }
  },
  computed: {
    rows () {
      return sortMarketCoins(this.coins, COIN_ORDER).map(coin => {
        const change = Number(coin.price_change_percentage_24h)
        return {
          id: coin.id,
          symbol: String(coin.symbol || '').toUpperCase(),
          name: coin.name,
          image: coin.image,
          isHive: coin.id === 'hive' || coin.id === 'hive_dollar',
          price: formatUsd(coin.current_price),
          change: formatPercent(change),
          changeClass: changeClass(change),
          sparkline: coin.sparkline_in_7d && coin.sparkline_in_7d.price,
          stroke: change < 0 ? '#ef5350' : '#66bb6a',
          href: 'https://www.coingecko.com/en/coins/' + coin.id,
          title: coin.name + ' · market cap $' + Number(coin.market_cap || 0).toLocaleString('en-US') + ' · 24h volume $' + Number(coin.total_volume || 0).toLocaleString('en-US'),
          ariaLabel: coin.name + ' price ' + formatUsd(coin.current_price) + ', 24 hour change ' + formatPercent(change)
        }
      })
    },
    updatedLabel () {
      return this.updatedAt ? moment.utc(this.updatedAt).fromNow() : ''
    }
  },
  mounted () {
    this.loadPrices()
  },
  methods: {
    async loadPrices () {
      const hasCoins = this.coins.length > 0
      if (hasCoins) this.refreshing = true
      else this.loading = true
      this.error = ''

      try {
        const response = await this.$axios.get(API_URL)
        if (!Array.isArray(response.data) || response.data.length === 0) {
          throw new Error('Empty price response')
        }
        this.coins = response.data
        this.updatedAt = Date.now()
      } catch (error) {
        console.error('Failed to load home prices', error)
        this.error = 'Price data unavailable.'
      } finally {
        this.loading = false
        this.refreshing = false
      }
    }
  }
}
</script>
