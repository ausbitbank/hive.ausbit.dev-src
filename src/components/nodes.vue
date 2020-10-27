<template>
    <span>
    <q-spinner-grid size="2em" color="primary" v-if="fullNodeUpdate === null" />
    <q-card flat bordered v-if="fullNodeUpdate !== null">
        <q-card-section class="text-center">
            <div class="text-h5 text-center">
                <q-icon name="dns" /> Api Nodes
            </div>
            <div v-for="node in fullNodeUpdateHive" :key="node.index" class="text-center">
                <span class="text-bold">{{ node.node.replace('https://','').replace('rpc.esteem.app','rpc.ecency.com') }}</span>
                <div>
                <div>
                    <q-badge outline :color="getNodeStatusColor(node)">v{{ node.version }}</q-badge>
                </div>
                <span v-for="rank in getNodeRanks(node)" :key="rank.id">
                    <q-chip dense :color="getNodeRankColor(rank)" class="text-black text-bold">
                        {{ rank }}
                        <q-tooltip content-class="bg-dark">
                            <vue-json-pretty :data="node" :custom-value-formatter="customLinkFormatter" />
                        </q-tooltip>
                    </q-chip>
                </span>
                </div>
            </div>
            </q-card-section>
            <q-card-section class="text-center">
                <a href="https://peakd.com/@fullnodeupdate"><q-btn dense icon="info" color="primary" label="Tests by @fullnodeupdate" /></a>
                <div v-if="fullNodeUpdateTime" class="text-subtitle">
                    <q-icon name="access_time" /> {{ timeDelta(fullNodeUpdateTime) }} at {{ fullNodeUpdateTime }}
                </div>
                <div class="text-caption">
                    Alternative : <a href="https://hivekings.com/nodes" target="_blank">hivekings.com/nodes</a>
                </div>
                <div class="text-center" v-if="this.$route.path !== '/nodes'"><router-link to="nodes"><q-btn dense push icon="link" /></router-link></div>
        </q-card-section>
    </q-card>
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import moment from 'moment'
import hive from '@hiveio/hive-js'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import DOMPurify from 'dompurify'
export default {
  name: 'nodes',
  props: [],
  components: { VueJsonPretty },
  data () {
    return {
      fullNodeUpdate: null,
      fullNodeUpdateTime: null
    }
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
    }
  },
  methods: {
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    getFullNodeUpdate () {
      console.log('Fetching @fullnodeupdate profile data')
      hive.api.getAccountsAsync(['fullnodeupdate'])
        .then((response) => {
          this.fullNodeUpdate = response[0].json_metadata
          this.fullNodeUpdateTime = response[0].last_account_update
        })
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
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (key === 'head_block_number' || key === 'last_irreversible_block_num' || key === 'last_confirmed_block_num') {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else {
        return DOMPurify.sanitize(defaultFormatted)
      }
    }
  },
  mounted () {
    this.getFullNodeUpdate()
  }
}
</script>
