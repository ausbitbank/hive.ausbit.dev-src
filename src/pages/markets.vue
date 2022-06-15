<template>
  <q-page class="flex q-pa-md flex-center">
    <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut"><div><tradingView class="q-ml-md" :options="tvOptions" /></div></transition>
    <internalMarket />
  </q-page>
</template>
<script>
import tradingView from 'vue-trading-view'
// import coingeckoCarousel from 'components/coingeckoCarousel.vue'
import internalMarket from 'components/internalMarket.vue'
export default {
  name: 'markets',
  data () {
    return {
      tvOptions: {
        symbol: this.$route.params.ticker || 'BINANCE:HIVEUSDT',
        interval: '240',
        isTransparent: false,
        width: 1000,
        height: 1000,
        autosize: false,
        showIntervalTabs: true,
        locale: 'en',
        theme: 'dark',
        style: 8,
        withdateranges: true,
        details: true,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        toolbar_bg: '#1d1d1d',
        watchlist: [
          'BINANCE:HIVEUSDT',
          'BITTREX:HIVEUSD',
          'BITTREX:HIVEUSDT',
          'HUOBI:HIVEUSDT',
          'BINANCE:HIVEBTC',
          'BITTREX:HIVEBTC',
          'HUOBI:HIVEBTC',
          'BITHUMB:HIVEKRW',
          'BITTREX:HBDBTC',
          'BITTREX:HBDUSD',
          'CRYPTOCAP:BTC.D',
          'BITSTAMP:BTCUSD',
          'BINANCE:HIVEBTC*BINANCE:BTCAUD'
        ]
      }
    }
  },
  computed: {
  },
  components: { tradingView, internalMarket },
  mounted () {
    document.title = 'Markets'
  }
}
</script>
