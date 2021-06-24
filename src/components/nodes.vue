<template>
  <span>
    <q-card flat bordered v-if="fullNodeUpdate !== null">
      <q-card-section class="text-center">
        <div class="text-h5 text-center">
          <q-icon name="dns" color="blue-grey" /> Api Nodes
        </div>
        <div v-for="node in fullNodeUpdateHiveFiltered" :key="node.node" class="text-center">
          <span class="text-bold">{{ node.node.replace('https://','').replace('rpc.esteem.app','rpc.ecency.com') }}</span>
          <div>
            <div>
              <q-btn flat dense title="Click for full node report data">
                <q-badge outline :color="getNodeStatusColor(node)">v{{ node.version }}</q-badge>
                <q-popup-proxy>
                  <json-viewer :data="node" />
                </q-popup-proxy>
              </q-btn>
            </div>
            <span v-for="rank in getNodeRanks(node)" :key="rank.id">
              <q-chip dense :color="getNodeRankColor(rank)" class="text-black text-bold">
                {{ rank }}
              </q-chip>
            </span>
          </div>
        </div>
      </q-card-section>
      <q-card-section class="text-center">
        <q-btn-toggle dense push glossy toggle-color="primary" :options="nodeVersionsLabelled" v-model="showVersion" title="Filter results by reported node version"/><br />
        <router-link to="/@fullnodeupdate/posts"><q-btn dense flat icon="info" color="primary" label="Tests by @fullnodeupdate" /></router-link>
        <div v-if="fullNodeUpdateTime" class="text-subtitle">
          <q-icon name="access_time" /> tested {{ timeDelta(fullNodeUpdateTime) }}
        </div>
        <div class="text-caption">
          Alternatives : <a href="https://hivekings.com/nodes" target="_blank">hivekings</a>, <a href="https://beacon.peakd.com/">peakd</a>
        </div>
        <div class="text-center" v-if="this.$route.path !== '/nodes'"><router-link to="nodes"><q-btn dense flat icon="link" /></router-link></div>
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
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'nodes',
  props: [],
  components: { jsonViewer },
  data () {
    return {
      fullNodeUpdate: null,
      fullNodeUpdateTime: null,
      showVersion: this.$route.query.version || 'all'
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
    },
    fullNodeUpdateHiveFiltered: function () {
      if (this.fullNodeUpdateHive === null) {
        return null
      } else {
        if (this.showVersion === 'all') {
          return this.fullNodeUpdateHive
        } else {
          var filteredResult = this.fullNodeUpdateHive.filter(r => r.version === this.showVersion)
          return filteredResult
        }
      }
    },
    nodeVersions: function () {
      if (this.fullNodeUpdateHive === null) {
        return null
      } else {
        var results = []
        // console.log(this.fullNodeUpdateHive)
        this.fullNodeUpdateHive.forEach(n => {
          if (!results.includes(n.version)) {
            results.push(n.version)
          }
        })
        return results
      }
    },
    nodeVersionsLabelled: function () {
      if (this.nodeVersions === null) {
        return null
      } else {
        var results = [{ label: 'All', value: 'all' }]
        this.nodeVersions.forEach(n => {
          results.push({ label: n, value: n })
        })
        return results
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
      this.$hive.api.getAccountsAsync(['fullnodeupdate'])
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
    }
  },
  mounted () {
    this.getFullNodeUpdate()
  }
}
</script>
