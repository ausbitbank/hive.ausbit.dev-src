<template>
  <div>
  <div class="text-h4">
    Stats
  </div>
  <div>
    <span class="text-bold q-pa-md">
      Effective Power
    </span>
    <span>
      TOTAL HP (BASEHP + DELEGATIONSIN - DELEGATIONSOUT)
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
  props: ['A', 'followCounts'],
  data () {
    return {
    }
  },
  computed: {
    rep: function () {
      return hive.formatter.reputation(this.A.reputation)
    }
  },
  methods: {

  }
}
</script>
