<template>
    <span>
    <q-card dense flat bordered style="max-width: 100%; max-width:400px; overflow-wrap: break-word" v-if="viewType === 'simple'">
        <q-card-section class="text-center q-pa-md">
            <div class="text-h5">
                <a @click="updateBlock(blockNumber - 1)"><q-icon color="primary" name="navigate_before" class="hvr"/></a>
                <span>Block <router-link :to="returnBlockLink(this.blockNumber)">{{ this.tidyNumber(this.blockNumber) }}</router-link></span>
                <a @click="updateBlock(blockNumber + 1)"><q-icon color="primary" name="navigate_next" class="hvr" /></a>
            </div>
            <span v-if="this.blockHeader" style="text-caption text-center">
              Witnessed by <q-avatar size="sm"><q-img :src="getHiveAvatarUrl(this.blockHeader.witness)" /></q-avatar><router-link :to="returnAccountLink(this.blockHeader.witness)">{{ this.blockHeader.witness }}</router-link>
              <div><q-icon name="history" /><span :title="this.blockHeader.timestamp" class="text-grey text-subtitle">{{ this.blockHeader.timestamp }}</span></div>
              <div :alt="getByteSize(this.blockOpsReal) / 1024"><q-badge color="primary">{{ blockOpsRealCount }}</q-badge> transaction<span v-if="blockOpsRealCount >= 2">s</span></div>
              <span v-for="op in this.blockOpsReal" :key="op.index">
                <span :class="returnOpColor(op)" :title="op.op[0]">{{ op.op[0].substr(0,1) }}</span>
              </span>
              <div><q-badge color="primary">{{ this.blockOpsVirtual.length }}</q-badge> virtual transaction<span v-if="this.blockOpsVirtual.length >= 2">s</span></div>
              <span v-for="op in this.blockOpsVirtual" :key="op.index">
                <span :class="returnOpColor(op)" :title="op.op[0]">{{ op.op[0].substr(0,1) }}</span>
              </span>
              <div><q-btn flat color="primary" v-if="viewType !== 'full'" @click="viewType = 'full'" icon="unfold_more" /></div>
            </span>
        </q-card-section>
    </q-card>
    <q-card flat bordered style="max-width: 100%; max-width:1000px; overflow-wrap: break-word" v-if="viewType === 'full'">
        <q-card-section class="text-center q-pa-md">
            <div class="text-h5">
                <a @click="updateBlock(blockNumber - 1)"><q-icon color="primary" name="navigate_before" /></a>
                <span>Block <router-link :to="returnBlockLink(this.blockNumber)">{{ this.tidyNumber(this.blockNumber) }}</router-link></span>
                <a @click="updateBlock(blockNumber + 1)"><q-icon color="primary" name="navigate_next" /></a>
            </div>
            <span v-if="this.blockHeader" style="text-caption text-center">
              Witnessed by <q-avatar size="sm"><q-img :src="getHiveAvatarUrl(this.blockHeader.witness)" /></q-avatar><router-link :to="returnAccountLink(this.blockHeader.witness)">{{ this.blockHeader.witness }}</router-link>
              <div><q-icon name="history" /><span :title="this.blockHeader.timestamp" class="text-grey text-subtitle">{{ timeDelta(this.blockHeader.timestamp) }}</span></div>
              <div><q-btn flat color="primary" v-if="viewType !== 'simple'" @click="viewType = 'simple'" icon="unfold_less" /></div>
            </span>
        </q-card-section>
        <div class="text-center" v-if="filterOps.length > 0">Showing only: {{ filterOps.join(",") }} <q-btn dense flat no-caps icon="cancel" color="red" title="Remove filter" @click="filterOps = []" /></div>
        <q-card-section v-if="this.blockOpsReal.length > 0 || this.blockOpsVirtual.length > 0">
            <div class="text-h6 text-center">{{ blockOpsRealCount }} Transactions in this block</div>
            <q-list bordered separator dense>
            <q-item v-for="tx in this.blockOpsReal.filter(filterOpsType)" :key="tx.index">
                <q-item-section v-if="tx.op[0] === 'vote'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].voter)" /></q-avatar>
                    <span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].voter)">{{ tx.op[1].voter }}</router-link></span> voted <q-chip dense :color="returnVoteColor(tx.op[1].weight)">{{ tx.op[1].weight / 100 }} %</q-chip> on <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].author)">{{ tx.op[1].author }}</router-link> \ <a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].permlink }}</a></span>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'effective_comment_vote'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].voter)" /></q-avatar>
                    <span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].voter)">{{ tx.op[1].voter }}</router-link></span> effective_comment_vote
                    <json-viewer :data="tx.op[1]" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'comment'">
                <q-item-label v-if="tx.op[1].parent_author === ''">
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar>
                    <router-link :to="returnAccountLink(tx.op[1].author)">{{ tx.op[1].author }}</router-link> wrote a post
                    <span v-if="tx.op[1].title"> titled "<a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].title }}</a>"</span>
                    <div>
                    <json-viewer :data="tx.op[1]" />
                    </div>
                </q-item-label>
                <q-item-label v-else>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar>
                    <span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].author)">{{ tx.op[1].author }}</router-link></span> commented on <router-link :to="returnAccountLink(tx.op[1].parent_author)">{{ tx.op[1].parent_author }}</router-link> \ <router-link :to="returnLink(tx.op[1].parent_author,tx.op[1].parent_permlink)">{{ tx.op[1].parent_permlink }}</router-link> :
                    <div><json-viewer :data="tx.op[1]" /></div>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'account_update'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].account)">{{ tx.op[1].account }}</router-link></span> updated profile metadata
                    <json-viewer :data="tx.op[1]" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'account_update2'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].account)">{{ tx.op[1].account }}</router-link></span> updated profile metadata
                    <json-viewer :data="tx.op[1]" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'account_create'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].creator)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].creator)">{{ tx.op[1].creator }}</router-link></span> created new account <router-link :to="returnAccountLink(tx.op[1].creator)">{{ tx.op[1].new_account_name }}</router-link>
                    <json-viewer :data="tx.op[1]" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'account_created'">
                <q-item-label>
                    New account created <router-link :to="returnAccountLink(tx.op[1].creator)">{{ tx.op[1].new_account_name }}</router-link>
                    <json-viewer :data="tx.op[1]" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'collateralized_convert'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].owner)">{{ tx.op[1].owner }}</router-link></span> started <q-badge>collateralized_convert</q-badge> of {{ tx.op[1].amount }} with request id {{ tx.op[1].requestid }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'limit_order_create'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].owner)">{{ tx.op[1].owner }}</router-link></span> created limit order - selling {{ tx.op[1].amount_to_sell }} for {{ tx.op[1].min_to_receive }} (Fill or kill: {{ tx.op[1].fill_or_kill }}, Expiration {{ tx.op[1].expiration }}, Order Id {{ tx.op[1].orderid }})
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'fill_order'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].current_owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].current_owner)">{{ tx.op[1].current_owner }}</router-link></span> filled open order from <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].open_owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].open_owner)">{{ tx.op[1].open_owner}}</router-link></span> - paid {{  tx.op[1].current_pays }} for {{ tx.op[1].open_pays }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'limit_order_cancel'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].owner)">{{ tx.op[1].owner }}</router-link></span> cancelled limit order id {{ tx.op[1].orderid }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'convert'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].owner)">{{ tx.op[1].owner }}</router-link></span> started conversion of {{ tx.op[1].amount }} , request id {{ tx.op[1].requestid }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'feed_publish'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].publisher)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].publisher)">{{ tx.op[1].publisher }}</router-link></span> published pricefeed of ${{ tx.op[1].exchange_rate.base }} per {{ tx.op[1].exchange_rate.quote }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'comment_options'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].author)">{{ tx.op[1].author }}</router-link></span> changed comment options for <a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].permlink }}</a>
                    <json-viewer :data="tx.op[1]" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'claim_reward_balance'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].account)">{{ tx.op[1].account }}</router-link></span> claimed reward balance of
                    <span v-if="tx.op[1].reward_hive !== '0.000 HIVE'"><q-chip dense>{{ tx.op[1].reward_hive }}</q-chip></span>
                    <span v-if="tx.op[1].reward_hbd !== '0.000 HBD'"><q-chip dense>{{ tx.op[1].reward_hbd }}</q-chip></span>
                    <span v-if="tx.op[1].reward_vests !== '0.000 VESTS'"><q-chip dense>{{ tx.op[1].reward_vests }}</q-chip></span>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'claim_account'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].creator)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].creator)">{{ tx.op[1].creator }}</router-link></span> claimed account creation token with fee of {{ tx.op[1].fee }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'create_claimed_account'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].creator)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].creator)">{{ tx.op[1].creator }}</router-link></span> created claimed account <q-avatar><q-img :src="getHiveAvatarUrl(tx.op[1].new_account_name)" /></q-avatar> <span class="text-bold">{{ tx.op[1].new_account_name }}</span>
                    <json-viewer :data="tx.op[1]" :deep="1" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'witness_set_properties'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].owner)">{{ tx.op[1].owner }}</router-link></span> set witness properties {{ tx.op[1].props }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'custom_json'">
                <q-item-label>
                    <span v-if="tx.op[1].required_posting_auths.length > 0">
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].required_posting_auths[0])" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].required_posting_auths[0])">{{ tx.op[1].required_posting_auths[0] }}</router-link></span>
                    </span>
                    <span v-else-if="tx.op[1].required_auths.length > 0">
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].required_auths[0])" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].required_auths[0])">{{ tx.op[1].required_auths[0] }}</router-link></span>
                    </span>
                    sent <span class="text-bold">custom json</span> with id <q-chip color="primary" dense>{{ tx.op[1].id }}</q-chip>
                    <json-viewer :data="JSON.parse(tx.op[1].json)" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'transfer'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].from)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].from)">{{ tx.op[1].from }}</router-link></span> transferred <code class="text-bold">{{ tx.op[1].amount }}</code> to <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].to)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].to)">{{ tx.op[1].to }}</router-link></span> <div v-if="tx.op[1].memo !== ''">Memo : <json-viewer :data="tx.op[1].memo" /></div>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else>
                <span>
                    <span class="text-bold">{{ tx.op[0] }}</span>
                    {{ tx.op[1] }}
                </span>
                </q-item-section>
                <q-item-section side class="text-caption">
                <router-link :name="tx.trx_id" :to="returnTxLink(tx.trx_id)">{{ tx.trx_id.substr(0,8) }}</router-link>
                </q-item-section>
            </q-item>
            </q-list>
            <div class="text-h6 text-center">{{ this.blockOpsVirtual.length }} Virtual Operation<span v-if="this.blockOpsVirtual.length >= 2">s</span></div>
            <q-list bordered separator dense>
            <q-item v-for="tx in this.blockOpsVirtual.filter(filterOpsType)" :key="tx.index">
            <q-item-section>
                <q-chip dense class="text-bold">{{ tx.op[0] }}</q-chip>
                <json-viewer :data="tx.op[1]" />
            </q-item-section>
            <q-item-section side class="text-caption">
                <a :name="tx.virtual_op">{{ tx.virtual_op }}</a>
            </q-item-section>
            </q-item>
            </q-list>
        </q-card-section>
        <q-card-section>
          <div class="text-center" v-if="false"><q-toggle left-label v-model="liveRefresh" label="Live Block Refresh" class="text-center" /></div>
          <div class="text-grey cursor-pointer text-center" @click="getRawBlock(blockNumber); showRawBlock = !showRawBlock">Show Raw Block Data</div>
          <q-card v-if="showRawBlock">
            <div class="text-h6 text-center">Raw Block Data</div>
            <json-viewer v-if="block" :data="block" :deep="1" :showLength="true" />
          </q-card>
        </q-card-section>
        <q-card-section class="text-body text-center" v-if="!loading">
            <a @click="updateBlock(blockNumber - 1)"><q-icon color="white" name="navigate_before" /></a>
            <span>Block <router-link :to="returnBlockLink(this.blockNumber)">{{ this.tidyNumber(this.blockNumber) }}</router-link></span>
            <a @click="updateBlock(blockNumber + 1)"><q-icon color="white" name="navigate_next" /></a>
        </q-card-section>
    </q-card>
    </span>
