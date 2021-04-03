<template>
    <q-page class="flex q-pa-md flex-center">
        <q-card class="text-center">
          <q-card-section>
            <p>Abuse fighting tool. Select a user, find and attempt to remove payouts.</p>
            <p class="text-italic text-bold text-red">Alpha, buggy, don't use if you don't understand the risks.</p>
            <q-input label="username" v-model="usernameField" />
            <q-btn label="Find pending payouts" @click="lookup(usernameField)" color="primary" bordered glossy class="q-ma-md" />
            <div v-if="loggedInUser">
              Downvote Power for {{ loggedInUser }}
              <q-linear-progress dark stripe rounded size="20px" :value="this.downvotePowerPct / 100" color="red">
                <div class="absolute-full flex flex-center">
                    <q-badge color="black" text-color="primary" :label="this.downvotePowerPct" />
                </div>
              </q-linear-progress>
              <q-btn title="Refresh logged in account data" size="sm" round color="green" icon="refresh" class="q-ma-sm" />
            </div>
          </q-card-section>
          <q-card-section v-if="posts.length > 0">
            <h4>Pending payouts for {{ username }}</h4>
            <q-btn color="red" flat label="Downvote all" icon="thumb_down" @click="downvoteAll()" v-if="loggedInUser" />
            <q-list flat bordered separator>
            <q-item v-for="post in postsWithPayoutNotVoted" :key="post.index">
              <q-item-section>
                <router-link :to="returnPostLink(post.author, post.permlink)"><q-icon name="link" /> {{ post.permlink.substr(0,50) }}</router-link> Pays out ${{ post.payout }} {{ timeDelta(post.payout_at) }}
                <q-table :data="post.active_votes" :columns="voteColumns" :pagination="{ sortBy: 'rshares', descending: true, rowsPerPage: 5 }" dense bordered separator="cell" />
                <q-btn color="warning" icon="thumb_down" flat @click="vote(post.author, post.permlink, calcWeightForRshares(post.net_rshares))" v-if="loggedInUser" >&nbsp;&nbsp;&nbsp;Downvote {{ calcWeightForRshares(post.net_rshares) }} %</q-btn>
              </q-item-section>
            </q-item>
            </q-list>
          </q-card-section>
        </q-card>
    </q-page>
</template>
<script>
import moment from 'moment'
export default {
  name: 'Downvoter',
  components: { },
  data () {
    return {
      usernameField: '',
      username: '',
      posts: [],
      rewardFundPost: null,
      median: null,
      voteColumns: [
        {
          name: 'voter',
          label: 'Voter',
          field: 'voter',
          sortable: true
        },
        {
          name: 'rshares',
          label: 'rshares',
          field: 'rshares',
          sortable: true
        }
      ]
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    account: {
      get () {
        if (this.loggedInUser) {
          return this.$store.state.hive.accounts[this.loggedInUser]
        } else {
          return null
        }
      }
    },
    effectiveVests: function () {
      if (this.account !== undefined && this.account !== null) {
        return parseInt(this.account.vesting_shares.split(' ')[0]) + parseInt(this.account.received_vesting_shares.split(' ')[0]) - parseInt(this.account.delegated_vesting_shares.split(' ')[0]) - parseInt(this.account.vesting_withdraw_rate.split(' ')[0])
      } else {
        return null
      }
    },
    downvotePower: function () {
      if (this.account !== undefined) {
        return (this.account.downvote_manabar.current_mana / ((this.effectiveVests / 4) * 1e4)) * 100
      } else {
        return null
      }
    },
    downvotePowerPct: function () {
      if (this.account !== undefined) {
        var pct = (this.downvotePower / 100).toFixed(2)
        if (pct > 100) { pct = 100.00 }
        return pct
      } else {
        return null
      }
    },
    postsWithPayoutNotVoted: function () {
      if (this.posts.length > 0) {
        return this.posts.filter(p => p.net_rshares > 0 && p.active_votes.filter(v => v.voter === this.loggedInUser).length === 0)
      } else {
        return []
      }
    }
  },
  methods: {
    sortPostsByAge () {
      this.posts.sort((a, b) => { return moment(a.created) - moment(b.created) })
    },
    downvoteAll () {
      this.posts.filter(p => p.net_rshares > 0 && p.active_votes.filter(v => v.voter === this.loggedInUser).length === 0).forEach(p => { this.downvotePost(p) })
    },
    downvotePost (post) {
      this.vote(post.author, post.permlink, this.calcWeightForRshares(post.net_rshares))
    },
    calcWeightForRshares (rsharesRequired) {
      var vestingShares = parseFloat(this.account.vesting_shares.split(' ')[0])
      var receivedVestingShares = parseFloat(this.account.received_vesting_shares.split(' ')[0])
      var delegatedVestingShares = parseFloat(this.account.delegated_vesting_shares.split(' ')[0])
      var totalVests = vestingShares + receivedVestingShares - delegatedVestingShares
      var finalVests = totalVests * 1e6
      var weight = 10000
      var power = (this.downvotePower * weight / 10000) / 50
      var rshares = power * finalVests / 10000
      if (rsharesRequired < rshares) {
        var percentRequired = parseInt((rsharesRequired / rshares) * 100)
        if (percentRequired === 0) { percentRequired = 1 }
        return -Math.abs(percentRequired)
      } else {
        return -100
      }
    },
    async lookup (user) {
      this.username = user.toLowerCase()
      this.posts = []
      var params = { account: this.username, sort: 'payout' }
      this.$hive.api.callAsync('bridge.get_account_posts', params)
        .then(response => {
          this.posts = response
          this.sortPostsByAge()
        })
    },
    async vote (author, permlink, weight) {
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['vote', { voter: this.loggedInUser, weight: weight * 100, author: author, permlink: permlink }]])
    },
    async getRewardFundPost () {
      this.$hive.api.getRewardFund('post', function (err, result) {
        if (err) { console.log(err) }
        this.rewardFundPost = result
      }.bind(this))
    },
    async getMedianPrice () {
      this.$hive.api.getCurrentMedianHistoryPrice(function (err, result) {
        if (err) { console.error(err) }
        if (result) { this.median = result }
      }.bind(this))
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    returnPostLink (author, permlink) {
      return '/@' + author + '/' + permlink
    },
    refresh () {
      if (this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
    },
    async init () {
      await this.getRewardFundPost()
      await this.getMedianPrice()
      if (this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
    }
  },
  mounted () {
    document.title = 'Downvoter'
    this.init()
  }
}
</script>
