<template>
  <q-page class="flex flex-center">
    <div>
      <q-spinner-pie v-if="accountState === null" color="secondary" size="5em"/>
      <q-card style="width:1000px" v-if="accountState !== null">
        <q-expansion-item expand-separator icon="unfold_more" :label="Card1Title" default-opened>
          <q-card>
            <q-splitter v-model="card1Split">
              <template v-slot:before>
                <q-tabs v-model="card1Tab" vertical>
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
                <q-tab-panels v-model="card1Tab" animated swipeable vertical transition-prev="jump-up" transition-next="jump-down">
                  <q-tab-panel name="stats">
                    <card1Stats v-if="A !== null && followCounts !== null && globalPropsHive !== null" :A="A" :followCounts="followCounts" :globalPropsHive="globalPropsHive" />
                  </q-tab-panel>
                  <q-tab-panel name="balances">
                    <card1Balances v-if="A" :A="A" :globalPropsHive="globalPropsHive" />
                  </q-tab-panel>
                  <q-tab-panel name="accountDetails">
                    <card1AccountDetails v-if="A" :A="A" :globalPropsHive="globalPropsHive" />
                  </q-tab-panel>
                  <q-tab-panel name="witnessDetails">
                    <card1WitnessDetails :username="username" />
                  </q-tab-panel>
                  <q-tab-panel name="delegations">
                    <card1Delegations :username="username" :hivePerMvests="hivePerMvests" :rpcListHive="rpcListHive" />
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
                    <card1SystemInfo :username="username" />
                  </q-tab-panel>
                  <q-tab-panel name="settings">
                    <card1Settings :username="username" />
                  </q-tab-panel>
                </q-tab-panels>
              </template>
            </q-splitter>
          </q-card>
        </q-expansion-item>
        <q-expansion-item expand-separator icon="unfold_more" label='Account Operations'>
          <q-card>
            {{ upvoteValue }}
            {{ accountState }}
          </q-card>
        </q-expansion-item>
        <q-expansion-item expand-separator icon="unfold_more" label='Posts'>
          <q-card>
          </q-card>
        </q-expansion-item>
        <q-expansion-item expand-separator icon="unfold_more" label='Coming Rewards'>
          <q-card>
          </q-card>
        </q-expansion-item>
        <q-expansion-item expand-separator icon="unfold_more" label='Tools'>
          <q-card>
          </q-card>
        </q-expansion-item>
      </q-card>
    </div>
  </q-page>
</template>

<script>
import hive from 'steem'
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
export default {
  name: 'Home',
  data () {
    return {
      username: '',
      rpcListHive: ['https://anyx.io', 'https://api.openhive.network', 'https://api.hive.blog'],
      globalPropsHive: null,
      accountState: null,
      card1Tab: 'stats',
      card1Split: 20,
      followCounts: null,
      feedPrice: null,
      rewardFundPost: null
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
    card1Settings: card1Settings
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
      return this.username + ' (' + this.rep + ') | Feed | Wallet'
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    },
    rep: function () {
      return hive.formatter.reputation(this.A.reputation)
    },
    upvoteValue: function () {
      if (this.A !== null && this.rewardFundPost !== null && this.feedPrice !== null) {
        var weight = 100
        var totalVests = parseInt(this.A.vesting_shares.split(' ')[0]) + parseInt(this.A.received_vesting_shares.split(' ')[0]) - parseInt(this.A.delegated_vesting_shares.split(' ')[0])
        var finalVest = totalVests * 1e6
        var power = (this.A.voting_power * weight / 10000) / 50
        var rshares = power * finalVest / 1000
        var estimate = rshares / parseInt(this.rewardFundPost.recent_claims) * parseInt(this.rewardFundPost.reward_balance.split(' ')[0]) * this.feedPrice
        console.log(estimate)
        return estimate
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
        if (result.length === 0) { this.$q.notify({ color: 'negative', position: 'top', message: 'Invalid hive username :' + username, icon: 'report_problem' }) }
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
      hive.api.getFollowCount(username, function (err, result) {
        if (err) { console.log(err) }
        this.followCounts = result
      }.bind(this))
    },
    async getFeedPrice () {
      hive.api.getCurrentMedianHistoryPrice(function (err, result) {
        if (err) { console.log(err) }
        var b = result.base.split(' ')[0]
        var q = result.quote.split(' ')[0]
        this.feedPrice = b / q
      }.bind(this))
    },
    async getRewardFundPost () {
      hive.api.getRewardFund('post', function (err, result) {
        if (err) { console.log(err) }
        this.rewardFundPost = result
      }.bind(this))
    }
  },
  mounted () {
    this.getGlobalPropsHive()
    // TODO Get username from url , otherwise pop dialog to ask user
    if (this.$router.currentRoute.params.username) {
      this.username = this.$router.currentRoute.params.username
    }
    this.checkUsername(this.username)
    this.getFollowCount(this.username)
    this.getFeedPrice()
    this.getRewardFundPost()
  }
}
</script>
