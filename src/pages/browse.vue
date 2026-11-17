<template>
    <q-page>
        <h1 v-if="username === undefined || $route.path.startsWith('/c/')" class="sr-only">Browse Hive posts</h1>
        <community-header v-if="$route.path.startsWith('/c/') && account !== undefined" :globalProps="globalProps" :account="account" />
        <account-header v-else-if="username !== undefined" :globalProps="globalProps" :account="account" :showBalances="false" />
        <!-- <browse-container v-if="$route.path.startsWith('/trending')" callMethod="bridge.get_ranked_posts" sortMethod="trending" :showTag="$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="$route.path.startsWith('/created')" callMethod="bridge.get_ranked_posts" sortMethod="created" :showTag="$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="$route.path.startsWith('/hot')" callMethod="bridge.get_ranked_posts" sortMethod="hot" :showTag="$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="$route.path.startsWith('/promoted')" callMethod="bridge.get_ranked_posts" sortMethod="promoted" :showTag="$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="$route.path.startsWith('/payout')" callMethod="bridge.get_ranked_posts" sortMethod="payout" :showTag="$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="$route.path.startsWith('/payout_comments')" callMethod="bridge.get_ranked_posts" sortMethod="payout_comments" :showTag="$route.params.tag" :showToolbar="true"/>
        <browse-container v-else-if="$route.path.startsWith('/muted')" callMethod="bridge.get_ranked_posts" sortMethod="muted" :showTag="$route.params.tag" :showToolbar="true"/> -->
        <browse-container v-if="username !== undefined && $route.path.endsWith('/posts')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="posts" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && $route.path.endsWith('/blog')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="blog" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && $route.path.endsWith('/feed')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="feed" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && $route.path.endsWith('/replies')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="replies" :showToolbar="false"/>
        <browse-container v-else-if="username !== undefined && $route.path.endsWith('/comments')" :showAccount="username" callMethod="bridge.get_account_posts" sortMethod="comments" :showToolbar="false"/>
        <browse-container v-else-if="$route.path.startsWith('/c/') && ['hot','created', 'trending', 'promoted', 'payout', 'payout_comments'].includes($route.params.sortMethod)" callMethod="bridge.get_ranked_posts" :sortMethod="$route.params.sortMethod" :showTag="$route.params.username" :showToolbar="false"/>
        <browse-container v-else-if="$route.path.startsWith('/c/')" callMethod="bridge.get_ranked_posts" sortMethod="trending" :showTag="$route.params.username" :showToolbar="false"/>
        <browse-container v-else callMethod="bridge.get_ranked_posts" :sortMethod="$route.params.sortMethod || defaultSort || 'created'" :showTag="$route.params.tag" :showToolbar="true"/>
    </q-page>
</template>
<script>
import browseContainer from 'components/browseContainer.vue'
import accountHeader from 'components/accountHeader.vue'
import communityHeader from 'components/communityHeader.vue'
import { setPageMeta } from 'src/utils/pageMeta'
export default {
  name: 'browsePage',
  props: {
    defaultSort: { type: String, default: null }
  },
  components: {
    browseContainer,
    accountHeader,
    communityHeader
  },
  computed: {
    globalProps: {
      get () { return this.$hiveStore.globalProps }
    },
    account: {
      get () {
        return this.$hiveStore.accounts[this.username]
      }
    }
  },
  data () {
    return {
      username: this.$route.params.username || this.$route.params.account
    }
  },
  watch: {
    $route () {
      this.updatePageMeta()
    }
  },
  methods: {
    updatePageMeta () {
      const sortLabels = {
        trending: 'Trending',
        created: 'New',
        hot: 'Hot',
        promoted: 'Promoted',
        payout: 'Top payout',
        payout_comments: 'Top payout comments',
        muted: 'Muted',
        posts: 'Posts',
        blog: 'Blog',
        feed: 'Feed',
        replies: 'Replies',
        comments: 'Comments'
      }
      const account = this.$route.params.account
      const community = this.$route.path.startsWith('/c/') ? this.$route.params.username : null
      const tag = this.$route.params.tag
      const sort = this.$route.params.sortMethod || this.defaultSort || 'created'

      let title
      let description

      if (account) {
        const section = this.$route.path.split('/').filter(Boolean).pop()
        const label = (sortLabels[section] || 'Posts').toLowerCase()
        title = '@' + account + "'s Hive " + label
        description = 'Browse @' + account + "'s " + label + ' on the Hive blockchain at hive.ausbit.dev.'
      } else if (community) {
        title = community + ' — Hive community'
        description = 'Browse posts in the ' + community + ' Hive community at hive.ausbit.dev.'
      } else {
        const label = sortLabels[sort] || (sort.charAt(0).toUpperCase() + sort.slice(1))
        const tagLabel = tag ? (tag.startsWith('hive-') ? tag : '#' + tag) : null
        title = tagLabel ? label + ' Hive posts in ' + tagLabel : label + ' Hive posts'
        description = tagLabel
          ? 'Browse ' + label.toLowerCase() + ' Hive posts tagged ' + tagLabel + ' on hive.ausbit.dev.'
          : 'Browse ' + label.toLowerCase() + ' posts on the Hive blockchain: trending, new, hot and community content.'
      }

      setPageMeta({ title, description, url: this.$route.path })
    }
  },
  mounted () {
    // if (this.$route.path.startsWith('/c/') && this.$route.path.endsWith('/')) { this.$router.push({ params: { sortMethod: 'created' } }) }
    if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
    if (this.account === undefined) {
      this.$hiveStore.getAccount(this.username)
    }
    this.updatePageMeta()
  }
}
</script>
