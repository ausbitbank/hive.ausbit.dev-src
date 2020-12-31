<template>
    <span>
    <q-spinner-grid size="2em" color="primary" v-if="!coinGecko" />
    <span v-if="coinGecko">
    <q-card flat bordered v-for="coin in coinGecko" :key="coin.index">
        <q-card-section class="text-center">
            <div class="text-h6"><q-avatar><q-img :src="coin.image" /></q-avatar> {{ coin.name }}</div>
                <sparkline width="250" height="60" v-if="coin.sparkline_in_7d">
                    <sparklineCurve :data="coin.sparkline_in_7d.price" :limit="coin.sparkline_in_7d.price.length" :styles="sparklineStyle" :spotStyles="spotStyle" :spotProps="spotProps" refLineType='avg' />
                </sparkline>
            <div><span class="text-bold">Current Price: </span> <span :class="getCoinColorClass(coin)">${{ tidyNumber(coin.current_price.toFixed(3)) }}</span></div>
            <div><span class="text-bold">Market Cap: </span> ${{ tidyNumber(coin.market_cap) }}</div>
            <div><span class="text-bold">Total Volume: </span> ${{ tidyNumber(coin.total_volume) }}</div>
            <div><span class="text-bold">24hr Range: </span> <span>${{ tidyNumber(coin.low_24h.toFixed(3)) }} - ${{ tidyNumber(coin.high_24h.toFixed(3)) }}</span></div>
            <div><span class="text-bold">24Hr Change: </span> <span :class="getCoinColorClass(coin)">${{ tidyNumber(coin.price_change_24h.toFixed(3)) }} ({{ coin.price_change_percentage_24h.toFixed(3) }}%)</span></div>
            <div><span class="text-bold">All Time High: </span> $ <span>{{ tidyNumber(coin.ath.toFixed(3)) }}</span>  <span class="text-red">({{ coin.ath_change_percentage.toFixed(3) }} %)</span></div>
            <div><span class="text-bold">All Time Low: </span> $ <span>{{ tidyNumber(coin.atl.toFixed(3)) }}</span>  <span class="text-green">({{ coin.atl_change_percentage.toFixed(3) }} %)</span></div>
        </q-card-section>
    </q-card>
    <q-card flat bordered>
        <q-card-section class="text-center">
            <q-btn icon="settings" label="Settings" color="primary" dense @click="settingsDialog = true" />
            <q-dialog v-model="settingsDialog">
                <q-card>
                    <q-card-section>
                        <q-select filled v-model="coins" multiple :options="coinList" use-chips stack-label label="Coins" />
                        <q-input v-model="currency" label="Currency" />
                        <q-input v-model="sortOrder" label="Sort Order" />
                        <q-toggle left-label v-model="sparklineEnabled" label="Sparkline Chart" />
                        <div><q-btn push label="Update" icon="save" color="primary" @click="getCoinGecko(); settingsDialog = false" /></div>
                    </q-card-section>
                </q-card>
            </q-dialog>
            <div class="text-caption">Priced in <span class="text-bold" @click="this.settingsDialog = true">{{ this.currency }}</span> via <a href="https://coingecko.com">coingecko</a></div>
            <div v-if="this.$route.path !== '/markets'"><router-link to="markets"><q-btn dense push icon="link" /></router-link></div>
        </q-card-section>
    </q-card>
    </span>
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import sparkline from 'vue-sparklines'
export default {
  name: 'Home',
  data () {
    return {
      coinGecko: null,
      sparklineIndicatorStyle: false,
      sparklineStyle: { stroke: '#54a5ff' },
      spotStyle: { fill: '#54a5ff' },
      spotProps: { size: 2 },
      sparklineEnabled: 'true',
      coins: ['hive', 'hive_dollar', 'bitcoin'],
      coinList: ['hive', 'hive_dollar', 'bitcoin', 'ethereum', 'link', 'litecoin', 'eos', 'monero', 'dash', 'uniswap', 'yearn.finance', 'dogecoin', 'steem', 'steem_dollar', 'tron'],
      currency: 'usd',
      sortOrder: 'market_cap_asc',
      settingsDialog: false
      // url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hive%2C%20hive_dollar&order=market_cap_desc&per_page=2&page=1&sparkline=true'
    }
  },
  components: {
    sparkline
  },
  computed: {
    apiUrl: function () {
      var prefix = 'https://api.coingecko.com/api/v3/coins/markets?'
      var coinString = this.coins.join('%2C%20')
      var parameters = 'vs_currency=' + this.currency + '&' + 'ids=' + coinString + '&order=' + this.sortOrder + '&per_page=' + this.coins.length + '&page=1&sparkline=' + this.sparklineEnabled
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
      // console.log('Calling coingecko api: ' + this.apiUrl)
      this.$axios.get(this.apiUrl)
        .then((response) => { this.coinGecko = response.data })
        .catch(() => { console.log('Failed to load data from coingecko api') })
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
