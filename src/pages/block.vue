<template>
  <q-page class="flex q-pa-md">
    <div>
      <div class="text-h5">
        <a :href="linkPrevious"><q-icon color="white" name="navigate_before" /></a>
        <span>Block {{ this.tidyNumber(this.blockNum) }}</span>
        <a :href="linkNext"><q-icon color="white" name="navigate_next" /></a>
      </div>
      <div style="text-caption text-center" v-if="this.blockHeader">
        {{this.blockHeader.timestamp}} UTC - {{ timeDelta(this.blockHeader.timestamp) }}
      </div>
      <div v-if="this.blockOpsReal.length > 0">
        <div class="text-h6">{{ this.blockOpsReal.length }} Transactions in this block</div>
        <q-list bordered separator dense>
          <q-item v-for="tx in this.blockOpsReal" :key="tx.index">
            <q-item-section v-if="tx.op[0] === 'vote'">
              <q-item-label>
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].voter)" /></q-avatar>
                <span class="text-bold">{{ tx.op[1].voter }}</span> voted <q-chip dense>{{ tx.op[1].weight / 100 }} %</q-chip> on <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar><span class="text-bold">{{ tx.op[1].author }} \ <a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].permlink }}</a></span>
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'comment'">
              <q-item-label v-if="tx.op[1].parent_author === ''">
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar>
                {{ tx.op[1].author }} wrote a post
                <span v-if="tx.op[1].title"> titled "{{ tx.op[1].title }}"</span>
                <div>
                  <vue-json-pretty :data="tx.op[1]" />
                </div>
              </q-item-label>
              <q-item-label v-else>
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar>
                <span class="text-bold">{{ tx.op[1].author }}</span> commented on {{ tx.op[1].parent_author }} \ {{ tx.op[1].parent_permlink }} :
                <div><code>{{ tx.op[1].body }}</code></div>
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'account_update2'">
              <q-item-label>
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold">{{ tx.op[1].account }}</span> updated profile metadata
                <vue-json-pretty :data="tx.op[1]" />
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'limit_order_create'">
              <q-item-label>
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar>{{ tx.op[1].owner }} created limit order - selling {{ tx.op[1].amount_to_sell }} for {{ tx.op[1].min_to_receive }} (Fill or kill: {{ tx.op[1].fill_or_kill }}, Expiration {{ tx.op[1].expiration }}, Order Id {{ tx.op[1].orderid }})
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'limit_order_cancel'">
              <q-item-label>
                @{{ tx.op[1].owner }} cancelled limit order id {{ tx.op[1].orderid }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'convert'">
              <q-item-label>
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].owner }}</span> started conversion of {{ tx.op[1].amount }} , request id {{ tx.op[1].requestid }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'custom_json'">
              <q-item-label>
                <span v-if="tx.op[1].required_posting_auths.length > 0">
                  <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].required_posting_auths[0])" /></q-avatar><span class="text-bold">{{ tx.op[1].required_posting_auths[0] }}</span>
                </span>
                <span v-else-if="tx.op[1].required_auths.length > 0">
                 <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].required_auths[0])" /></q-avatar><span class="text-bold">{{ tx.op[1].required_auths[0] }}</span>
                </span>
                <span v-else>
                  {{ tx.op[1] }}
                </span>
                sent <span class="text-bold">custom json</span> with id <code class="text-bold">{{ tx.op[1].id }}</code>
                <vue-json-pretty :data="tx.op[1]" />
              </q-item-label>
            </q-item-section>
            <q-item-section v-else-if="tx.op[0] === 'transfer'">
              <q-item-label>
                <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].from)" /></q-avatar><span class="text-bold">{{ tx.op[1].from }}</span> transferred <code class="text-bold">{{ tx.op[1].amount }}</code> to <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].to)" /></q-avatar><span class="text-bold">{{ tx.op[1].to }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section v-else>
              <span>
                <span class="text-bold">{{ tx.op[0] }}</span>
                {{ tx.op[1] }}
              </span>
            </q-item-section>
            <q-item-section side class="text-caption">
              <a :name="tx.trx_id" :href="returnTxLink(tx.trx_id)">{{ tx.trx_id.substr(0,8) }}</a>
            </q-item-section>
          </q-item>
        </q-list>
        <div class="text-h6">{{ this.blockOpsVirtual.length }} Virtual Operations</div>
        <q-list bordered separator dense>
        <q-item v-for="tx in this.blockOpsVirtual" :key="tx.index">
          <q-item-section>
            <span class="text-bold">{{ tx.op[0] }}</span>
            <vue-json-pretty :data='tx.op[1]' />
          </q-item-section>
          <q-item-section side class="text-caption">
            <a :name="tx.virtual_op">{{ tx.virtual_op }}</a>
          </q-item-section>
        </q-item>
        </q-list>
      </div>
    </div>
  </q-page>
</template>
<style>
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<script>
import hive from '@hiveio/hive-js'
import moment from 'moment'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
export default {
  name: 'blockView',
  components: {
    VueJsonPretty
  },
  data () {
    return {
      block: null,
      blockNum: this.$route.params.blockNum,
      blockHeader: null,
      blockOps: []
    }
  },
  computed: {
    blockOpsReal: function () {
      if (this.blockOps.length > 0) {
        return this.blockOps.filter(this.filterOpsReal)
      } else {
        return []
      }
    },
    blockOpsVirtual: function () {
      if (this.blockOps.length > 0) {
        return this.blockOps.filter(this.filterOpsVirtual)
      } else {
        return []
      }
    },
    linkPrevious: function () {
      var num = this.blockNum - 1
      return '/block/' + num
    },
    linkNext: function () {
      var num = this.blockNum + 1
      return '/block/' + num
    }
  },
  methods: {
    filterOpsVirtual (op) {
      if (op.trx_id === '0000000000000000000000000000000000000000') {
        return true
      } else {
        return false
      }
    },
    filterOpsReal (op) {
      if (op.trx_id !== '0000000000000000000000000000000000000000') {
        return true
      } else {
        return false
      }
    },
    getBlockHeader (blocknum) {
      hive.api.getBlockHeaderAsync(blocknum)
        .then(blockHeader => this.setBlockHeader(blockHeader))
        .catch(error => console.log(error))
    },
    getBlockOps (blocknum) {
      hive.api.getOpsInBlockAsync(blocknum, false)
        .then(blockOps => this.setBlockOps(blockOps))
        .catch(error => console.log(error))
    },
    setBlockHeader (blockHeader) {
      this.blockHeader = blockHeader
      console.log('block header')
      console.log(blockHeader)
    },
    setBlockOps (blockOps) {
      this.blockOps = blockOps
      console.log('got block ops')
      console.log(blockOps)
      console.log('virtual ops')
      console.log(this.blockOpsVirtual)
    },
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
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnTxLink (txId) { return '/tx/' + txId }
  },
  mounted () {
    // this.getBlock(this.$route.params.blockNum)
    this.getBlockHeader(this.$route.params.blockNum)
    this.getBlockOps(this.$route.params.blockNum)
  }
}
</script>
