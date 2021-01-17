<template>
  <q-page class="flex-center q-pa-md" style="overflow-wrap:break-word">
    <span class="column items-center">
    <q-card bordered flat v-if="tx" style="max-width: 100%;" class="col">
      <q-card-section>
        <div class="text-h6">Transaction {{ txId }}</div>
        <div class="text-subtitle"> Included in
          <span><router-link :to="returnBlockLink(tx.block)"> Block {{ tidyNumber(tx.block) }}</router-link></span>
        </div>
      </q-card-section>
      <q-card-section>
        <div>
          <json-viewer :data="tx" />
        </div>
      </q-card-section>
    </q-card>
    </span>
  </q-page>
</template>
<style>
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import moment from 'moment'
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'blockView',
  components: {
    jsonViewer
  },
  data () {
    return {
      txId: this.$route.params.txId,
      tx: null,
      blockNum: null,
      blockOps: null
    }
  },
  computed: {
  },
  methods: {
    getTx (txId) {
      var params = { transaction_id: txId }
      this.$hive.api.callAsync('transaction_status_api.find_transaction', params)
        .then(res => {
          console.log('Tx found in block ' + res.block_num)
          this.getBlockOps(res.block_num)
        })
    },
    getTxFromBlockOps (blockOps) {
      this.blockOps = blockOps
      this.tx = (this.blockOps.filter(op => op.trx_id === this.txId))[0]
    },
    getBlockOps (blocknum) {
      this.$hive.api.getOpsInBlockAsync(blocknum, false)
        .then(blockOps => this.getTxFromBlockOps(blockOps))
        .catch(error => console.log(error))
    },
    setTx (tx) {
      this.tx = tx
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
    returnBlockLink (blockNum) { return '/b/' + blockNum + '#' + this.txId }
  },
  mounted () {
    this.getTx(this.$route.params.txId)
    document.title = 'Transaction ' + this.$route.params.txId
  }
}
</script>
