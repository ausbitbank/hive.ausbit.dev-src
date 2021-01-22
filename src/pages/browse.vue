<template>
    <q-page>
        <account-header v-if="username !== undefined" :globalProps="this.globalProps" :account="this.account" :showBalances="true" />
        <browse-container v-if="this.$route.path.startsWith('/trending')" callMethod="bridge.get_ranked_posts" sortMethod="trending" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/created')" callMethod="bridge.get_ranked_posts" sortMethod="created" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/hot')" callMethod="bridge.get_ranked_posts" sortMethod="hot" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/promoted')" callMethod="bridge.get_ranked_posts" sortMethod="promoted" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/payout')" callMethod="bridge.get_ranked_posts" sortMethod="payout" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/payout_comments')" callMethod="bridge.get_ranked_posts" sortMethod="payout_comments" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/muted')" callMethod="bridge.get_ranked_posts" sortMethod="muted" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/posts')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="posts" :showToolbar="true"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/blog')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="blog" :showToolbar="true"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/feed')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="feed" :showToolbar="true"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/replies')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="replies" :showToolbar="true"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/comments')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="comments" :showToolbar="true"/>
        <browse-container v-else callMethod="bridge.get_ranked_posts" sortMethod="created" :showToolbar="true"/>
    </q-page>
</template>
<script>
import browseContainer from 'components/browseContainer.vue'
import accountHeader from 'components/accountHeader.vue'
export default {
  name: 'browsePage',
  components: {
    browseContainer,
    accountHeader
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
      username: this.$route.params.account
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    console.log(this.account)
    if (this.account === undefined) {
      console.log('getting account')
      this.$store.dispatch('hive/getAccount', this.username)
    }
  }
}
</script>
