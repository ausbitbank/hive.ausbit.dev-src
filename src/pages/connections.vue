<template>
  <q-page>
    <account-header v-if="username !== undefined && this.account !== undefined" :globalProps="this.globalProps" :account="this.account" :showBalances="false" />
    <q-tabs v-model="tab" dense>
      <q-route-tab name="following" :to="linkFollowing">Following <q-badge color="primary" v-if="followCount !== undefined">{{ tidyNumber(followCount.following_count) }}</q-badge></q-route-tab>
      <q-route-tab name="followers" :to="linkFollowers">Followers <q-badge color="primary" v-if="followCount !== undefined">{{ tidyNumber(followCount.follower_count) }}</q-badge></q-route-tab>
    </q-tabs>
    <q-tab-panels v-model="tab" animated style="margin:auto; max-width: 1000px">
      <q-tab-panel name="following">
        <div class="text-h5 text-center">
          {{ username }} is following {{ followCount.following_count }} accounts:
        </div>
        <connections type="following" :username="this.username" />
      </q-tab-panel>
      <q-tab-panel name="followers">
        <div class="text-h5 text-center">{{ username }} is followed by {{ followCount.follower_count }} accounts:</div>
        <connections type="followers" :username="this.username" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>
<script>
export default {
  name: 'followers',
  components: {
    accountHeader: () => import('components/accountHeader.vue'),
    connections: () => import('components/connections.vue')
  },
  computed: {
    globalProps: {
      get () { return this.$store.state.hive.globalProps }
    },
    account: {
      get () {
        return this.$store.state.hive.accounts[this.username]
      }
    },
    linkFollowers: { get () { return '/@' + this.username + '/followers' } },
    linkFollowing: { get () { return '/@' + this.username + '/following' } },
    followCount: { get () { return this.$store.state.hive.followCounts[this.username] } }
  },
  methods: {
    tidyNumber (x) { if (x) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } }
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account,
      tab: 'following'
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.account === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
    if (this.followCount === undefined) { this.$store.dispatch('hive/getFollowCount', this.username) }
    // this.$route.path.endsWith('following') ? this.tab = 'following' : this.tab = 'followers'
  }
}
</script>
