<template>
    <span>
    <q-spinner-grid v-if="loading" size="2em" color="primary" style="clear:both;" class="q-ma-lg" />
    <q-card flat bordered class="q-pa-sm" style="max-width: 100%; max-width:700px; overflow-wrap: break-word" v-if="!loading">
        <q-card-section class="text-center q-pa-md">
            <div class="text-h5">
                <a @click="updateBlock(blockNumber - 1)"><q-icon color="white" name="navigate_before" /></a>
                <span>Block {{ this.tidyNumber(this.blockNumber) }}</span>
                <a @click="updateBlock(blockNumber + 1)"><q-icon color="white" name="navigate_next" /></a>
            </div>
            <span v-if="this.blockHeader" style="text-caption text-center">Witnessed by {{ this.blockHeader.witness }} at {{this.blockHeader.timestamp}} UTC - {{ timeDelta(this.blockHeader.timestamp) }}</span>
        </q-card-section>
        <q-card-section v-if="this.blockOpsReal.length > 0 || this.blockOpsVirtual.length > 0">
            <div class="text-h6 text-center">{{ this.blockOpsReal.length }} Transactions in this block</div>
            <q-list bordered separator dense>
            <q-item v-for="tx in this.blockOpsReal" :key="tx.index">
                <q-item-section v-if="tx.op[0] === 'vote'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].voter)" /></q-avatar>
                    <span class="text-bold">{{ tx.op[1].voter }}</span> voted <q-chip dense :color="returnVoteColor(tx.op[1].weight)">{{ tx.op[1].weight / 100 }} %</q-chip> on <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar><span class="text-bold">{{ tx.op[1].author }} \ <a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].permlink }}</a></span>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'comment'">
                <q-item-label v-if="tx.op[1].parent_author === ''">
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar>
                    {{ tx.op[1].author }} wrote a post
                    <span v-if="tx.op[1].title"> titled "<a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].title }}</a>"</span>
                    <div>
                    <vue-json-pretty :data="tx.op[1]" :custom-value-formatter="customLinkFormatter"/>
                    </div>
                </q-item-label>
                <q-item-label v-else>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar>
                    <span class="text-bold">{{ tx.op[1].author }}</span> commented on {{ tx.op[1].parent_author }} \ <router-link :to="returnLink(tx.op[1].parent_author,tx.op[1].parent_permlink)">{{ tx.op[1].parent_permlink }}</router-link> :
                    <div><vue-json-pretty :data="tx.op[1]" :custom-value-formatter="customLinkFormatter" /></div>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'account_update'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold">{{ tx.op[1].account }}</span> updated profile metadata
                    <vue-json-pretty :data="tx.op[1]" :custom-value-formatter="customLinkFormatter" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'account_update2'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold">{{ tx.op[1].account }}</span> updated profile metadata
                    <vue-json-pretty :data="tx.op[1]" :custom-value-formatter="customLinkFormatter" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'limit_order_create'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].owner }}</span> created limit order - selling {{ tx.op[1].amount_to_sell }} for {{ tx.op[1].min_to_receive }} (Fill or kill: {{ tx.op[1].fill_or_kill }}, Expiration {{ tx.op[1].expiration }}, Order Id {{ tx.op[1].orderid }})
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'fill_order'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].current_owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].current_owner }}</span> filled open order from <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].open_owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].open_owner}}</span> - paid {{  tx.op[1].current_pays }} for {{ tx.op[1].open_pays }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'limit_order_cancel'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].owner }}</span> cancelled limit order id {{ tx.op[1].orderid }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'convert'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].owner }}</span> started conversion of {{ tx.op[1].amount }} , request id {{ tx.op[1].requestid }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'feed_publish'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].publisher)" /></q-avatar><span class="text-bold">{{ tx.op[1].publisher }}</span> published pricefeed of ${{ tx.op[1].exchange_rate.base }} per {{ tx.op[1].exchange_rate.quote }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'comment_options'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].author)" /></q-avatar><span class="text-bold">{{ tx.op[1].author }}</span> changed comment options for <a :href="returnLink(tx.op[1].author,tx.op[1].permlink)">{{ tx.op[1].permlink }}</a>
                    <vue-json-pretty :data="tx.op[1]" :custom-value-formatter="customLinkFormatter" />
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'claim_reward_balance'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].account)" /></q-avatar><span class="text-bold">{{ tx.op[1].account }}</span> claimed reward balance of
                    <span v-if="tx.op[1].reward_hive !== '0.000 HIVE'"><q-chip dense>{{ tx.op[1].reward_hive }}</q-chip></span>
                    <span v-if="tx.op[1].reward_hbd !== '0.000 HBD'"><q-chip dense>{{ tx.op[1].reward_hbd }}</q-chip></span>
                    <span v-if="tx.op[1].reward_vests !== '0.000 VESTS'"><q-chip dense>{{ tx.op[1].reward_vests }}</q-chip></span>
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'claim_account'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].creator)" /></q-avatar><span class="text-bold">{{ tx.op[1].creator }}</span> claimed account creation token with fee of {{ tx.op[1].fee }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'witness_set_properties'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].owner }}</span> set witness properties {{ tx.op[1].props }}
                </q-item-label>
                </q-item-section>
                <q-item-section v-else-if="tx.op[0] === 'witness_set_properties'">
                <q-item-label>
                    <q-avatar size="md"><q-img :src="getHiveAvatarUrl(tx.op[1].owner)" /></q-avatar><span class="text-bold">{{ tx.op[1].owner }}</span> set witness properties {{ tx.op[1].props }}
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
                    sent <span class="text-bold">custom json</span> with id <q-chip color="primary" dense>{{ tx.op[1].id }}</q-chip>
                    <vue-json-pretty :data="JSON.parse(tx.op[1].json)" :custom-value-formatter="customLinkFormatter" />
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
                <router-link :name="tx.trx_id" :to="returnTxLink(tx.trx_id)">{{ tx.trx_id.substr(0,8) }}</router-link>
                </q-item-section>
            </q-item>
            </q-list>
            <div class="text-h6 text-center">{{ this.blockOpsVirtual.length }} Virtual Operations</div>
            <q-list bordered separator dense>
            <q-item v-for="tx in this.blockOpsVirtual" :key="tx.index">
            <q-item-section>
                <q-chip dense class="text-bold">{{ tx.op[0] }}</q-chip>
                <vue-json-pretty :data='tx.op[1]' :custom-value-formatter="customLinkFormatter" />
            </q-item-section>
            <q-item-section side class="text-caption">
                <a :name="tx.virtual_op">{{ tx.virtual_op }}</a>
            </q-item-section>
            </q-item>
            </q-list>
        </q-card-section>
        <q-card-section class="text-body text-center" v-if="!loading">
            <a @click="updateBlock(blockNumber - 1)"><q-icon color="white" name="navigate_before" /></a>
            <span>Block {{ this.tidyNumber(this.blockNumber) }}</span>
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
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import DOMPurify from 'dompurify'
export default {
  name: 'blockView',
  components: {
    VueJsonPretty
  },
  props: {
    blockNum: Number
  },
  data () {
    return {
      block: null,
      blockHeader: null,
      blockOps: [],
      lastIrreversibleBlock: null,
      blockNumber: this.blockNum
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
    returnTxLink (txId) { return '/tx/' + txId },
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
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (['head_block_number', 'last_irreversible_block_num', 'last_confirmed_block_num'].includes(key)) {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else if (['to', 'from', 'comment_author', 'curator', 'author', 'parent_author', 'voter', 'account'].includes(key)) {
        return `<a href="/@${data}">${data}</a>`
      } else if (['permlink'].includes(key)) {
        return `<a href="/@${parent.author}/${parent.permlink}">${data}</a>`
      } else if (['comment_permlink'].includes(key)) {
        return `<a href="/@${parent.comment_author}/${parent.comment_permlink}">${data}</a>`
      } else {
        return DOMPurify.sanitize(defaultFormatted)
      }
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
