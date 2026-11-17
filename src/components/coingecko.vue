<template>
    <span>
    <template v-if="coinGecko">
    <q-card flat bordered dense v-for="coin in coinGecko" :key="coin.index">
        <q-card-section class="text-center">
            <div class="text-h6"><q-avatar><q-img :src="coin.image" :alt="coin.name + ' logo'" /></q-avatar> {{ coin.name }} <a :href="getCoinGeckoLink(coin)" target="_blank" rel="noopener noreferrer" title="View coin on coingecko" aria-label="View coin on coingecko"><q-icon name="open_in_new" aria-hidden="true" /></a></div>
                <sparkline :data="coin.sparkline_in_7d.price" :width="250" :height="60" :stroke="sparklineStyle.stroke" v-if="coin.sparkline_in_7d" />
            <div><span class="text-bold">Current Price: </span> <span :class="getCoinColorClass(coin)">${{ tidyNumber(coin.current_price.toFixed(3)) }}</span></div>
            <div v-if="coin.market_cap !== 0"><span class="text-bold">Market Cap: </span> ${{ tidyNumber(coin.market_cap) }}</div>
            <div><span class="text-bold">Total Volume: </span> ${{ tidyNumber(coin.total_volume) }}</div>
            <div><span class="text-bold">24hr Range: </span> <span>${{ tidyNumber(coin.low_24h.toFixed(3)) }} - ${{ tidyNumber(coin.high_24h.toFixed(3)) }}</span></div>
            <div><span class="text-bold">24Hr Change: </span> <span :class="getCoinColorClass(coin)">${{ tidyNumber(coin.price_change_24h.toFixed(3)) }} ({{ coin.price_change_percentage_24h.toFixed(3) }}%)</span></div>
            <div><span class="text-bold">All Time High: </span> $ <span>{{ tidyNumber(coin.ath.toFixed(3)) }}</span>  <span class="text-red"> ({{ coin.ath_change_percentage.toFixed(3) }} %)</span></div>
            <div><span class="text-bold">All Time Low: </span> $ <span>{{ tidyNumber(coin.atl.toFixed(3)) }}</span>  <span class="text-green"> ({{ coin.atl_change_percentage.toFixed(3) }} %)</span></div>
        </q-card-section>
    </q-card>
    <div class="text-center">
      <div class="text-caption">Priced in <span class="text-bold" @click="settingsDialog = true">{{ currency }}</span> via <a href="https://coingecko.com">coingecko</a></div>
      <q-btn push icon="settings" title="Price settings" aria-label="Price settings" color="primary" flat bordered dense @click="settingsDialog = true" />
      <q-dialog v-model="settingsDialog">
          <q-card flat bordered>
              <q-card-section>
                  <q-select filled v-model="selectedCoins" multiple :options="coinList" use-chips stack-label label="Coins" />
                  <q-input v-model="currency" label="Currency" />
                  <q-input v-model="sortOrder" label="Sort Order" />
                  <q-toggle left-label v-model="sparklineEnabled" label="Sparkline Chart" />
                  <div><q-btn push label="Update" icon="save" color="primary" @click="getCoinGecko(); settingsDialog = false" /></div>
              </q-card-section>
          </q-card>
      </q-dialog>
      <span v-if="$route.path !== '/markets'"><router-link to="markets" aria-label="Open the markets page"><q-btn dense flat push icon="link" title="Markets" aria-label="Markets" /></router-link></span>
    </div>
    </template>
    <q-card v-else-if="priceError" flat bordered class="q-my-md q-pa-lg text-center text-grey-4 bg-dark">
      <q-icon name="cloud_off" size="2em" color="orange" />
      <div class="text-subtitle1 q-mt-sm">Price data unavailable</div>
      <div class="text-caption">CoinGecko could not be reached. Prices will refresh when you retry.</div>
      <q-btn flat dense color="primary" icon="refresh" label="Retry" class="q-mt-sm" @click="getCoinGecko()" />
    </q-card>
    <q-skeleton v-else :height="$q.screen.lt.sm ? '320px' : '260px'" width="100%" rect />
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import Sparkline from 'components/Sparkline.vue'
export default {
  name: 'Home',
  data () {
    return {
      coinGecko: null,
      selectedCoins: [...(this.coins || [])],
      sparklineIndicatorStyle: false,
      sparklineStyle: { stroke: '#54a5ff', fill: '#aaaaaa' },
      spotStyle: { fill: '#54a5ff' },
      spotProps: { size: 2 },
      sparklineEnabled: 'true',
      coinList: ['hive', 'hive_dollar', 'bitcoin', 'ethereum', 'litecoin', 'monero', 'dogecoin', 'solana', 'cardano', 'polkadot'],
      currency: 'usd',
      sortOrder: 'market_cap_asc',
      settingsDialog: false,
      priceError: false
      // url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hive%2C%20hive_dollar&order=market_cap_desc&per_page=2&page=1&sparkline=true'
    }
  },
  components: {
    Sparkline
  },
  props: {
    coins: {
      type: Array,
      required: false,
      default () {
        return ['hive', 'hive_dollar', 'bitcoin']
      }
    }
  },
  computed: {
    apiUrl: function () {
      var prefix = 'https://api.coingecko.com/api/v3/coins/markets?'
      var coinString = this.selectedCoins.join('%2C%20')
      var parameters = 'vs_currency=' + this.currency + '&' + 'ids=' + coinString + '&order=' + this.sortOrder + '&per_page=' + this.selectedCoins.length + '&page=1&sparkline=' + this.sparklineEnabled
      var url = prefix + parameters
      return url
    }
  },
  methods: {
    getCoinColorClass (coin) {
      if (Math.sign(coin.price_change_24h) === -1) {
        return 'text-red'
      } else if (Math.sign(coin.price_change_24h) === 1) {
        return 'text-green'
      } else {
        return 'text-black'
      }
    },
    getCoinGecko () {
      this.coinGecko = null
      this.priceError = false
      this.$axios.get(this.apiUrl)
        .then((response) => {
          if (!Array.isArray(response.data) || response.data.length === 0) {
            this.priceError = true
            return
          }
          this.coinGecko = response.data
        })
        .catch(() => {
          this.priceError = true
        })
    },
    getCoinGeckoLink (coin) {
      return 'https://coingecko.com/en/coins/' + coin.id
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    }
  },
  mounted () {
    this.getCoinGecko()
  }
}
</script>
