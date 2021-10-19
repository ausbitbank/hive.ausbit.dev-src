<template>
  <q-page class="flex">
    <div class="fit row wrap justify-center items-start content-start">
      <account-header :globalProps="globalProps" :account="account" :showBalances="false" v-if="globalProps !== null && account !== null"/>
      <q-card dense flat bordered class="q-ma-sm q-pa-sm text-center bg-red" v-if="error">
        <div><q-icon name="warning" /> Token {{ token }} doesn't exist</div>
      </q-card>
      <q-card dense flat bordered class="q-ma-sm q-pa-sm text-center" style="max-width: 500px; min-width:400px" v-if="ti && mi">
        <div class="text-h5">{{ ti.symbol }}</div>
        <q-card-section>
            <span class="text-caption">{{ ti.metadata.desc}}</span>
            <div><a :href="ti.metadata.url" target="_blank"><q-icon name="link" /> {{ ti.metadata.url }} </a></div>
            <q-img :src="ti.metadata.icon" style="max-width: 50%" />
        </q-card-section>
        <q-card-section>
          <q-list dense>
            <q-item>
              <q-item-section>
                <q-item-label class="text-bold">
                  Last Price
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ mi.lastPrice }} <q-icon name="img:statics/hive.svg" alt="Hive" />
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  $ {{ (hivePriceUsd * mi.lastPrice).toFixed(3) }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label class="text-bold">
                  24hr Change
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <q-icon :name="parseFloat(mi.priceChangePercent.split(' ')[0]) > 0 ? 'arrow_upward' : 'arrow_downward'" :color="parseFloat(mi.priceChangePercent.split(' ')[0]) > 0 ? 'green' : 'red'" />{{ mi.priceChangePercent }}
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <q-icon :name="parseFloat(mi.priceChangePercent.split(' ')[0]) > 0 ? 'arrow_upward' : 'arrow_downward'" :color="parseFloat(mi.priceChangePercent.split(' ')[0]) > 0 ? 'green' : 'red'" />{{ parseFloat(mi.priceChangeHive).toFixed(3) }} <q-icon name="img:statics/hive.svg" alt="Hive" />
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label class="text-bold">
                  Highest Bid
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ mi.highestBid }} <q-icon name="img:statics/hive.svg" alt="Hive" />
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  $ {{ (this.hivePriceUsd * mi.highestBid).toFixed(3) }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label class="text-bold">
                  Lowest Ask
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ mi.lowestAsk }} <q-icon name="img:statics/hive.svg" alt="Hive" />
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  $ {{ (this.hivePriceUsd * mi.lowestAsk).toFixed(3) }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label class="text-bold">
                  Volume
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ tidyNumber(parseFloat(mi.volume).toFixed(3)) }} <q-icon name="img:statics/hive.svg" alt="Hive" />
                </q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  $ {{ tidyNumber((this.hivePriceUsd * mi.volume).toFixed(3)) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-separator />
        <q-expansion-item dense label="Full token info">
        <json-viewer :data="ti" />
        </q-expansion-item>
        <q-expansion-item dense label="Full Market Info">
            <json-viewer :data="mi" />
        </q-expansion-item>
        <q-separator />
        <span class="q-ma-sm">Viewing Hive-Engine token :</span>
        <q-input v-model="token" label="token" dense class="text-center" />
        <q-btn flat color="primary" label="change token" @click="$router.push('/token/' + token); token = token; init()"/>
        <q-btn icon="refresh" color="primary" flat dense @click="init()" />
      </q-card>
      <q-card dense flat bordered class="q-ma-sm q-pa-sm" v-if="loggedInUser === username && !error">
        <div class="text-center text-h5">Trade</div>
        <q-tabs v-model="tradeTab" dense align="justify" narrow-indicator>
          <q-tab name="buy" label="Buy" class="text-green" />
          <q-tab name="sell" label="Sell" class="text-red" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="tradeTab" animated class="text-center">
          <q-tab-panel name="buy">
            <q-input label="Price" v-model.number="tradeForm.buy.price" type="number"/>
            <q-input label="Quantity" v-model.number="tradeForm.buy.quantity" type="number"/>
            <q-input label="Total" readonly v-model="buyTotal" />
            <q-btn flat color="green" icon="trending_up" @click="tradeHiveEngine(token, 'buy', tradeForm.buy.quantity, tradeForm.buy.price)" :disable="swapHiveBalance === null || parseFloat(buyTotal) === 0">Buy {{ token }}</q-btn>
          </q-tab-panel>
          <q-tab-panel name="sell">
            <q-input label="Price" v-model.number="tradeForm.sell.price" type="number"/>
            <q-input label="Quantity" v-model.number="tradeForm.sell.quantity" type="number"/>
            <q-input label="Total" readonly v-model="sellTotal" />
            <q-btn flat color="red" icon="trending_down" @click="tradeHiveEngine(token, 'sell', tradeForm.sell.quantity, tradeForm.sell.price)" :disable="tokenBalance === null || parseFloat(sellTotal) === 0">Sell {{ token }}</q-btn>
          </q-tab-panel>
        </q-tab-panels>
        <div class="text-center">
          <div v-if="username === loggedInUser && swapHiveBalance === null" class="text-caption">
            <q-icon name="warning" color="orange" />
            You have no SWAP.HIVE<br />
            <a href="https://tribaldex.com/" target="_blank">Deposit with TribalDex</a>
          </div>
          <div v-if="tokenBalance !== null">{{ token }} <q-btn color="primary" dense flat  @click="tradeTab = 'sell'; tradeForm.sell.quantity = tokenBalance.balance; if (tradeForm.sell.price === 0) { tradeForm.sell.price = mi.highestBid }">{{ tidyNumber(tokenBalance.balance) }}</q-btn></div>
          <div v-if="swapHiveBalance !== null"><q-icon name="img:statics/hive.svg" title="Hive" /> <q-btn color="primary" dense flat @click="tradeTab = 'buy'; if (tradeForm.buy.price === 0) { tradeForm.buy.price = mi.lowestAsk }; tradeForm.buy.quantity = (swapHiveBalance.balance / tradeForm.buy.price).toFixed(ti.precision);">{{ tidyNumber(swapHiveBalance.balance) }}</q-btn></div>
        </div>
      </q-card>
      <q-card dense flat bordered class="q-ma-sm q-pa-sm" v-if="buyBook && !error" style="max-width: 400px">
        <div class="text-h5 text-center">
          <q-icon name="trending_up" color="green"/> Buy Orders
          <q-btn dense flat icon="settings" color="grey">
            <q-popup-proxy>
              <q-card flat bordered class="q-pa-sm">
                Customise table
                <q-select v-model="orderColumnsVisible" multiple outlined dense options-dense :display-value="$q.lang.table.columns" emit-value map-options :options="buyOrderColumns" option-value="name" options-cover style="min-width: 150px" />
              </q-card>
            </q-popup-proxy>
          </q-btn>
          <q-btn dense flat icon="refresh" color="primary" @click="getHiveEngineOrderBookBuy()" />
        </div>
        <q-list dense separator class="text-center">
        <q-item v-for="o in myOrders.buy" :key="o.index" class="text-bold">
          <q-item-section>
          {{ tidyNumber(o.quantity) }} @ {{ o.price }}
          <q-item-label caption class="text-caption">
            <q-btn icon="clear" dense flat color="red" label="Cancel Order" @click="cancelOrder('buy', o.txId)" :disable="username !== loggedInUser"/>
          </q-item-label>
          </q-item-section>
        </q-item>
        </q-list>
        <q-table dense :data="buyBook" :columns="buyOrderColumns" :pagination="{ rowsPerPage: 25 }" row-key="_id" :visible-columns="orderColumnsVisible" />
      </q-card>
      <q-card dense flat bordered class="q-ma-sm q-pa-sm" v-if="sellBook && !error">
        <div class="text-h5 text-center">
          <q-icon name="trending_down" color="red"/> Sell Orders
          <q-btn dense flat icon="settings" color="grey">
            <q-popup-proxy>
              <q-card flat bordered class="q-pa-sm">
                Customise table
                <q-select v-model="orderColumnsVisible" multiple outlined dense options-dense :display-value="$q.lang.table.columns" emit-value map-options :options="sellOrderColumns" option-value="name" options-cover style="min-width: 150px" />
              </q-card>
            </q-popup-proxy>
          </q-btn>
          <q-btn dense flat icon="refresh" color="primary" @click="getHiveEngineOrderBookSell()" />
        </div>
        <q-list dense separator>
        <q-item v-for="o in myOrders.sell" :key="o.index" class="text-bold">
          <q-item-section>
          {{ tidyNumber(o.quantity) }} @ {{ o.price }}
          <q-item-label caption>
            <q-btn icon="clear" dense flat color="red" label="Cancel Order" @click="cancelOrder('sell', o.txId)" :disable="username !== loggedInUser"/>
          </q-item-label>
          </q-item-section>
        </q-item>
        </q-list>
        <q-table dense :data="sellBook" :columns="sellOrderColumns" :pagination="{ rowsPerPage: 25 }" row-key="_id" :visible-columns="orderColumnsVisible" />
      </q-card>
      <q-card dense flat bordered class="q-ma-sm q-pa-sm" v-if="th && !error">
        <div class="text-h5 text-center">
          Trade History
          <q-btn dense flat icon="settings" color="grey">
            <q-popup-proxy>
              <q-card flat bordered class="q-pa-sm">
                <q-input label="Trade History Limit" v-model.number="thLimit" :rules="[val => !!val && val <= 1000 || 'Maximum of 1000']"/>
              </q-card>
            </q-popup-proxy>
          </q-btn>
          <q-btn icon="refresh" color="primary" flat dense @click="getHiveEngineTradeHistory()"/>
        </div>
        <div class="text-center" v-if="sparkline.length > 3">
          <sparkline width="250" height="60">
              <sparklineCurve :data="sparkline" :styles="sparklineStyle" :spotStyles="spotStyle" :spotProps="spotProps" :limit="sparkline.length" refLineType='avg' />
          </sparkline>
        </div>
        <q-list dense separator>
        <q-item v-for="t in th" :key="t.index" clickable>
          <q-item-section>
            <q-item-label>
            <router-link :to="getAccountLink(t.buyer)">{{ t.buyer }}</router-link>
             swapped <q-badge dense color="primary">{{ t.quantity }}</q-badge> {{ t.symbol }}
              for <q-badge dense color="primary">{{ parseFloat(t.volume).toFixed(5) }}</q-badge> <q-icon name="img:statics/hive.svg" alt="Hive" />
              from <router-link :to="getAccountLink(t.seller)">{{ t.seller }}</router-link>
            </q-item-label>
          <q-item-label caption>
            <q-icon name="arrow_downward" color="red" v-if="t.type === 'sell'" />
            <q-icon name="arrow_upward" color="green" v-else />
            {{ t.price }} <q-icon name="img:statics/hive.svg" alt="Hive" /> per {{ t.symbol }}
          </q-item-label>
          <q-item-label caption v-if="false">
            <q-icon name="schedule" color="grey" /> {{ timeDelta(t.timestamp) }}
          </q-item-label>
          <q-item-label side v-if="false">
            <router-link :to="getTxLink(t.buyTxId)"><q-icon name="link" alt="tx link" /> b</router-link> &nbsp; <router-link :to="getTxLink(t.sellTxId)"><q-icon name="link" alt="tx link" /> s</router-link>
          </q-item-label>
          </q-item-section>
        </q-item>
        </q-list>
        <q-expansion-item label="Full trade history" dense>
          <json-viewer :data="th" />
        </q-expansion-item>
      </q-card>
    </div>
  </q-page>
</template>
<script>
const SSC = require('sscjs')
const hiveEngine = new SSC('https://api.hive-engine.com/rpc')
import moment from 'moment'
export default {
  name: 'token',
  data () {
    return {
      username: this.$route.params.username || this.loggedInUser,
      token: this.$route.params.token,
      ti: null,
      mi: null,
      bi: null,
      th: null,
      thLimit: 20,
      hivePriceUsd: null,
      buyBook: null,
      sellBook: null,
      error: false,
      tradeTab: 'buy',
      tradeForm: {
        buy: {
          price: 0,
          quantity: 0,
          total: 0
        },
        sell: {
          price: 0,
          quantity: 0,
          total: 0
        }
      },
      myOrders: {
        buy: null,
        sell: null
      },
      buyOrderColumns: [
        { name: 'account', label: 'Account', field: 'account' },
        { name: 'quantity', label: 'Quantity', field: row => parseFloat(row.quantity), required: true, sortable: true },
        { name: 'price', label: 'Price', field: row => parseFloat(row.price), required: true, sortable: true, sortOrder: 'ad' },
        { name: 'txid', label: 'txId', field: 'txid', required: false, sortable: true },
        { name: 'symbol', label: 'Symbol', field: 'symbol', required: false, sortable: false },
        { name: 'tokensLocked', label: 'Tokens Locked', field: row => row.tokensLocked, required: false, sortable: true }
      ],
      sellOrderColumns: [
        { name: 'account', label: 'Account', field: 'account' },
        { name: 'quantity', label: 'Quantity', field: row => parseFloat(row.quantity), required: true, sortable: true },
        { name: 'price', label: 'Price', field: row => parseFloat(row.price), required: true, sortable: true, sortOrder: 'da' },
        { name: 'txid', label: 'txId', field: 'txid', required: false, sortable: true },
        { name: 'symbol', label: 'Symbol', field: 'symbol', required: false, sortable: false },
        { name: 'tokensLocked', label: 'Tokens Locked', field: row => row.tokensLocked, required: false, sortable: true }
      ],
      orderColumnsVisible: ['account', 'quantity', 'price'],
      sparklineIndicatorStyle: false,
      sparklineStyle: { stroke: '#54a5ff' },
      spotStyle: { fill: '#54a5ff' },
      spotProps: { size: 2 }
    }
  },
  components: {
    accountHeader: () => import('components/accountHeader.vue'),
    jsonViewer: () => import('components/jsonViewer.vue'),
    sparkline: () => import('vue-sparklines')
  },
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps },
    account: {
      cache: false,
      get () { return this.$store.state.hive.accounts[this.username] }
    },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    swapHiveBalance: function () { if (this.bi === null) { return null } else { var b = this.bi.filter(t => t.symbol === 'SWAP.HIVE')[0]; if (b !== undefined) { return b } else { return null } } },
    tokenBalance: function () { if (this.bi === null) { return null } else { var b = this.bi.filter(t => t.symbol === this.token)[0]; if (b !== undefined) { return b } else { return null } } },
    myTrades: function () { return this.th.filter() },
    buyTotal: function () { return (this.tradeForm.buy.price * this.tradeForm.buy.quantity).toFixed(5) },
    sellTotal: function () { return (this.tradeForm.sell.price * this.tradeForm.sell.quantity).toFixed(5) },
    sparkline: function () {
      if (this.th) {
        var sl = []; this.th.forEach(t => { sl.push(t.price) }); return sl.reverse()
      } else { return null }
    }
  },
  watch: {},
  methods: {
    getHiveEngineTokenInfo () {
      var tokens = [this.token]
      if (tokens.length > 0) {
        hiveEngine.find('tokens', 'tokens', { symbol: { $in: tokens } }, 1000, 0, [])
          .then((response) => {
            if (response.length === 0) {
              this.error = true
            } else {
              this.error = false
              this.ti = response[0]
              this.ti.metadata = JSON.parse(this.ti.metadata)
            }
          })
          .catch(() => { console.error('Error connecting to Hive-Engine api') })
      }
    },
    getHiveEngineMarketInfo () {
      var tokens = [this.token]
      hiveEngine.find('market', 'metrics', { symbol: { $in: tokens } }, 1000, 0, [])
        .then((response) => { this.mi = response[0] })
        .catch(() => { console.error('Error connecting to Hive-Engine api') })
    },
    getHiveEngineBalanceInfo () {
      if (this.username) {
        var tokens = [this.token, 'SWAP.HIVE']
        hiveEngine.find('tokens', 'balances', { account: this.username, symbol: { $in: tokens } }, 1000, 0, [])
          .then((response) => { this.bi = response })
          .catch(() => { console.error('Error connecting to Hive-Engine api') })
      }
    },
    getHiveEngineTradeHistory () {
      hiveEngine.find('market', 'tradesHistory', { symbol: this.token }, this.thLimit, 0, [])
        .then((response) => { this.th = response })
        .catch(() => { console.error('Error connecting to Hive-Engine api') })
    },
    getHiveEngineOrderBookBuy () {
      hiveEngine.find('market', 'buyBook', { symbol: this.token }, 100, 0, [{ descending: true, index: 'priceDec' }])
        .then((response) => { this.buyBook = response })
        .catch(() => { console.error('Error connecting to Hive-Engine api') })
    },
    getHiveEngineOrderBookSell () {
      hiveEngine.find('market', 'sellBook', { symbol: this.token }, 100, 0, [{ descending: false, index: 'priceDec' }])
        .then((response) => { this.sellBook = response })
        .catch(() => { console.error('Error connecting to Hive-Engine api') })
    },
    getMyHiveEngineOrders () {
      if (this.username) {
        hiveEngine.find('market', 'buyBook', { symbol: this.token, account: this.username }, 25, 0, [{ descending: true, index: '_id' }])
          .then((response) => { this.myOrders.buy = response })
          .catch(() => { console.error('Error connecting to Hive-Engine api') })
        hiveEngine.find('market', 'sellBook', { symbol: this.token, account: this.username }, 25, 0, [{ descending: true, index: '_id' }])
          .then((response) => { this.myOrders.sell = response })
          .catch(() => { console.error('Error connecting to Hive-Engine api') })
      }
    },
    getAccountLink (account) { return '/@' + account },
    getTxLink (txid) { return '/tx/' + txid },
    getPricesCoingecko () {
      this.$axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd&include_24hr_change=true')
        .then((response) => { this.hivePriceUsd = response.data.hive.usd })
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    tradeHiveEngine (token, type, quantity, price) {
      var j = '{ "contractName": "market", "contractAction": "' + type + '", "contractPayload": { "symbol": "' + token + '", "quantity": "' + quantity + '", "price": "' + price + '" } }'
      var cj = {
        required_auths: [this.username],
        required_posting_auths: [],
        id: 'ssc-mainnet-hive',
        json: j
      }
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['custom_json', cj]])
    },
    cancelOrder (type, id) {
      var j = '{ "contractName": "market", "contractAction": "cancel", "contractPayload": { "type": "' + type + '", "id": "' + id + '" } }'
      var cj = {
        required_auths: [this.username],
        required_posting_auths: [],
        id: 'ssc-mainnet-hive',
        json: j
      }
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['custom_json', cj]])
    },
    tidyNumber (x) { if (x) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } },
    init () {
      this.getHiveEngineMarketInfo()
      this.getHiveEngineTokenInfo()
      this.getHiveEngineBalanceInfo()
      this.getHiveEngineTradeHistory()
      this.getPricesCoingecko()
      this.getHiveEngineOrderBookBuy()
      this.getHiveEngineOrderBookSell()
      this.getMyHiveEngineOrders()
      if (!this.username && this.loggedInUser) { this.username = this.loggedInUser }
      if (this.username && this.account === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
    }
  },
  mounted () {
    this.init()
  },
  created () {}
}
</script>
