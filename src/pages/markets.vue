<template>
  <q-page class="flex q-pa-md flex-center">
    <h1 class="sr-only">Hive markets</h1>
    <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut"><div><trading-view-widget class="q-ml-md" :options="tvOptions" /></div></transition>
    <internalMarket />
  </q-page>
</template>
<script>
import TradingViewWidget from 'components/TradingViewWidget.vue'
import internalMarket from 'components/internalMarket.vue'
import { setPageMeta } from 'src/utils/pageMeta'
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
    setPageMeta({
      title: 'Hive markets — HIVE price charts and internal market',
      description: 'HIVE price charts, trading pairs and the Hive internal market for HIVE and HBD on hive.ausbit.dev.',
      url: '/markets'
    })
  }
}
</script>
