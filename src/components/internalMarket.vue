<template>
<div>
<q-card bordered dense class="q-ml-md q-pa-none text-center" v-if="this.internalMarket.bids.length > 0">
<q-card-section>
<q-list separator dense class="q-pa-none q-ma-none">
    <q-item-label class="text-h5"><q-icon name="img:statics/hive.svg" title="Hive" /> Internal Market</q-item-label>
    <q-expansion-item dense expand-separator label="Ticker" icon="analytics" header-class="text-orange" default-opened>
    <q-item dense v-for="(stat, index) in internalMarket.ticker" :key="index">
      <q-item-section>
        {{ index.replace('_',' ') }}
      </q-item-section>
      <q-item-section v-if="['latest', 'lowest_ask', 'highest_bid', 'percent_change'].includes(index)"><b>{{ parseFloat(stat).toFixed(3) }} <q-icon name="img:statics/hbd.svg" title="HBD" v-if="['latest', 'lowest_ask', 'highest_bid'].includes(index)" /><span v-if="index === 'percent_change'">%</span></b></q-item-section>
      <q-item-section v-else><b>{{ tidyNumber(stat.split(' ')[0]) }} <q-icon name="img:statics/hbd.svg" title="HBD" v-if="stat.split(' ')[1] === 'HBD'"/><q-icon name="img:statics/hive.svg" title="HIVE" v-if="stat.split(' ')[1] === 'HIVE'"/></b></q-item-section>
    </q-item>
    <q-item dense v-if="hiveUsd" title="Hive external market prices from coingecko api">
      <q-item-section>
        hive usd
      </q-item-section>
      <q-item-section>
        $ {{ hiveUsd }}
      </q-item-section>
    </q-item>
    <q-item dense v-if="hbdUsd" title="HBD external market prices from coingecko api">
      <q-item-section>
        hbd usd
      </q-item-section>
      <q-item-section>
        $ {{ hbdUsd }}
      </q-item-section>
    </q-item>
    </q-expansion-item>
    <q-expansion-item dense expand-separator label="Offers to sell" icon="trending_up" header-class="text-green" default-closed>
    <q-item dense v-for="amt in [50000, 10000, 5000, 1000, 100, 10]" :key="amt.index">
    <div style="margin:auto">{{tidyNumber(amt)}} <q-icon name="img:statics/hbd.svg" title="HBD" /> of <q-icon name="img:statics/hive.svg" title="Hive" /> @ <q-btn dense flat @click="tab = 'buy'; buyPrice = getPrice(getMarketOrderAtDepth(internalMarket.asks, amt)); buyTotal = (buyPrice * buyAmount).toFixed(3)" :label="getPrice(getMarketOrderAtDepth(internalMarket.asks, amt))" /></div>
    </q-item>
    </q-expansion-item>
    <q-separator />
    <q-expansion-item dense expand-separator label="Offers to buy" icon="trending_down" header-class="text-red" default-closed>
    <q-item dense v-for="amt in [10, 100, 1000, 5000, 10000]" :key="amt.index">
    <div style="margin:auto">{{tidyNumber(amt)}} <q-icon name="img:statics/hbd.svg" title="HBD" /> of <q-icon name="img:statics/hive.svg" title="Hive" /> @ <q-btn dense flat @click="tab = 'sell'; sellPrice = getPrice(getMarketOrderAtDepth(internalMarket.bids, amt)); sellTotal = (sellPrice * sellAmount).toFixed(3)" :label="getPrice(getMarketOrderAtDepth(internalMarket.bids, amt))" /></div>
    </q-item>
    </q-expansion-item>
    <q-expansion-item dense expand-separator label="Last 100 Trades" icon="receipt" header-class="text-grey" default-closed>
    <q-scroll-area dark class="bg-dark text-white" style="height: 300px; min-width: 300px" :thumb-style="{ width: '5px', borderRadius: '5px', opacity: 0.2, backgroundColor: '#3e92cc' }">
    <q-item dense v-for="trade in internalMarket.trades" :key="trade.index">
    <q-item-section v-if="getTradeLine(trade).action === 'buy'">
        <div>{{ getTradeLine(trade).maker.split(' ')[0] }} <q-icon name="img:statics/hive.svg" title="Hive" /> <span class="text-red"> sold</span> @ <b>{{ getTradeLine(trade).price }}</b></div>
    </q-item-section>
    <q-item-section v-else>
        <div>{{ getTradeLine(trade).taker.split(' ')[0] }} <q-icon name="img:statics/hive.svg" title="Hive" /> <span class="text-green"> bought</span> @ <b>{{ getTradeLine(trade).price }}</b></div>
    </q-item-section>
    <q-item-section side>
        <span class="text-caption text-grey"> {{ timeDelta(trade.date) }}</span>
    </q-item-section>
    </q-item>
    </q-scroll-area>
    </q-expansion-item>
