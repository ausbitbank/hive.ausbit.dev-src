<template>
  <div v-if="accountHistory !== null" class="row overflow-auto" style="max-height: 95vh">
    <q-intersection v-for="tx in filteredPosts" :key="tx.index" class="txC">
      <txView :tx="tx" :username="username" :globalPropsHive="globalPropsHive" :filter="filter" />
    </q-intersection>
    <div v-if="filteredPosts.length === 0">
      <q-avatar><q-icon name="warning" color="secondary" /></q-avatar> No unfiltered transactions on this day
    </div>
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
  props: ['accountHistory', 'day', 'username', 'filter', 'globalPropsHive'],
  data () {
    return {
    }
  },
  components: {
    txView
  },
  computed: {
    filteredPosts: function () {
      return this.accountHistory.filter(this.filterDaysAgo)
    }
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
            if (this.filter.producerRewards || this.filter.witnessRelated) { return false } else { return true }
          case 'feed_publish':
            if (this.filter.witnessRelated) { return false } else { return true }
          case 'account_witness_vote':
            if (this.filter.witnessRelated) { return false } else { return true }
          case 'customJson':
            if (this.filter.customJson) { return false } else { return true }
          case 'comment_benefactor_reward':
            if (this.filter.benefactorRewards) { return false } else { return true }
          case 'curation_reward':
            if (this.filter.curationRewards) { return false } else { return true }
          case 'comment':
            if (this.filter.comments) { return false } else { return true }
          case 'claim_reward_balance':
            if (this.filter.claimRewards) { return false } else { return true }
          case 'vote':
            if (this.filter.votes) { return false } else { return true }
          case 'transfer':
            if (this.filter.transfers) { return false } else { return true }
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
