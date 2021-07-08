<template>
  <span>
  <q-card flat bordered dense class="q-ma-none q-pa-none q-mb-sm" v-for="op in accountOperations" :key="op.index">
      <q-card-section v-if="accountOperations.length > 0">
          <q-list dense>
              <q-item>
                  <q-item-section avatar class="gt-xs">
                      <q-avatar v-if="op[1].op[1].producer"><q-img :src="getHiveAvatarUrl(op[1].op[1].producer)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].creator"><q-img :src="getHiveAvatarUrl(op[1].op[1].creator)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].curator"><q-img :src="getHiveAvatarUrl(op[1].op[1].curator)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].benefactor"><q-img :src="getHiveAvatarUrl(op[1].op[1].benefactor)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].delegator"><q-img :src="getHiveAvatarUrl(op[1].op[1].delegator)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].account"><q-img :src="getHiveAvatarUrl(op[1].op[1].account)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].voter"><q-img :src="getHiveAvatarUrl(op[1].op[1].voter)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].from_account"><q-img :src="getHiveAvatarUrl(op[1].op[1].from_account)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].publisher"><q-img :src="getHiveAvatarUrl(op[1].op[1].publisher)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].payer"><q-img :src="getHiveAvatarUrl(op[1].op[1].payer)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].owner"><q-img :src="getHiveAvatarUrl(op[1].op[1].owner)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].current_owner"><q-img :src="getHiveAvatarUrl(op[1].op[1].current_owner)" /></q-avatar>
                      <q-avatar v-if="['vote', 'account_witness_vote', 'effective_comment_vote'].includes(op[1].op[0])"><q-icon name="how_to_vote" /></q-avatar>
                      <q-avatar v-if="['limit_order_create'].includes(op[1].op[0])"><q-icon name="sell" color="green-4" /></q-avatar>
                      <q-avatar v-if="['curation_reward', 'comment_benefactor_reward', 'producer_reward', 'claim_reward_balance', 'comment_reward', 'author_reward', 'fill_vesting_withdraw', 'proposal_pay', 'interest', 'fill_order'].includes(op[1].op[0])"><q-icon color="green" name="monetization_on" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].comment_author"><q-img :src="getHiveAvatarUrl(op[1].op[1].comment_author)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].author"><q-img :src="getHiveAvatarUrl(op[1].op[1].author)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].from"><q-img :src="getHiveAvatarUrl(op[1].op[1].from)" /></q-avatar>
                      <q-avatar v-if="op[1].op[0] == 'comment'"><q-icon name="comment" /></q-avatar>
                      <q-avatar v-if="op[1].op[0] == 'delegate_vesting_shares'"><q-icon name="add_circle" /></q-avatar>
                      <q-avatar v-if="op[1].op[0] == 'transfer'"><q-icon name="send" color="primary" /></q-avatar>
                      <q-avatar v-if="['comment_options', 'feed_publish', 'sps_fund'].includes(op[1].op[0])"><q-icon name="settings" /></q-avatar>
                      <q-avatar v-if="['custom_json', 'witness_set_properties'].includes(op[1].op[0])"><q-icon name="notes" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].to"><q-img :src="getHiveAvatarUrl(op[1].op[1].to)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].parent_author"><q-img :src="getHiveAvatarUrl(op[1].op[1].parent_author)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].delegatee"><q-img :src="getHiveAvatarUrl(op[1].op[1].delegatee)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].open_owner"><q-img :src="getHiveAvatarUrl(op[1].op[1].open_owner)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].to_account"><q-img :src="getHiveAvatarUrl(op[1].op[1].to_account)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].receiver"><q-img :src="getHiveAvatarUrl(op[1].op[1].receiver)" /></q-avatar>
                      <q-avatar v-if="op[1].op[1].witness"><q-img :src="getHiveAvatarUrl(op[1].op[1].witness)" /></q-avatar>
                  </q-item-section>
                  <q-item-section class="wrap">
                      <div class="text-bold">{{ op[1].op[0] }}</div>
                      <json-viewer :data="op[1].op[1]" />
                  </q-item-section>
                  <q-item-section side>
                      <span>
                          <div v-if="op[1].trx_id === '0000000000000000000000000000000000000000'">vtx {{ op[1].virtual_op }}</div>
                          <div v-else>tx <router-link :to="linkTx(op[1].trx_id)">{{ op[1].trx_id.substr(0,8) }}</router-link></div>
                          <div v-if="op[1].trx_id === '0000000000000000000000000000000000000000'">block <router-link :to="returnBlockLink(op[1].block,op[1].virtual_op)">{{ tidyNumber(op[1].block) }}</router-link></div>
                          <div v-else>block <router-link :to="returnBlockLink(op[1].block, op[1].trx_id)">{{ op[1].block }}</router-link></div>
                          <div :title="op[1].timestamp">{{ timeDelta(op[1].timestamp) }}</div>
                      </span>
                  </q-item-section>
              </q-item>
          </q-list>
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
import jsonViewer from 'components/jsonViewer.vue'
import moment from 'moment'
export default {
  name: 'accountOperations',
  props: ['accountOperations'],
  components: { jsonViewer },
  data () {
    return {
    }
  },
  computed: {
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
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnBlockLink (blockNum, txId) { return '/b/' + blockNum + '#' + txId },
    linkTx (txid) { return '/tx/' + txid }
  },
  mounted () {
  }
}
</script>