</q-list>
</q-card-section>
<q-card-section v-if="!loggedInUser" class="text-bold">
  <q-icon name="info" color="primary" /> Login to trade on the internal market
</q-card-section>
<q-card-actions v-if="true">
<q-btn flat glossy round @click="refreshMarket()" icon="refresh" color="primary" style="margin: auto" /><br />
<q-btn flat glossy round type="a" to="/market" v-if="this.$route.path !== '/market'" icon="link" style="margin: auto" />
</q-card-actions>
</q-card>
<q-card bordered dense class="q-ml-md q-pa-none text-center" v-if="loggedInUser">
  <q-tabs v-model="tab" dense align="justify" narrow-indicator indicator-color="primary">
    <q-tab name="buy" label="Buy" class="text-green" />
    <q-tab name="sell" label="Sell" class="text-red" />
    <q-tab name="orders" class="text-orange" v-if="openOrders.length > 0">Orders  <q-badge color="red" transparent>{{ openOrders.length }}</q-badge></q-tab>
  </q-tabs>
  <q-separator />
  <q-tab-panels v-model="tab" animated>
    <q-tab-panel name="buy" label="Buy">
      <q-form>
        <q-input v-model="buyPrice" label="Price HBD/HIVE" @input="buyTotal = (buyPrice * buyAmount).toFixed(3)" />
        <q-input v-model="buyAmount" label="Amount HIVE" @input="buyTotal = (buyPrice * buyAmount).toFixed(3)" />
        <q-input v-model="buyTotal" label="Total HBD ($)" @input="buyAmount = (buyTotal / buyPrice).toFixed(3)" />
        <q-checkbox v-model="fillOrKill" label="Fill or Kill" title="An order must be completely filled, or else cancelled. No partial trades" v-if="false" />
        <div>Available:<q-btn flat :label="balanceHbd" @click="buyTotal = balanceHbd; buyAmount = (buyTotal / buyPrice).toFixed(3)" /> HBD</div>
        <div>Lowest Ask:<q-btn flat :label="parseFloat(internalMarket.ticker.lowest_ask).toFixed(3)" @click="buyPrice = parseFloat(internalMarket.ticker.lowest_ask).toFixed(3); buyAmount = (buyTotal / buyPrice).toFixed(3)"/></div>
        <q-btn glossy flat color="green" icon="trending_up" label="Buy Hive" @click="submitOrder(buyTotal + ' HBD', buyAmount + ' HIVE')" />
      </q-form>
    </q-tab-panel>
    <q-tab-panel name="sell" label="Sell">
      <q-form>
        <q-input v-model="sellPrice" label="Price HBD/HIVE" @input="sellTotal = (sellPrice * sellAmount).toFixed(3)"/>
        <q-input v-model="sellAmount" label="Amount HIVE" @input="sellTotal = (sellPrice * sellAmount).toFixed(3)"/>
        <q-input v-model="sellTotal" label="Total HBD ($)" @input="sellAmount = (sellTotal / sellPrice).toFixed(3)" />
        <q-checkbox v-model="fillOrKill" label="Fill or Kill" title="An order must be completely filled, or else cancelled. No partial trades" v-if="false" />
        <div>Available:<q-btn flat :label="balanceHive" @click="sellAmount = balanceHive; sellTotal = (sellAmount * sellPrice).toFixed(3)" /> HIVE</div>
        <div>Highest Bid:<q-btn flat :label="parseFloat(internalMarket.ticker.highest_bid).toFixed(3)" @click="sellPrice = parseFloat(internalMarket.ticker.highest_bid).toFixed(3); sellTotal = (sellAmount * sellPrice).toFixed(3)"/></div>
        <q-btn glossy flat color="red" icon="trending_down" label="Sell Hive" @click="submitOrder(sellAmount + ' HIVE', sellTotal + ' HBD')" />
      </q-form>
    </q-tab-panel>
    <q-tab-panel name="orders" label="Orders">
      <div v-if="openOrders.length > 0">
        <q-list>
          <q-item v-for="order in openOrders" :key="order.index">
            <q-item-section>
              Trade {{ order.sell_price.base }} for {{ order.sell_price.quote }} ({{ order.sell_price.base.split(' ')[0] / order.sell_price.quote.split(' ')[0] }})
            </q-item-section>
            <q-item-section>
              <q-btn @click="cancelOrder(order.orderid)" icon="cancel" color="red" dense glossy flat label="cancel" title="Cancel order" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
      <div v-else>
        No open orders
      </div>
    </q-tab-panel>
  </q-tab-panels>
