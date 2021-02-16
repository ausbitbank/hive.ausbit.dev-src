<template>
<q-card dense class="q-ml-md q-pa-none text-center" v-if="this.internalMarket.bids.length > 0">
<q-card-section>
<q-list separator dense>
    <q-item-label class="text-h5">Hive Internal Market</q-item-label>
    <q-item-label class="text-h6">Offers to sell</q-item-label>
    <q-item dense v-for="amt in [5000, 1000, 100, 10, 1]" :key="amt.index">
    <div style="margin:auto">{{amt}} <q-icon name="img:statics/hbd.svg" title="HBD" /> of <q-icon name="img:statics/hextacular.svg" title="Hive" /> @ <b>{{ getPrice(getMarketOrderAtDepth(internalMarket.asks, amt)) }}</b></div>
    </q-item>
    <q-separator />
    <q-item-label class="text-h6">Offers to buy</q-item-label>
    <q-item dense v-for="amt in [1, 10, 100, 1000, 5000]" :key="amt.index">
    <div style="margin:auto">{{amt}} <q-icon name="img:statics/hbd.svg" title="HBD" /> of bids @ <b>{{ getPrice(getMarketOrderAtDepth(internalMarket.bids, amt)) }}</b></div>
    </q-item>
    <q-item-label class="text-h6">Recent Trades</q-item-label>
    <q-item dense v-for="trade in internalMarket.trades" :key="trade.index">
    <q-item-section v-if="getTradeLine(trade).action === 'buy'">
        <div>{{ getTradeLine(trade).maker.split(' ')[0] }} <q-icon name="img:statics/hextacular.svg" title="Hive" /> <span class="text-red"> sold</span> @ <b>{{ getTradeLine(trade).price }}</b></div>
    </q-item-section>
    <q-item-section v-else>
        <div>{{ getTradeLine(trade).taker.split(' ')[0] }} <q-icon name="img:statics/hextacular.svg" title="Hive" /> <span class="text-green"> bought</span> @ <b>{{ getTradeLine(trade).price }}</b></div>
    </q-item-section>
    <q-item-section side>
        <q-icon name="history" color="grey" /><span class="text-caption text-grey"> {{ timeDelta(trade.date) }}</span>
    </q-item-section>
    </q-item>
</q-list>
</q-card-section>
<q-card-actions class="text-center" v-if="false">
<q-btn flat glossy round @click="refresh()" icon="refresh" color="primary" style="margin: auto" />
</q-card-actions>
</q-card>
</template>
<script>
import moment from 'moment'
export default {
  name: 'internalMarket',
  data () {
    return {
      internalMarket: {
        bids: {},
        asks: {},
        trades: []
      },
      internalMarketEnabled: this.$router.currentRoute.query.internalMarketEnabled || true,
      internalMarketDepth: this.$router.currentRoute.query.internalMarketDepth || 100
    }
  },
  methods: {
    getMarketOrderAtDepth (orderArray, hbdDeep) {
      var arr = orderArray.filter(a => (a.hbdDepth >= hbdDeep))
      if (orderArray === this.internalMarket.asks) {
        return arr[arr.length - 1]
      } else {
        return arr[0]
      }
    },
    getPrice (order) {
      if (order === undefined) { return null }
      return parseFloat(order.real_price).toFixed(3)// + ' ($' + order.hbdDepth.toFixed(0) + ')'
    },
    getTradeLine (trade) {
      var price = 0
      var maker = trade.open_pays
      var taker = trade.current_pays
      if (maker.split(' ')[1] === 'HBD') {
        price = (maker.split(' ')[0] / taker.split(' ')[0]).toFixed(3)
        return { taker: taker, maker: maker, price: price, action: 'sell' }
        // return taker + ' sold @ ' + price
      } else {
        price = (taker.split(' ')[0] / maker.split(' ')[0]).toFixed(3)
        return { taker: taker, maker: maker, price: price, action: 'buy' }
        // return maker + ' bought @ ' + price
      }
    },
    getMarketInfo (depth) {
      this.$hive.api.getMarketOrderBookAsync(depth)
        .then(result => {
          this.internalMarket.bids = result.bids
          this.internalMarket.asks = result.asks
          this.addMarketDepth()
        })
    },
    getRecentTrades (limit) {
      this.$hive.api.getRecentTradesAsync(limit)
        .then(res => {
          this.internalMarket.trades = res
        })
    },
    addMarketDepth () {
      var hiveDepth = 0
      var hbdDepth = 0
      this.internalMarket.bids.forEach(b => {
        hiveDepth = hiveDepth + (b.hive / 100)
        hbdDepth = hbdDepth + (b.hbd / 100)
        b.hiveDepth = hiveDepth
        b.hbdDepth = hbdDepth
      })
      hiveDepth = 0
      hbdDepth = 0
      this.internalMarket.asks.forEach(b => {
        hiveDepth = hiveDepth + (b.hive / 100)
        hbdDepth = hbdDepth + (b.hbd / 100)
        b.hiveDepth = hiveDepth
        b.hbdDepth = hbdDepth
      })
      this.internalMarket.asks = this.internalMarket.asks.reverse()
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    refreshMarket () {
      if (this.internalMarketEnabled) {
        this.internalMarket.bids = {}
        this.internalMarket.asks = {}
        this.internalMarket.trades = []
        this.getMarketInfo(this.internalMarketDepth)
        this.getRecentTrades(10)
      }
    }
  },
  mounted () {
    this.refreshMarket()
  }
}
</script>
