<template>
  <q-page class="flex q-pa-md flex-center">
    <div><coingecko /></div>
    <div><tradingView class="q-ml-md" :options="tvOptions" /></div>
  </q-page>
</template>
<script>
import tradingView from 'vue-trading-view'
import coingecko from 'components/coingecko.vue'
export default {
  name: 'markets',
  data () {
    return {
      tvOptions: {
        symbol: 'BINANCE:HIVEUSDT',
        interval: '240',
        isTransparent: false,
        width: 1000,
        height: 970,
        autosize: false,
        showIntervalTabs: true,
        locale: 'en',
        theme: 'dark',
        style: 8,
        withdateranges: true,
        details: true,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        watchlist: [
          'BINANCE:HIVEUSDT',
          'BITTREX:HIVEUSD',
          'BITTREX:HIVEUSDT',
          'HUOBI:HIVEUSDT',
          'BINANCE:HIVEBTC',
          'BITTREX:HIVEBTC',
          'HUOBI:HIVEBTC',
          'BITTREX:HBDBTC',
          'BITTREX:HBDUSD',
          'CRYPTOCAP:BTC.D',
          'BITSTAMP:BTCUSD'
        ]
      }
    }
  },
  components: { coingecko, tradingView },
  mounted () {
    document.title = 'Markets'
  }
}
</script>
