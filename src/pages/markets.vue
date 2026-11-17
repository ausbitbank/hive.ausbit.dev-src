<template>
  <q-page class="flex q-pa-md flex-center">
    <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut"><div><trading-view-widget class="q-ml-md" :options="tvOptions" /></div></transition>
    <internalMarket />
  </q-page>
</template>
<script>
import TradingViewWidget from 'components/TradingViewWidget.vue'
import internalMarket from 'components/internalMarket.vue'
export default {
  name: 'markets',
  data () {
    return {
      tvOptions: {
        symbol: this.$route.query.ticker || 'BINANCE:HIVEUSDT',
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
          'BINANCE:HIVEBTC',
          'BITHUMB:HIVEKRW',
          'UPBIT:HIVEBTC',
          'CRYPTOCAP:BTC.D',
          'BITSTAMP:BTCUSD'
        ]
      }
    }
  },
  computed: {
  },
  components: { TradingViewWidget, internalMarket },
  mounted () {
    document.title = 'Markets'
  }
}
</script>
