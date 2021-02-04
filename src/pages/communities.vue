<template>
    <q-page v-if="this.account !== undefined" class="text-center">
        <account-header :globalProps="this.globalProps" :account="this.account" :showBalances="false" />
        <q-card class="text-center q-ma-lg q-pa-md" padding rounded style="max-width: 400px; margin:auto">
          <community-feed-carousel :account="account.name" />
            <div v-if="this.$store.state.hive.user.username === account.name"><router-link to='/created/my'>View my community feed</router-link></div>
            {{ account.name }} is subscribed to these communities :
          <q-list bordered separator>
            <q-item v-for="community in subscriptions" :key="community.index">
              <q-item-section avatar>
                <q-avatar>
                  <router-link :to="linkCommunity(community[0])"><img :src="getHiveAvatarUrl(community[0])" /></router-link>
                </q-avatar>
              </q-item-section>
              <q-item-section>
              <router-link :to="linkCommunity(community[0])" class="text-white">{{ community[1] }}</router-link>
              <div><q-chip dense color="primary" v-if="community[2] !== ''">{{ community[2] }}</q-chip></div>
              {{ community[3] }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
    </q-page>
</template>
<script>
import accountHeader from 'components/accountHeader.vue'
import communityFeedCarousel from 'components/communityPostsCarousel.vue'
export default {
  name: 'browsePage',
  components: {
    accountHeader,
    communityFeedCarousel
  },
  computed: {
    globalProps: { get () { return this.$store.state.hive.globalProps } },
    account: { get () { return this.$store.state.hive.accounts[this.username] } }
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account,
      subscriptions: null
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    linkCommunity (community) { return '/c/' + community + '/trending' },
    getCommunitySubscriptions () {
      var params = { account: this.username }
      this.$hive.api.callAsync('bridge.list_all_subscriptions', params)
        .then(response => {
          this.subscriptions = response
        })
        .catch(() => {
          console.error('Failed to get subscriptions for ' + this.username)
        })
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.account === undefined) {
      this.$store.dispatch('hive/getAccount', this.username)
    }
    if (this.subscriptions === null) {
      this.getCommunitySubscriptions()
    }
  }
}
</script>
