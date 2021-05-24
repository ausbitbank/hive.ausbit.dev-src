<template>
    <q-page>
        <community-header v-if="this.$route.path.startsWith('/c/') && this.account !== undefined" :globalProps="this.globalProps" :account="this.account" />
        <account-header v-else-if="username !== undefined" :globalProps="this.globalProps" :account="this.account" :showBalances="false" />
        <browse-container v-if="this.$route.params.token" callMethod="tribes" :tribeToken="this.$route.params.token" :sortMethod="this.$route.params.sortMethod" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <q-card class="q-ma-md q-pa-md" v-else-if="!this.$route.params.token">
          Browse tribe posts :
          <q-list separator bordered>
            <q-item v-for="tribe in tribes" :key="tribe.index"><router-link :to="returnTribePath(tribe[0])">{{ tribe[1] }} ({{ tribe[0] }})</router-link></q-item>
          </q-list>
        </q-card>
    </q-page>
</template>
<script>
import browseContainer from 'components/browseContainer.vue'
import accountHeader from 'components/accountHeader.vue'
import communityHeader from 'components/communityHeader.vue'
export default {
  name: 'tribesPage',
  components: {
    browseContainer,
    accountHeader,
    communityHeader
  },
  computed: {
    globalProps: {
      get () { return this.$store.state.hive.globalProps }
    },
    account: {
      get () {
        return this.$store.state.hive.accounts[this.username]
      }
    }
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account,
      tribes: [
        ['LEO', 'LeoFinance.io'],
        ['PAL', 'PALnet.io'],
        ['LOTUS', 'NaturalMedicine.io'],
        ['CCC', 'Creativecoin.io'],
        ['SPT', 'SplinterTalk.io'],
        ['WEED', 'WeedCash.io'],
        ['JAHM', 'ReggaeJahm.com'],
        ['NEOXAG', 'Neoxian.city'],
        ['ARCHON', 'ArchonApp.net'],
        ['ASH', 'Aeneas.blog'],
        ['BATTLE', 'social.battlegamesnfts.com'],
        ['BLOG', 'blogtoken.io'],
        ['BLQ', 'blog.bloque64.com'],
        ['BPC', 'blipcoin.com'],
        ['BUILD', 'build-it.io'],
        ['CHARY', 'chary.org'],
        ['CTP', 'ctptalk.com'],
        ['FOODIE', 'foodiesunite.net'],
        ['KANDA', 'nitrous.telokanda.com'],
        ['LASSECASH', 'lassecash.com'],
        ['LIST', 'hivelist.org'],
        ['PESOS', 'onlinebuzz.com'],
        ['PORN', 'dporn.co'],
        ['SAND', 'steemsandiego.com'],
        ['SPORTS', 'sportstalksocial.com'],
        ['STEM', 'stemgeeks.net'],
        ['TIX', 'trafficinsider.org']
      ]
    }
  },
  methods: {
    returnTribePath (tribe) {
      return '/tribes/' + tribe
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.account === undefined) {
      this.$store.dispatch('hive/getAccount', this.username)
    }
  }
}
</script>
