<template>
  <div>
    <q-toolbar class="bg-dark text-white" v-if="showToolbar">
      <q-select v-model="method" :options="['bridge.get_ranked_posts', 'bridge.get_account_posts', 'bridge.get_community']" label="method" />
      <q-input v-model="account" label="account" v-if="method === 'bridge.get_account_posts'"/>
      <q-select v-if="method === 'bridge.get_account_posts'" v-model="sort" :options="['feed', 'blog', 'posts', 'replies', 'comments']" label="Sort Method" />
      <q-select v-if="method === 'bridge.get_ranked_posts'" v-model="sort" :options="['trending', 'hot', 'created', 'promoted', 'payout', 'payout_comments', 'muted']" label="Sort Method" />
      <q-input v-model="tag" label="tag" v-if="method === 'bridge.get_ranked_posts'" clearable @clear="tag = ''"/>
      <q-input v-model.number="limit" label="limit" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" />
      <q-input v-model="observer" label="observer" clearable @clear="observer = ''" />
      <q-input v-model="start_author" label="start_author" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" />
      <q-input v-model="start_permlink" label="start_permlink" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" />
      <q-input v-model="name" label="name" v-if="method === 'bridge.get_community'" />
      <q-space />
      <q-btn label="Search" @click="getPosts()" />
    </q-toolbar>
    <post-preview v-for="post in posts" :key="post.index" :post="post" />
    <div v-if="posts.length > 0" class="text-center">
      <q-btn color="primary" icon="search" label="Load more" @click="start_author = posts[posts.length - 1].author; start_permlink = posts[posts.length - 1].permlink; getPosts()" />
    </div>
  </div>
</template>
<style lang="sass" scoped>
</style>
<script>
import postPreview from 'components/postPreview.vue'
export default {
  name: 'browseContainer',
  props: {
    callMethod: String,
    responseLimit: Number,
    sortMethod: String,
    Pstart_author: String,
    Pstart_permlink: String,
    Ppage: Number,
    showToolbar: Boolean,
    showTag: String,
    showAccount: String
  },
  components: { postPreview },
  data () {
    return {
      loading: false,
      posts: [],
      method: this.callMethod || 'bridge.get_ranked_posts',
      observer: this.$store.state.hive.user.username,
      limit: this.responseLimit || 42,
      sort: this.sortMethod,
      start_author: this.Pstart_author,
      start_permlink: this.Pstart_permlink,
      page: this.Ppage,
      account: this.showAccount,
      name: null,
      tag: this.showTag
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  },
  watch: {
    sortMethod: function (newData, oldData) {
      console.log('sortmethod changed')
      this.sort = newData
      this.getPosts()
    }
  },
  methods: {
    async getPosts () {
      this.loading = true
      this.posts = []
      var params = { observer: this.observer, limit: this.limit, sort: this.sort, start_author: this.start_author, start_permlink: this.start_permlink }
      if (this.method === 'bridge.get_account_posts') { params.account = this.account }
      if (this.method === 'bridge.get_ranked_posts') { params.tag = this.tag }
      if (this.method === 'bridge.get_community') { params.name = this.name }
      this.$hive.api.callAsync(this.method, params)
        .then(response => {
          if (['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(this.method)) {
            this.posts = response
          }
          if (['bridge.get_community'].includes(this.method)) {
            console.log(response)
          }
          this.loading = false
        })
    }
  },
  mounted () {
    this.getPosts()
  }
}
</script>
