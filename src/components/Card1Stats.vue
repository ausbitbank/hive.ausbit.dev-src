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
      $ {{ upvoteValue }}
    </span>
  </div>
  <div>
    <span class="text-bold q-pa-md">
      Vote Power
    </span>
    <span>
      {{ votePower }} %
    </span>
  </div>
  <div>
  <span class="text-bold q-pa-md">
    VP -> 100%
  </span>
  <span>
    {{ votePowerRechargeTime }}
    <!-- in 1d 15h 56m | Tomorrow, 19:36 (example) -->
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
import moment from 'moment'
export default {
  name: 'Card1Stats',
  props: ['A', 'followCounts', 'globalPropsHive', 'upvoteValue'],
  data () {
    return {
    }
  },
  computed: {
    rep: function () {
      return hive.formatter.reputation(this.A.reputation)
    },
    baseHP: function () {
      return this.mvestsToHP(parseInt(this.A.vesting_shares.split(' ')[0]))
    },
    receivedHP: function () {
      return this.mvestsToHP(parseInt(this.A.received_vesting_shares.split(' ')[0]))
    },
    sentHP: function () {
      return this.mvestsToHP(parseInt(this.A.delegated_vesting_shares.split(' ')[0]))
    },
    effectiveHP: function () {
      return ((parseInt(this.baseHP) + parseInt(this.receivedHP)) - parseInt(this.sentHP))
    },
    votePower: function () {
      var secondsago = (new Date() - new Date(this.A.last_vote_time + 'Z')) / 1000
      var vpow = this.A.voting_power + (10000 * secondsago / 432000)
      return Math.min(vpow / 100, 100).toFixed(2)
    },
    votePowerRechargeTime: function () {
      // VP Recharges 20 % in 24 hours, or 0.0138888888888889 % in 1 minute
      var minutesTillCharge = (100 - this.votePower) / 0.0138888888888889
      return moment().add(minutesTillCharge, 'minutes').calendar()
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
