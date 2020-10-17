<template>
  <q-page class="flex flex-center">
    <q-spinner-pie v-if="A === null" color="secondary" size="5em"/>
    <div style="min-width:50%" v-if="A !== null && rewardFundPost !== null">
      <!-- <q-card v-if="accountState !== null"> -->
        <q-expansion-item expand-separator icon="account_balance_wallet" expand-icon="unfold_more" expanded-icon="unfold_less" :label="Card1Title" default-opened header-class="bg-secondary text-white sectionHeader shadow-5" expand-icon-class="text-white">
          <q-card bordered>
            <q-splitter v-model="card1Split" unit="px" separator-class="bg-secondary">
              <template v-slot:before>
                <q-tabs v-model="card1Tab" vertical indicator-color="white">
                  <q-tab name="stats" label="Stats" />
                  <q-tab name="balances" label="Balances" />
                  <q-tab name="accountDetails" label="Account Details" />
                  <q-tab name="witnessDetails" label="Witness Details" />
                  <q-tab name="delegations" label="Delegations" />
                  <q-tab name="followers" label="Followers" />
                  <q-tab name="mentions" label="Mentions" />
                  <q-tab name="orders" label="Orders" />
                  <q-tab name="marketInfo" label="Market Info" />
                  <q-tab name="systemInfo" label="System Info" />
                  <q-tab name="settings" label="Settings" />
                </q-tabs>
              </template>
              <template v-slot:after>
                <q-tab-panels v-model="card1Tab" animated swipeable vertical transition-prev="jump-up" transition-next="jump-down" v-if="A !== null">
                  <q-tab-panel name="stats">
                    <card1Stats v-if="followCounts !== null && globalPropsHive !== null" :A="A" :followCounts="followCounts" :globalPropsHive="globalPropsHive" :upvoteValue="upvoteValue" />
                  </q-tab-panel>
                  <q-tab-panel name="balances">
                    <card1Balances :A="A" :globalPropsHive="globalPropsHive" />
                  </q-tab-panel>
                  <q-tab-panel name="accountDetails">
                    <card1AccountDetails :A="A" :globalPropsHive="globalPropsHive" :RC="RC" />
                  </q-tab-panel>
                  <q-tab-panel name="witnessDetails">
                    <card1WitnessDetails :username="username" />
                  </q-tab-panel>
                  <q-tab-panel name="delegations">
                    <card1Delegations :username="username" :hivePerMvests="hivePerMvests" :rpcListHive="rpcListHive" :A="A" />
                  </q-tab-panel>
                  <q-tab-panel name="followers">
                    <card1Followers :username="username" :followCounts="followCounts" />
                  </q-tab-panel>
                  <q-tab-panel name="mentions">
                    <card1Mentions :username="username" />
                  </q-tab-panel>
                  <q-tab-panel name="orders">
                    <card1Orders :username="username" />
                  </q-tab-panel>
                  <q-tab-panel name="marketInfo">
                    <card1MarketInfo :username="username" />
                  </q-tab-panel>
                  <q-tab-panel name="systemInfo">
                    <card1SystemInfo :A="A" :globalPropsHive="globalPropsHive" :hivePerMvests="hivePerMvests" :rewardFundPost="rewardFundPost" />
                  </q-tab-panel>
                  <q-tab-panel name="settings">
                    <card1Settings :username="username" />
                  </q-tab-panel>
                </q-tab-panels>
              </template>
            </q-splitter>
          </q-card>
        </q-expansion-item>
        <q-expansion-item expand-separator icon="list_alt" expand-icon="unfold_more" expanded-icon="unfold_less" label='Account Operations' header-class="bg-teal-7 text-white sectionHeader">
          <card2AccountOperations :username="username" :globalPropsHive="globalPropsHive" />
        </q-expansion-item>
        <q-expansion-item expand-separator icon="message" expand-icon="unfold_more" expanded-icon="unfold_less" label='Posts' header-class="bg-purple-8 text-white scroll sectionHeader">
          <card3-posts :username="username" />
        </q-expansion-item>
        <q-expansion-item expand-separator icon="monetization_on" expand-icon="unfold_more" expanded-icon="unfold_less" label='Coming Rewards' header-class="bg-deep-orange-8 text-white sectionHeader" v-if="false">
          <q-card>
          </q-card>
        </q-expansion-item>
        <q-expansion-item expand-separator icon="settings" expand-icon="unfold_more" expanded-icon="unfold_less" label='Tools' header-class="bg-indigo-9 text-white sectionHeader">
          <card5Tools :username="username" v-if="globalPropsHive !== null" :globalPropsHive="globalPropsHive" />
        </q-expansion-item>
      <!-- </q-card> -->
    </div>
    <q-dialog v-model="userSwitch">
      <q-card>
        <form @submit.prevent.stop="$router.replace({ path: '@' + username })" @reset.prevent.stop="onReset" class="q-gutter-md">
          <q-input filled v-model="username" label="Username" />
          <q-btn color="secondary" label="Switch User" type="submit" />
        </form>
      </q-card>
    </q-dialog>
  </q-page>
