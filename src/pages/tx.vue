<template>
  <q-page class="flex-center q-pa-md" style="overflow-wrap:break-word">
    <span class="column items-center">
    <q-card bordered flat v-if="tx" style="max-width: 100%;" class="col">
      <q-card-section>
        <div class="text-h6">Transaction {{ txId }}</div>
        <div class="text-subtitle"> Included in
          <span v-if="tx.block_num"><router-link :to="returnBlockLink(tx.block_num)"> Block {{ tidyNumber(tx.block_num) }}</router-link></span>
          <span v-else><router-link :to="returnBlockLink(tx[0].block)"> Block {{ tidyNumber(tx[0].block) }}</router-link></span>
        </div>
      </q-card-section>
      <q-card-section>
        <div>
          <json-viewer :data="operations" />
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
// import accountOperations from 'components/accountOperations.vue'
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
      blockOps: null,
      api: null,
      txLookupApiNode: 'https://api.hive.blog'
    }
  },
  computed: {
    operations: function () {
      if (this.tx !== null) {
        var ops = {}
        if ('block_num' in this.tx) { // 2 different api's are for tx's with diff response formats, make them look the same
          ops = { ref_block_num: this.tx.ref_block_num, ref_block_prefix: this.tx.ref_block_prefix, expiration: this.tx.expiration, operations: [], extensions: this.tx.extensions, signatures: this.tx.signatures, transaction_id: this.tx.transaction_id, block_num: this.tx.block_num, transaction_num: this.tx.transaction_num }
          this.tx.operations.forEach(t => { ops.operations.push(t) })
        } else {
          ops = { operations: [] }
          this.tx.forEach(t => { ops.operations.push(t.op) })
        }
        return ops
      } else {
        return {}
      }
    }
  },
  methods: {
    getTx2 (txId) {
      this.api = this.$hive.config.get('url')
      this.$hive.api.setOptions({ url: this.txLookupApiNode })
      this.$hive.api.getTransactionAsync(txId)
        .then(tx => this.setTx(tx))
        .catch(error => console.log(error))
    },
    getTx (txId) {
      var params = { transaction_id: txId }
      this.$hive.api.callAsync('transaction_status_api.find_transaction', params)
        .then(res => {
          if (res.block_num) {
            console.log('Tx found in block ' + res.block_num)
            this.getBlockOps(res.block_num)
          } else {
            console.log('Unable to find tx with transaction status api, attempting getTransaction api')
            this.getTx2(txId)
          }
        })
    },
    getTxFromBlockOps (blockOps) {
      this.blockOps = blockOps
      this.tx = (this.blockOps.filter(op => op.trx_id === this.txId))
    },
    getBlockOps (blocknum) {
      this.$hive.api.getOpsInBlockAsync(blocknum, false)
        .then(blockOps => this.getTxFromBlockOps(blockOps))
        .catch(error => console.log(error))
    },
    setTx (tx) {
      if (this.api !== this.$hive.config.get('url') && this.api !== null) { this.$hive.api.setOptions({ url: this.api }) } // If we changed api node to get a tx, change back to the original now
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
    this.getTx(this.$route.params.txId) // Use method 2 only for the most info
    document.title = 'Transaction ' + this.$route.params.txId
  }
}
</script>
