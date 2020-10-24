<template>
  <q-page class="flex-center q-pa-md" style="overflow-wrap:break-word">
    <span class="column items-center">
    <q-card bordered flat v-if="tx" style="max-width: 100%;" class="col">
      <q-card-section>
        <div class="text-h6">Transaction {{ txId }}</div>
        <div class="text-subtitle"> Included in
          <span><router-link :to="returnBlockLink(tx.block_num)"> Block {{ tidyNumber(tx.block_num) }}</router-link></span>
        </div>
      </q-card-section>
      <q-card-section>
        <div>
          <vue-json-pretty :data="tx" />
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
import hive from '@hiveio/hive-js'
hive.api.setOptions({ url: 'https://anyx.io' })
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
      txId: this.$route.params.txId,
      tx: null
    }
  },
  computed: {
  },
  methods: {
    getTx (txId) {
      hive.api.getTransactionAsync(txId)
        .then(tx => this.setTx(tx))
        .catch(error => console.log(error))
    },
    setTx (tx) {
      this.tx = tx
      console.log('Transaction')
      console.log(tx)
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
  }
}
</script>