</template>
<style>
a { color: secondary }
.sectionHeader {
-webkit-border-top-left-radius: 90px;
-webkit-border-top-right-radius: 90px;
-moz-border-radius-topleft: 90px;
-moz-border-radius-topright: 90px;
border-top-left-radius: 90px;
border-top-right-radius: 90px;
}
</style>
<script>
import hive from '@hiveio/hive-js'
import moment from 'moment'
import card1Stats from 'components/Card1Stats.vue'
import card1Balances from 'components/Card1Balances.vue'
import card1AccountDetails from 'components/Card1AccountDetails.vue'
import card1WitnessDetails from 'components/Card1WitnessDetails.vue'
import card1Delegations from 'components/Card1Delegations.vue'
import card1Followers from 'components/Card1Followers.vue'
import card1Mentions from 'components/Card1Mentions.vue'
import card1Orders from 'components/Card1Orders.vue'
import card1MarketInfo from 'components/Card1MarketInfo.vue'
import card1SystemInfo from 'components/Card1SystemInfo.vue'
import card1Settings from 'components/Card1Settings.vue'
import card2AccountOperations from 'components/Card2AccountOperations.vue'
import card3Posts from 'components/Card3Posts.vue'
import card5Tools from 'components/Card5ToolsTabs.vue'
export default {
  name: 'Home',
  data () {
    return {
      username: '',
      rpcListHive: ['https://anyx.io', 'https://rpc.ausbit.dev', 'https://api.openhive.network', 'https://api.hive.blog'],
      globalPropsHive: null,
      accountState: null,
      RC: { max: null, current: null, percent: null },
      card1Tab: 'stats',
      card1Split: 150,
      followCounts: null,
      feedPrice: null,
      rewardFundPost: null,
      userSwitch: false
    }
  },
  components: {
    card1Stats: card1Stats,
    card1Balances: card1Balances,
    card1AccountDetails: card1AccountDetails,
    card1WitnessDetails: card1WitnessDetails,
    card1Delegations: card1Delegations,
    card1Followers: card1Followers,
    card1Mentions: card1Mentions,
    card1Orders: card1Orders,
    card1MarketInfo: card1MarketInfo,
    card1SystemInfo: card1SystemInfo,
    card1Settings: card1Settings,
    card2AccountOperations: card2AccountOperations,
    card3Posts: card3Posts,
    card5Tools: card5Tools
  },
  watch: {
    '$route.path': 'init'
  },
  computed: {
    A: function () {
      if (this.accountState === null) {
        return null
      } else {
        return this.accountState
      }
    },
    AccountMeta: function () {
      if (this.accountState === null) {
        return null
      } else {
        return JSON.parse(this.accountState.json_metadata)
      }
    },
    Card1Title: function () {
      // return this.username + ' (' + this.rep + ') | Wallet'
      return this.username[0].toUpperCase() + this.username.slice(1) + '\'s Wallet'
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_hive.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    },
    rep: function () {
      return hive.formatter.reputation(this.A.reputation)
    },
    upvoteValue: function () { // Aims to return the value in dollars of a 100% vote at full strength
      if (this.A !== null && this.rewardFundPost && this.feedPrice !== null) {
        var myVests = parseFloat(this.A.vesting_shares.split(' ')[0]) + parseFloat(this.A.received_vesting_shares.split(' ')[0]) - parseFloat(this.A.delegated_vesting_shares.split(' ')[0])
        myVests = myVests * 1000000
        // console.log('my vests: ' + myVests)
        var myVotePower = myVests * 0.02 // Assuming 100% VP, 100% weight
        var recentClaims = parseFloat(this.rewardFundPost.recent_claims)
        // console.log('recent claims: ' + recentClaims)
        var myInfluencePercent = myVotePower / recentClaims
        // console.log('my influence percent: ' + myInfluencePercent)
        var rewardBalance = parseFloat(this.rewardFundPost.reward_balance.split(' ')[0])
        // console.log('reward balance: ' + rewardBalance)
        // var rewardsPerShare = rewardBalance / parseFloat(this.rewardFundPost.recent_claims)
        // console.log('rewardsPerShare: ' + rewardsPerShare)
        var voteValueHive = myInfluencePercent * rewardBalance
        // console.log('value in hive: ' + voteValueHive)
        // console.log('feed price: ' + this.feedPrice)
        var voteValueDollars = voteValueHive * this.feedPrice
        // console.log('value in dollars: ' + voteValueDollars)
        return voteValueDollars
      } else {
        return null
      }
    }
  },
  methods: {
    async getGlobalPropsHive () {
      hive.api.setOptions({ url: this.rpcListHive[0] })
      hive.api.getDynamicGlobalPropertiesAsync().then(function (res, err) {
        if (err) { console.log(err) }
        this.globalPropsHive = res
      }.bind(this))
    },
    async checkUsername (username) {
      hive.api.setOptions({ url: this.rpcListHive[0] })
      hive.api.getAccounts([username], (err, result) => {
        if (err) { this.$q.notify({ color: 'negative', position: 'top', message: 'Error checking hive api', icon: 'report_problem' }) }
        if (result.length === 0) {
          console.log('Invalid hive username: ' + username)
          this.userSwitch = true
        }
        if (result.length > 0) { this.accountState = result[0] }
      })
    },
    vestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000000000).toFixed(3)
    },
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    async getFollowCount (username) {
      hive.api.setOptions({ url: this.rpcListHive[0] })
      hive.api.getFollowCount(username, function (err, result) {
        if (err) { console.log(err) }
        this.followCounts = result
      }.bind(this))
    },
    async getFeedPrice () {
      hive.api.setOptions({ url: this.rpcListHive[0] })
      hive.api.getCurrentMedianHistoryPrice(function (err, result) {
        if (err) { console.log(err) }
        var b = result.base.split(' ')[0]
        var q = result.quote.split(' ')[0]
        this.feedPrice = b / q
      }.bind(this))
    },
    async getRewardFundPost () {
      hive.api.setOptions({ url: this.rpcListHive[0] })
      hive.api.getRewardFund('post', function (err, result) {
        if (err) { console.log(err) }
        this.rewardFundPost = result
      }.bind(this))
    },
    async getRC (username) {
      var url = 'https://anyx.io/v1/rc_api/find_rc_accounts?accounts=' + username
      this.$axios.get(url)
        .then((res) => {
          res = res.data
          this.RC.max = res.rc_accounts[0].max_rc
          this.RC.current = res.rc_accounts[0].rc_manabar.current_mana
          var percent = parseFloat((this.RC.current / this.RC.max) * 100).toFixed(2)
          if (percent > 100.00) { percent = 100 }
          this.RC.percent = percent
        })
        .catch(() => {
          console.log('error loading RC from anyx.io')
        })
    },
    init () {
      this.getGlobalPropsHive()
      if (this.$router.currentRoute.params.username) {
        this.username = this.$router.currentRoute.params.username
      }
      this.checkUsername(this.username)
      this.getFollowCount(this.username)
      this.getFeedPrice()
      this.getRewardFundPost()
      this.getRC(this.username)
    }
  },
  mounted () {
    this.init()
  }
}
</script>
