<template>
  <q-page>
    <account-header v-if="username !== undefined && account !== undefined" :globalProps="globalProps" :account="account" :showBalances="false" />
    <q-tabs v-model="tab" dense>
      <q-route-tab name="following" :to="linkFollowing">Following <q-badge color="primary" v-if="followCount">{{ tidyNumber(followCount.following_count) }}</q-badge></q-route-tab>
      <q-route-tab name="followers" :to="linkFollowers">Followers <q-badge color="primary" v-if="followCount">{{ tidyNumber(followCount.follower_count) }}</q-badge></q-route-tab>
    </q-tabs>
    <q-tab-panels v-model="tab" animated style="margin:auto; max-width: 1000px">
      <q-tab-panel name="following">
        <div class="text-h5 text-center">
          {{ username }} is following {{ formattedCount(followCount?.following_count) }} accounts:
        </div>
        <connections type="following" :username="username" />
      </q-tab-panel>
      <q-tab-panel name="followers">
        <div class="text-h5 text-center">{{ username }} is followed by {{ formattedCount(followCount?.follower_count) }} accounts:</div>
        <connections type="followers" :username="username" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>
<script>
import { defineAsyncComponent } from 'vue'
import { setPageMeta } from 'src/utils/pageMeta'
export default {
  name: 'followers',
  components: {
    accountHeader: defineAsyncComponent(() => import('components/accountHeader.vue')),
    connections: defineAsyncComponent(() => import('components/connections.vue'))
  },
  computed: {
    globalProps: {
      get () { return this.$hiveStore.globalProps }
    },
    account: {
      get () {
        return this.$hiveStore.accounts[this.username]
      }
    },
    linkFollowers: { get () { return '/@' + this.username + '/followers' } },
    linkFollowing: { get () { return '/@' + this.username + '/following' } },
    followCount: { get () { return this.$hiveStore.followCounts[this.username] || null } }
  },
  methods: {
    tidyNumber (x) { if (x) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } },
    formattedCount (x) {
      if (x === null || x === undefined) return '…'
      return x === 0 ? '0' : (this.tidyNumber(x) ?? String(x))
    },
    applyPageMeta () {
      const kind = this.tab === 'followers' ? 'followers' : 'following'
      setPageMeta({
        title: '@' + this.username + "'s " + kind + ' — hive.ausbit.dev',
        description: 'Accounts ' + (kind === 'followers' ? 'following' : 'followed by') + ' @' + this.username + ' on the Hive blockchain.',
        url: '/@' + this.username + '/' + kind
      })
    },
    load () {
      if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
      if (this.account === undefined) { this.$hiveStore.getAccount(this.username) }
      if (this.followCount === null) { this.$hiveStore.getFollowCount(this.username) }
    },
    syncRoute () {
      this.username = this.$route.params.username || this.$route.params.account
      this.tab = this.$route.path.endsWith('/followers') ? 'followers' : 'following'
      this.applyPageMeta()
      this.load()
    }
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account,
      tab: this.$route.path.endsWith('/followers') ? 'followers' : 'following'
    }
  },
  watch: {
    '$route.path' () { this.syncRoute() }
  },
  mounted () {
    this.load()
    this.applyPageMeta()
  }
}
</script>
