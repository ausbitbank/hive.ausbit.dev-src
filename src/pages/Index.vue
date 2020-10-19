<template>
  <q-page class="flex flex-center">
    <div class="q-pa-md row items-start q-gutter-md">
      <q-card>
        <q-card-section class="text-center">
          <div class="text-h5 text-center">
            Dynamic Global Properties
          </div>
          <vue-json-pretty :data="globalProps" :custom-value-formatter="customLinkFormatter" />
          <div class="text-center"><q-btn icon="refresh" @click="this.getDynamicGlobalProps" /></div>
        </q-card-section>
      </q-card>
      <q-card>
        <q-card-section class="text-center">
          <div class="text-h5 text-center">
            Api Nodes
          </div>
          <div v-for="node in fullNodeUpdateHive" :key="node.index" class="text-center">
            <span class="text-bold">{{ node.node.replace('https://','') }}</span>
            <div>
              <div><q-badge outline :color="getNodeStatusColor(node)">v{{ node.version }}</q-badge></div>
              <span v-for="rank in getNodeRanks(node)" :key="rank.index">
                <q-chip dense :color="getNodeRankColor(rank)">
                  <q-tooltip content-class="bg-dark">
                    <vue-json-pretty :data="node" />
                  </q-tooltip>
                </q-chip>
              </span>
            </div>
          </div>
        </q-card-section>
        <q-card-section style="text-center">
          <a href="https://peakd.com/@fullnodeupdate"><q-btn icon="info" color="primary" label="Tests by @fullnodeupdate" /></a>
        </q-card-section>
      </q-card>
      <q-card v-if="witnesses !== null">
        <q-card-section class="text-center">
          <div class="text-h5">
            Witnesses
          </div>
          <div v-for="witness in witnesses" :key="witness.index">
            <div>
              <div>
                <span class="text-bold">{{ witness.owner }} </span>
                <q-badge outline color="green">
                  v{{ witness.running_version }}
                </q-badge>
                <q-tooltip content-class="bg-dark">
                  <vue-json-pretty :data="witness" :custom-value-formatter="customLinkFormatter" />
                </q-tooltip>
              </div>
            </div>
          </div>
        </q-card-section>
        <q-card-section style="text-center">
          <a href="https://peakd.com/me/witnesses"><q-btn icon="info" color="primary" label="Vote Witnesses" /></a>
        </q-card-section>
      </q-card>
      <div class="col">
      <q-card>
        <q-card-section class="text-center" v-for="coin in coinGecko" :key="coin.index">
          <div class="text-h6"><q-avatar><q-img :src="coin.image" /></q-avatar><div>{{ coin.name }}</div></div>
          <sparkline width="250" height="60">
            <sparklineCurve :data="coin.sparkline_in_7d.price" :limit="coin.sparkline_in_7d.price.length" :styles="sparklineStyle" />
          </sparkline>
          <div><span class="text-bold">Current Price:</span> ${{ tidyNumber(coin.current_price.toFixed(3)) }}</div>
          <div><span class="text-bold">Market Cap:</span> ${{ tidyNumber(coin.market_cap) }}</div>
          <div><span class="text-bold">Total Volume:</span> ${{ tidyNumber(coin.total_volume) }}</div>
          <div><span class="text-bold">24hr High:</span> ${{ tidyNumber(coin.high_24h.toFixed(3)) }}</div>
          <div><span class="text-bold">24Hr Low:</span> ${{ tidyNumber(coin.low_24h.toFixed(3)) }}</div>
          <div><span class="text-bold">24Hr Change:</span> ${{ tidyNumber(coin.price_change_24h.toFixed(3)) }} ({{ coin.price_change_percentage_24h.toFixed(3) }}%)</div>
          <div><span class="text-bold">All Time High:</span> $ {{ tidyNumber(coin.ath.toFixed(3)) }} ({{ coin.ath_change_percentage.toFixed(3) }} %)</div>
          <div><span class="text-bold">All Time Low:</span> $ {{ tidyNumber(coin.atl.toFixed(3)) }} ({{ coin.atl_change_percentage.toFixed(3) }} %)</div>
        </q-card-section>
        <q-card-section style="text-center">
          <a href="https://coingecko.com"><q-btn icon="info" color="primary" label="Quotes from coingecko" /></a>
        </q-card-section>
      </q-card>
      </div>
    </div>
  </q-page>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
// import axios from 'axios'
import hive from '@hiveio/hive-js'
// hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import sparkline from 'vue-sparklines'
// import { Client } from "@hiveio/dhive"
// const client = new Client(["https://rpc.ausbit.dev", "https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"])

