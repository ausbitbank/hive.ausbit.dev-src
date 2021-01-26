<template>
    <q-page>
        <community-header v-if="this.$route.path.startsWith('/c/') && username !== undefined" :globalProps="this.globalProps" :account="this.account" />
        <account-header v-else-if="username !== undefined" :globalProps="this.globalProps" :account="this.account" :showBalances="false" />
        <!-- <browse-container v-if="this.$route.path.startsWith('/trending')" callMethod="bridge.get_ranked_posts" sortMethod="trending" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/created')" callMethod="bridge.get_ranked_posts" sortMethod="created" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/hot')" callMethod="bridge.get_ranked_posts" sortMethod="hot" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/promoted')" callMethod="bridge.get_ranked_posts" sortMethod="promoted" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/payout')" callMethod="bridge.get_ranked_posts" sortMethod="payout" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/payout_comments')" callMethod="bridge.get_ranked_posts" sortMethod="payout_comments" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="this.$route.path.startsWith('/muted')" callMethod="bridge.get_ranked_posts" sortMethod="muted" :showTag="this.$route.params.tag" :showToolbar="true"/> -->
        <browse-container v-if="username !== undefined && this.$route.path.endsWith('/posts')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="posts" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/blog')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="blog" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/feed')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="feed" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/replies')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="replies" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && this.$route.path.endsWith('/comments')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="comments" :showToolbar="false"/>
        <browse-container v-else-if="this.$route.path.startsWith('/c/') && ['hot','created', 'trending', 'promoted', 'payout', 'payout_comments'].includes(this.$route.params.sortMethod)" callMethod="bridge.get_ranked_posts" :sortMethod="this.$route.params.sortMethod" :showTag="this.$route.params.username" :showToolbar="false"/>
        <browse-container v-else-if="this.$route.path.startsWith('/c/')" callMethod="bridge.get_ranked_posts" sortMethod="trending" :showTag="this.$route.params.username" :showToolbar="false"/>
        <browse-container v-else-if="this.$route.params.sortMethod" callMethod="bridge.get_ranked_posts" :sortMethod="this.$route.params.sortMethod" :showTag="this.$route.params.tag" :showToolbar="true"/>
        <browse-container v-else callMethod="bridge.get_ranked_posts" sortMethod="created" :showToolbar="true"/>
    </q-page>
</template>
<script>
import browseContainer from 'components/browseContainer.vue'
import accountHeader from 'components/accountHeader.vue'
import communityHeader from 'components/communityHeader.vue'
export default {
  name: 'browsePage',
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
      username: this.$route.params.username || this.$route.params.account
    }
  },
  mounted () {
    // if (this.$route.path.startsWith('/c/') && this.$route.path.endsWith('/')) { this.$router.push({ params: { sortMethod: 'created' } }) }
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.account === undefined) {
      this.$store.dispatch('hive/getAccount', this.username)
    }
  }
}
</script>
