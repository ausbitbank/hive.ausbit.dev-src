<template>
  <q-page class="flex q-pa-md">
    <div v-if="tx">
      <div>
        <span class="text-h5">TX</span>
        <span class="text-italic">{{ txId }}</span>
      </div>
      <div>
        <span class="text-subtitle">Included in block
          <span><a :href="returnBlockLink(tx.block_num)">{{ tidyNumber(tx.block_num) }}</a> {{ timeDelta(tx.expiration) }}</span>
        </span>
        <q-separator />
        <div class="q-pa-md q-mt-md">
          <vue-json-pretty :data="tx" />
        </div>
      </div>
    </div>
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
