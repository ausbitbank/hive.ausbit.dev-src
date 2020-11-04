<template>
    <span>
    <q-spinner-grid v-if="loading" size="2em" color="primary" style="clear:both;" class="q-ma-lg" />
    <q-card dense flat bordered style="max-width: 100%; max-width:1000px; overflow-wrap: break-word" v-if="!loading && view === 'simple'">
        <q-card-section class="text-center q-pa-md">
            <div class="text-h5">
                <span>Block <router-link :to="returnBlockLink(this.blockNumber)">{{ this.tidyNumber(this.blockNumber) }}</router-link></span>
            </div>
            <span v-if="this.blockHeader" style="text-caption text-center">
              Witnessed by <q-avatar size="sm"><q-img :src="getHiveAvatarUrl(this.blockHeader.witness)" /></q-avatar><router-link :to="returnAccountLink(this.blockHeader.witness)">{{ this.blockHeader.witness }}</router-link>
              <div><q-icon name="history" /><span :title="this.blockHeader.timestamp" class="text-grey text-subtitle">{{ this.blockHeader.timestamp }}</span></div>
              <div>{{ this.blockOpsReal.length }} transactions</div>
              <div>{{ this.blockOpsVirtual.length }} virtual transactions</div>
            </span>
        </q-card-section>
    </q-card>
    <q-card flat bordered style="max-width: 100%; max-width:1000px; overflow-wrap: break-word" v-if="!loading && view === 'full'">
        <q-card-section class="text-center q-pa-md">
            <div class="text-h5">
                <a @click="updateBlock(blockNumber - 1)"><q-icon color="white" name="navigate_before" /></a>
                <span>Block <router-link :to="returnBlockLink(this.blockNumber)">{{ this.tidyNumber(this.blockNumber) }}</router-link></span>
                <a @click="updateBlock(blockNumber + 1)"><q-icon color="white" name="navigate_next" /></a>
            </div>
            <span v-if="this.blockHeader" style="text-caption text-center">
              Witnessed by <q-avatar size="sm"><q-img :src="getHiveAvatarUrl(this.blockHeader.witness)" /></q-avatar><router-link :to="returnAccountLink(this.blockHeader.witness)">{{ this.blockHeader.witness }}</router-link>
              <div><q-icon name="history" /><span :title="this.blockHeader.timestamp" class="text-grey text-subtitle">{{ timeDelta(this.blockHeader.timestamp) }}</span></div>
            </span>
        </q-card-section>
        <q-card-section v-if="this.blockOpsReal.length > 0 || this.blockOpsVirtual.length > 0">
            <div class="text-h6 text-center">{{ this.blockOpsReal.length }} Transactions in this block</div>
            <q-list bordered separator dense>
            <q-item v-for="tx in this.blockOpsReal" :key="tx.index">
                <q-item-section v-if="tx.op[0] === 'vote'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].voter)" /></q-avatar>
                    <span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].voter)">{{ tx.op[1].voter }}</router-link></span> voted <q-chip dense :color="returnVoteColor(tx.op[1].weight)">{{ tx.op[1].weight / 100 }} %</q-chip> on <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar><span class="text-bold"><router-link :to="returnAccountLink(tx.op[1].author)">{{ tx.op[1].author }}</router-link> \ <a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].permlink }}</a></span>
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
            <div class="text-h6 text-center">{{ this.blockOpsVirtual.length }} Virtual Operations</div>
            <q-list bordered separator dense>
            <q-item v-for="tx in this.blockOpsVirtual" :key="tx.index">
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
            <json-viewer :data="block" :deep="1" :showLength="true" />
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
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<script>
import hive from '@hiveio/hive-js'
hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
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
      liveRefresh: false
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
    updateBlock (blockNumber) {
      this.blockNumber = blockNumber
      this.blockOps = []
      this.blockHeader = null
      this.getBlockHeader(blockNumber)
      this.getBlockOps(blockNumber)
    },
    getLatestIrreversibleBlock () {
      hive.api.getDynamicGlobalPropertiesAsync()
        .then(res => this.updateBlock(res.last_irreversible_block_num))
    },
    getRawBlock (blocknum) {
      if (!this.block) {
        hive.api.getBlockAsync(blocknum)
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
  }
}
</script>
