<template>
  <div v-if="accountHistory !== null" class="row overflow-auto" style="max-height: 95vh">
    <q-intersection v-for="tx in accountHistory.filter(filterDaysAgo)" :key="tx.index" class="txC">
      <txView :tx="tx" :username="username" />
    </q-intersection>
  </div>
</template>
<style lang="sass" scoped>
.txC
  min-height: 40px
  width: 100%
  margin: 0px
  padding: 0px
</style>
<script>
import txView from 'components/txView.vue'
import moment from 'moment'
export default {
  name: 'Card2AccountOperationsTab',
  props: ['accountHistory', 'day', 'username', 'filter'],
  data () {
    return {
    }
  },
  components: {
    txView
  },
  computed: {
  },
  methods: {
    getDaysAgo (timestamp) {
      var now = moment()
      var then = moment.utc(timestamp)
      var delta = now.diff(then, 'days')
      return delta
    },
    filterDaysAgo (tx) {
      var daysago = parseInt(this.getDaysAgo(tx[1].timestamp))
      if (daysago === parseInt(this.day)) {
        switch (tx[1].op[0]) {
          case 'producer_reward':
            if (this.filter.producerRewards) { return false } else { return true }
          case 'customJson':
            if (this.filter.customJson) { return false } else { return true }
          case 'curation_reward':
            if (this.filter.curationReward) { return false } else { return true }
          default:
            return true
        }
      } else {
        return false
      }
    }
  },
  mounted () {
  }
}
</script>