export default {
  name: 'Home',
  data () {
    return {
      coinGecko: null,
      globalProps: null,
      witnesses: null,
      sparklineIndicatorStyle: false,
      sparklineStyle: { stroke: '#54a5ff' },
      fullNodeUpdate: null
    }
  },
  components: {
    VueJsonPretty,
    sparkline
  },
  computed: {
    fullNodeUpdateHive: function () {
      if (this.fullNodeUpdate === null) {
        return null
      } else {
        var results = JSON.parse(this.fullNodeUpdate).report
        var filteredResult = results.filter(result => result.hive === true).filter(result => result.node.startsWith('https'))
        var sortedResult = filteredResult.sort((a, b) => {
          return this.getNodeScore(a) - this.getNodeScore(b)
        })
        return sortedResult
      }
    },
    hivePerMvests: function () {
      if (this.globalProps.total_vesting_shares) {
        return (this.globalProps.total_vesting_fund_hive.split(' ')[0] / (this.globalProps.total_vesting_shares.split(' ')[0] / 1e6))
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    getCoinGecko () {
      this.$axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=hive%2C%20hive_dollar&order=market_cap_desc&per_page=2&page=1&sparkline=true')
        .then((response) => { this.coinGecko = response.data })
        .catch(() => { console.log('Failed to load data from coingecko api') })
    },
    getDynamicGlobalProps () {
      hive.api.getDynamicGlobalPropertiesAsync()
        .then((response) => { this.globalProps = response })
        .catch(() => { console.log('Failed to load dynamic global props') })
    },
    getWitnessesByVote () {
      hive.api.getWitnessesByVoteAsync('', 30)
        .then((response) => { this.witnesses = response })
    },
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (key === 'head_block_number' || key === 'last_irreversible_block_num' || key === 'last_confirmed_block_num') {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else {
        return defaultFormatted
      }
    },
    getFullNodeUpdate () {
      hive.api.getAccountsAsync(['fullnodeupdate'])
        .then((response) => { this.fullNodeUpdate = response[0].json_metadata })
        .catch(() => console.log('Failed to load @fullnodeupdate profile'))
    },
    getNodeStatusColor (node) {
      if (node.block.ok && node.history.ok && node.apicall.ok && node.block_diff.ok) {
        return 'green'
      } else {
        return 'orange'
      }
    },
    getNodeRanks (node) {
      var ranks = [
        node.block.rank,
        node.history.rank,
        node.apicall.rank,
        node.config.rank,
        node.block_diff.rank
      ]
      return ranks
    },
    getNodeRankColor (rank) {
      var color = ''
      switch (rank) {
        case 1:
          color = 'light-green-14'
          break
        case 2:
          color = 'green-13'
          break
        case 3:
          color = 'green-14'
          break
        case 4:
          color = 'green-9'
          break
        case 5:
          color = 'green-8'
          break
        case 6:
          color = 'green-7'
          break
        case 7:
          color = 'amber-8'
          break
        case 8:
          color = 'amber-9'
          break
        case 9:
          color = 'orange-7'
          break
        case 10:
          color = 'orange-8'
          break
        case 11:
          color = 'orange-9'
          break
        case 12:
          color = 'orange-10'
          break
        case -1:
          color = 'red-14'
          break
        default:
          color = 'deep-orange'
      }
      return color
    },
    getNodeRankInfo (node, index) {
      var info = {}
      console.log(node)
      console.log(index)
      switch (index) {
        case 0:
          info = node.block
          break
        case 1:
          info = node.history
          break
        case 2:
          info = node.apicall
          break
        case 3:
          info = node.config
          break
        case 4:
          info = node.block_diff
          break
        default:
          info = node
      }
      return info
    },
    getNodeScore (node) {
      var ranks = this.getNodeRanks(node)
      var score = 0
      for (const i of ranks) {
        if (i === -1) {
          score = score + 100
        } else {
          score = score + i
        }
      }
      return score
    },
    votesToHp (votes) {
      // total_vesting_fund_steem / ( total_vesting_shares / 1000000000000 )
      return this.numberWithCommas(((votes * this.hivePerMvests) / 1000000000000).toFixed(0))
    },
    votesToHpRaw (votes) {
      return ((votes * this.hivePerMvests) / 1000000000000).toFixed(0)
    }
  },
  mounted () {
    this.getCoinGecko()
    this.getDynamicGlobalProps()
    this.getWitnessesByVote()
    this.getFullNodeUpdate()
  }
}
</script>