</q-card>
</div>
</template>
<script>
import moment from 'moment'
export default {
  name: 'internalMarket',
  data () {
    return {
      showDepth: true,
      showTrades: true,
      showTicker: true,
      showArb: true,
      fillOrKill: false,
      prices: {},
      internalMarket: {
        bids: {},
        asks: {},
        trades: [],
        ticker: {}
      },
      tab: 'buy',
      buyPrice: 0.000,
      buyAmount: 0.000,
      buyTotal: 0.000,
      sellPrice: 0.000,
      sellAmount: 0.000,
      sellTotal: 0.000,
      internalMarketEnabled: this.$router.currentRoute.query.internalMarketEnabled || true,
      internalMarketDepth: this.$router.currentRoute.query.internalMarketDepth || 150,
      openOrders: []
    }
  },
  props: {
    tradeEnabled: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    account: {
      cache: false,
      get () {
        if (this.loggedInUser) {
          return this.$store.state.hive.accounts[this.loggedInUser]
        } else {
          return null
        }
      }
    },
    balanceHbd: function () {
      if (this.account) {
        return parseFloat(this.account.hbd_balance.split(' ')[0]).toFixed(3)
      } else {
        return null
      }
    },
    balanceHive: function () {
      if (this.account) {
        return parseFloat(this.account.balance.split(' ')[0]).toFixed(3)
      } else {
        return null
      }
    },
    hiveUsd: function () {
      if (this.prices) {
        return this.prices.hive.usd.toFixed(2)
      } else {
        return null
      }
    },
    hbdUsd: function () {
      if (this.prices) {
        return this.prices.hive_dollar.usd.toFixed(2)
      } else {
        return null
      }
    }
  },
  methods: {
    submitOrder (amountToSell, minToReceive) {
      var orderid = Math.floor(Date.now() / 1000)
      var expiry = new Date(Math.floor(Date.now() / 1000 + 60 * 60 * 24 * 27) * 1000).toISOString().split('.')[0]
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['limit_order_create', { owner: this.loggedInUser, orderid: orderid, amount_to_sell: amountToSell, min_to_receive: minToReceive, fill_or_kill: this.fillOrKill, expiration: expiry }]])
    },
    cancelOrder (orderid) {
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['limit_order_cancel', { owner: this.loggedInUser, orderid: orderid }]])
    },
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
    getAccount (username) {
      this.$store.dispatch('hive/getAccount', username)
    },
    getTradeLine (trade) {
      var price = 0
      var maker = trade.open_pays
      var taker = trade.current_pays
      if (maker.split(' ')[1] === 'HBD') {
        price = (maker.split(' ')[0] / taker.split(' ')[0]).toFixed(3)
        return { taker: taker, maker: maker, price: price, action: 'sell' }
      } else {
        price = (taker.split(' ')[0] / maker.split(' ')[0]).toFixed(3)
        return { taker: taker, maker: maker, price: price, action: 'buy' }
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
    getOpenOrders () {
      this.$hive.api.getOpenOrdersAsync(this.loggedInUser)
        .then(res => {
          this.openOrders = res
          console.log(res)
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
    getTicker () {
      this.$hive.api.getTickerAsync()
        .then(res => { this.internalMarket.ticker = res })
    },
    getCoingeckoPrices () {
      this.$axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hive_dollar%2Chive&vs_currencies=usd%2Cbtc')
        .then((res) => { this.prices = res.data })
        .catch(() => console.log('Failed to load data from coingecko api'))
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    refreshMarket () {
      this.getCoingeckoPrices()
      if (this.internalMarketEnabled) {
        this.internalMarket.bids = {}
        this.internalMarket.asks = {}
        this.internalMarket.trades = []
        this.internalMarket.ticker = {}
        this.getTicker()
        this.getMarketInfo(this.internalMarketDepth)
        this.getRecentTrades(100)
        this.getOpenOrders()
        if (this.loggedInUser) { this.getAccount(this.loggedInUser) }
      }
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    }
  },
  mounted () {
    this.refreshMarket()
  }
}
</script>