</template>
<style>
a:link { color: #3E92CC; font-weight: bold; text-decoration: none; }
a:visited { color: #3E92CC; }
:target { background-color: #ffa; }
</style>
<script>
import moment from 'moment'
import jsonViewer from 'components/jsonViewer.vue'
import { mixin as VueTimers } from 'vue-timers'
export default {
  name: 'blockView',
  mixins: [VueTimers],
  timers: [
    {
      name: 'blockTimer',
      time: 3000,
      repeat: false,
      autostart: false,
      isSwitchTab: false,
      callback: function () {
        var d = new Date(); var n = d.getTime(); console.log('timer triggered at ' + n)
        this.updateBlock(this.blockNumber + 1)
      }
    }
  ],
  components: {
    jsonViewer
  },
  props: {
    blockNum: Number,
    view: {
      type: String,
      required: false,
      default: 'full'
    }
  },
  data () {
    return {
      block: null,
      blockHeader: null,
      blockOps: [],
      lastIrreversibleBlock: null,
      blockNumber: this.blockNum,
      showRawBlock: false,
      liveRefresh: false,
      viewType: this.view,
      filterOps: []
    }
  },
  watch: {
    liveRefresh: function (newState, oldState) {
      if (newState === true) {
        this.$timer.start('blockTimer')
      } else {
        this.$timer.stop('blockTimer')
      }
      console.log('blockTimer ' + this.timers.blockTimer.isRunning)
    }
  },
  computed: {
    blockOpsReal: function () {
      if (this.blockOps.length > 0) {
        var r = this.blockOps.filter(this.filterOpsReal)
        // if (this.filterOps.length > 0) { r = r.filter(this.filterOpsType) }
        return r
      } else {
        return []
      }
    },
    blockOpsRealCount: function () {
      if (this.blockOpsReal.length > 0) {
        console.log(this.blockOpsReal)
        var r = this.blockOpsReal.filter(o => o.op[0] !== 'effective_comment_vote')
        return r.length
      } else {
        return []
      }
    },
    blockOpsVirtual: function () {
      if (this.blockOps.length > 0) {
        var r = this.blockOps.filter(this.filterOpsVirtual)
        // if (this.filterOps.length > 0) { r = r.filter(this.filterOpsType) }
        return r
      } else {
        return []
      }
    },
    linkPrevious: function () {
      var num = parseInt(this.blockNumber) - 1
      return '/block/' + num
    },
    linkNext: function () {
      var num = parseInt(this.blockNumber) + 1
      return '/block/' + num
    },
    loading: function () {
      if (this.blockOps.length === 0) {
        return true
      } else {
        return false
      }
    }
  },
  methods: {
    filterOpsVirtual (op) { if (op.trx_id === '0000000000000000000000000000000000000000') { return true } else { return false } },
    filterOpsReal (op) { if (op.trx_id !== '0000000000000000000000000000000000000000') { return true } else { return false } },
    filterOpsType (op) { if (this.filterOps.includes(op.op[0]) || this.filterOps.length === 0) { return true } else { return false } },
    getBlockHeader (blocknum) {
      this.$hive.api.getBlockHeaderAsync(blocknum)
        .then(blockHeader => this.setBlockHeader(blockHeader))
        .catch(error => console.log(error))
    },
    getBlockOps (blocknum) {
      this.$hive.api.getOpsInBlockAsync(blocknum, false)
        .then(blockOps => this.setBlockOps(blockOps))
        .catch(error => console.log(error))
    },
    setBlockHeader (blockHeader) { this.blockHeader = blockHeader },
    setBlockOps (blockOps) { this.blockOps = blockOps },
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
    getByteSize (thing) { return Buffer.from(JSON.stringify(thing)).length },
    getBlockSize () {
      var h = this.getByteSize(this.blockHeader)
      var o = this.getByteSize(this.blockOps)
      var t = (h + o) / 1024
      return t
    },
    getBlockSizeText () { return this.getBlockSize + ' kB' },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnBlockLink (blocknum) { return '/b/' + blocknum },
    returnTxLink (txId) { return '/tx/' + txId },
    returnAccountLink (account) { return '/@' + account },
    returnVoteColor (weight) {
      if (Math.sign(weight) === 1) {
        if (weight === 0) {
          return 'grey'
        } else {
          return 'green'
        }
      } else {
        return 'red'
      }
    },
    returnOpColor (op) {
      switch (op.op[0]) {
        case 'vote':
          if (Math.sign(op.op[1].weight) === -1) {
            return 'bg-red'
          } else {
            return 'bg-green'
          }
        case 'comment':
          return 'bg-cyan-6'
        case 'transfer':
          return 'bg-teal-14'
        case 'transfer_to_vesting':
          return 'bg-teal-12'
        case 'withdraw_vesting':
          return 'bg-red-10'
        case 'limit_order_create':
          return 'bg-orange-10'
        case 'limit_order_cancel':
          return 'bg-orange-11'
        case 'feed_publish':
          return 'bg-deep-purple-10'
        case 'convert':
          return 'bg-orange-12'
        case 'account_create':
          return 'bg-light-blue-10'
        case 'account_update':
          return 'bg-red-14'
        case 'witness_update':
          return 'bg-red-13'
        case 'account_witness_vote':
          return 'bg-green-14'
        case 'account_witness_proxy':
          return 'bg-indigo-14'
        case 'custom':
          return 'bg-grey-7'
        case 'delete_comment':
          return 'bg-grey-8'
        case 'custom_json':
          return 'bg-blue-grey-10'
        case 'comment_options':
          return 'bg-blue-grey-12'
        case 'set_withdraw_vesting_route':
          return 'bg-red-12'
        case 'limit_order_create2':
          return 'bg-orange-9'
        case 'claim_account':
          return 'bg-blue-grey-9'
        case 'create_claimed_account':
          return 'bg-blue-grey-8'
        case 'request_account_recovery':
          return 'bg-red-8'
        case 'recover_account':
          return 'bg-red-7'
        case 'change_recovery_account':
          return 'bg-red-6'
        case 'escrow_transfer':
          return 'bg-orange-6'
        case 'escrow_dispute':
          return 'bg-orange-5'
        case 'escrow_release':
          return 'bg-orange-4'
        case 'escrow_approve':
          return 'bg-orange-3'
        case 'transfer_to_savings':
          return 'bg-teal-9'
        case 'transfer_from_savings':
          return 'bg-teal-8'
        case 'cancel_transfer_from_savings':
          return 'bg-teal-7'
        case 'custom_binary':
          return 'bg-pink-6'
        case 'decline_voting_rights':
          return 'bg-red-5'
        case 'reset_account':
          return 'bg-red-4'
        case 'set_reset_account':
          return 'bg-red-3'
        case 'claim_reward_balance':
          return 'bg-teal-9'
        case 'delegate_vesting_shares':
          return 'bg-teal-8'
        case 'account_create_with_delegation':
          return 'bg-blue-grey-7'
        case 'witness_set_properties':
          return 'bg-blue-grey-6'
        case 'account_update2':
          return 'bg-red-5'
        case 'create_proposal':
          return 'bg-cyan-10'
        case 'update_proposal_votes':
          return 'bg-cyan-9'
        case 'remove_proposal':
          return 'bg-cyan-8'
        case 'update_proposal':
          return 'bg-cyan-7'
        case 'claim_reward_balance2':
          return 'bg-teal-7'
        case 'vote2':
          return 'bg-green-10'
        case 'fill_convert_request':
          return 'bg-orange-9'
        case 'author_reward':
          return 'bg-teal-5'
        case 'curation_reward':
          return 'bg-teal-4'
        case 'comment_reward':
          return 'bg-teal-3'
        case 'fill_vesting_withdraw':
          return 'bg-red-2'
        case 'fill_order':
          return 'bg-orange-2'
        case 'fill_transfer_from_savings':
          return 'bg-orange-1'
        case 'hardfork':
          return 'bg-red'
        case 'comment_payout_update':
          return 'bg-blue-grey-5'
        case 'return_vesting_delegation':
          return 'bg-blue-grey-4'
        case 'comment_benefactor_reward':
          return 'bg-blue-grey-1'
        default:
          return 'bg-grey'
      }
    },
    updateBlock (blockNumber) {
      this.blockNumber = blockNumber
      this.blockOps = []
      this.blockHeader = null
      this.getBlockHeader(blockNumber)
      this.getBlockOps(blockNumber)
    },
    getLatestIrreversibleBlock () {
      this.$hive.api.getDynamicGlobalPropertiesAsync()
        .then(res => this.updateBlock(res.last_irreversible_block_num))
    },
    getRawBlock (blocknum) {
      if (!this.block) {
        this.$hive.api.getBlockAsync(blocknum)
          .then(res => this.setRawBlock(res))
      }
    },
    setRawBlock (block) {
      this.block = block
    }
  },
  mounted () {
    if (this.blockNum === 0) {
      this.getLatestIrreversibleBlock()
    } else {
      this.updateBlock(this.blockNum)
    }
    if (this.$route.query.filter) {
      this.filterOps = this.$route.query.filter.split(',')
    }
  }
}
</script>
