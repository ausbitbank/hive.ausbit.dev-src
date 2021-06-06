<template>
    <span v-if="coinGecko !== null">
    <q-card bordered>
      <div class="text-h6 text-center">
        <router-link to="markets" class="text-primary"><q-icon name="monetization_on" color="green" />&nbsp; Coin Prices</router-link>
      </div>
      <q-carousel
        v-if="coinGecko.length > 0"
        v-model="slide"
        transition-prev="jump-left"
        transition-next="jump-right"
        swipeable
        animated
        control-color="primary"
        padding
        arrows
        infinite
        :autoplay="autoplaySlides"
        height="260px"
        width="450px"
        @mouseenter="autoplaySlides = false"
        class="bg-dark text-white shadow-2 rounded-borders"
      >
        <q-carousel-slide :name="coin.name" class="column no-wrap flex-center" v-for="coin in coinGecko" :key="coin.name" :img-src="coin.image">
          <div class="custom-caption">
            <div class="text-bold">
              <q-avatar size="sm"><q-img :src="coin.image" /></q-avatar> <a :href="returnCoinGeckoLink(coin.id)" target="_blank">{{ coin.name }}</a> <span v-if="coin.market_cap_rank" class="caption text-grey">#{{ coin.market_cap_rank }}</span>
            </div>
            <sparkline width="250" height="60" v-if="coin.sparkline_in_7d">
                <sparklineCurve :data="coin.sparkline_in_7d.price" :limit="coin.sparkline_in_7d.price.length" :styles="sparklineStyle" :spotStyles="spotStyle" :spotProps="spotProps" refLineType='avg' />
            </sparkline>
            <div><span class="text-bold">Current Price: </span> <span :class="getCoinColorClass(coin)">${{ tidyNumber(coin.current_price.toFixed(3)) }}</span></div>
            <div v-if="coin.market_cap && coin.market_cap > 0"><span class="text-bold">Market Cap: </span> ${{ tidyNumber(coin.market_cap) }}</div>
            <div><span class="text-bold">Total Volume: </span> ${{ tidyNumber(coin.total_volume) }}</div>
            <div v-if="coin.low_24h && coin.high_24h"><span class="text-bold">24hr Range: </span> <span>${{ tidyNumber(coin.low_24h.toFixed(3)) }} - ${{ tidyNumber(coin.high_24h.toFixed(3)) }}</span></div>
            <div v-if="coin.price_change_24h && coin.price_change_percentage_24h"><span class="text-bold">24Hr Change: </span> <span :class="getCoinColorClass(coin)">${{ tidyNumber(coin.price_change_24h.toFixed(3)) }} ({{ coin.price_change_percentage_24h.toFixed(3) }}%)</span></div>
            <div><span class="text-bold">All Time High: </span> $ <span>{{ tidyNumber(coin.ath.toFixed(3)) }}</span>  <span class="text-red">({{ coin.ath_change_percentage.toFixed(3) }} %)</span></div>
            <div><span class="text-bold">All Time Low: </span> $ <span>{{ tidyNumber(coin.atl.toFixed(3)) }}</span>  <span class="text-green">({{ coin.atl_change_percentage.toFixed(3) }} %)</span></div>
          </div>
        </q-carousel-slide>
      </q-carousel>
    <div class="text-center">
      <div class="text-caption">Priced in <span class="text-bold text-primary" @click="settingsDialog = true">{{ currency }}</span> via <router-link to="/@coingecko">coingecko</router-link></div>
      <q-btn push icon="settings" title="Settings" color="primary" flat bordered dense @click="settingsDialog = true" />
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
    </div>
    </q-card>
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
.custom-caption { text-align: center; padding: 12px; font-weight: normal; color: white; background-color: rgba(0, 0, 0, .9) }
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
      coinList: ['hive', 'hive_dollar', 'bitcoin', 'ethereum', 'link', 'litecoin', 'eos', 'monero', 'dash', 'cub-finance', 'wrapped-leo', 'uniswap', 'yearn.finance', 'dogecoin', 'steem', 'steem_dollar', 'tron'],
      currency: 'usd',
      sortOrder: 'market_cap_asc',
      settingsDialog: false,
      autoplaySlides: true,
      slide: null
      // url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hive%2C%20hive_dollar&order=market_cap_desc&per_page=2&page=1&sparkline=true'
    }
  },
  components: {
    sparkline
  },
  props: {
    coins: {
      type: Array,
      required: false,
      default () {
        return ['hive', 'hive_dollar', 'bitcoin', 'ethereum', 'eos', 'cub-finance']
      }
    }
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
      this.$axios.get(this.apiUrl)
        .then((response) => { this.coinGecko = response.data; this.slide = response.data[0].id })
        .catch(() => { console.log('Failed to load data from coingecko api') })
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    returnCoinGeckoLink (coin) {
      return 'https://coingecko.com/en/coins/' + coin.toLowerCase()
    }
  },
  mounted () {
    this.getCoinGecko()
  }
}
</script>
