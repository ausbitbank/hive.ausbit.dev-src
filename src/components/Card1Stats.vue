<template>
  <div>
  <div>
    <span class="text-bold q-pa-md">
      Effective Power
    </span>
    <span>
      {{ effectiveHP }} ({{ baseHP }} + {{ receivedHP }} - {{ sentHP }} )
    </span>
  </div>
  <div>
    <span class="text-bold q-pa-md">
      Vote Amount
    </span>
    <span>
      $x
    </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    VP -> 100%
  </span>
  <span>
    in 1d 15h 56m | Tomorrow, 19:36 (example)
  </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    Reputation
  </span>
  <span>
    {{ rep }}
  </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    Followers
  </span>
  <span>
    {{ followCounts.follower_count }} | {{ followCounts.following_count }} following
  </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    Post Count
  </span>
  <span>
    {{ A.post_count }}
  </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    Vote Count
  </span>
  <span>
    x votes | x votes received
  </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    Voting CSI
  </span>
  <span>
    x (x% self, x upvotes, x accounts, last 7d)
  </span>
  </div>
  </div>
</template>

<script>
import hive from 'steem'
export default {
  name: 'Card1Stats',
  props: ['A', 'followCounts', 'globalPropsHive'],
  data () {
    return {
    }
  },
  computed: {
    rep: function () {
      return hive.formatter.reputation(this.A.reputation)
    },
    baseHP: function () {
      return this.mvestsToHP(this.A.vesting_shares.split(' ')[0])
    },
    receivedHP: function () {
      return this.mvestsToHP(this.A.received_vesting_shares.split(' ')[0])
    },
    sentHP: function () {
      return this.mvestsToHP(this.A.delegated_vesting_shares.split(' ')[0])
    },
    effectiveHP: function () {
      return ((this.baseHP + this.receivedHP) - this.sentHP)
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    }
  }
}
</script>
