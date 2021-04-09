<template>
  <div>
    <q-toolbar class="bg-dark text-white" v-if="showToolbar">
      <q-select v-model="method" :options="['bridge.get_ranked_posts', 'bridge.get_account_posts']" label="method" />
      <q-input v-model="account" label="account" v-if="method === 'bridge.get_account_posts'"/>
      <q-select v-if="method === 'bridge.get_account_posts'" v-model="sort" :options="['feed', 'blog', 'posts', 'replies', 'comments']" label="Sort Method" />
      <q-select v-if="method === 'bridge.get_ranked_posts'" v-model="sort" :options="['trending', 'hot', 'created', 'promoted', 'payout', 'payout_comments', 'muted']" label="Sort Method" />
      <q-input v-model="tag" label="tag" v-if="method === 'bridge.get_ranked_posts'" clearable @clear="tag = ''"/>
      <q-input v-model.number="limit" label="limit" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" />
      <q-input v-model="observer" label="observer" clearable @clear="observer = ''" />
      <q-input v-model="start_author" label="start_author" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" />
      <q-input v-model="start_permlink" label="start_permlink" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" />
      <q-space />
      <q-btn label="Search" @click="getPosts()" />
    </q-toolbar>
    <div class="text-center">
      <q-btn label="filter" flat color="grey" icon="filter">
        <q-popup-proxy>
          <q-list separator bordered dense>
            <q-item>
              <q-item-section>
                <q-checkbox v-model="filter.hideVoted" />
              </q-item-section>
              <q-item-section>
                Hide Voted
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-checkbox v-model="filter.hideReblogs" />
              </q-item-section>
              <q-item-section>
                Hide Reblogs
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-checkbox v-model="filter.hidePinned" />
              </q-item-section>
              <q-item-section>
                Hide Pinned
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-checkbox v-model="filter.hideHidden" />
              </q-item-section>
              <q-item-section>
                Hide Muted
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-checkbox v-model="filter.hideGray" />
              </q-item-section>
              <q-item-section>
                Hide Moderated
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar>
                <q-checkbox v-model="filter.hideRewardsFilter" />
              </q-item-section>
              <q-item-section>
                Hide posts rewards below
              </q-item-section>
              <q-item-section>
                <q-input v-model="filter.hideRewardsBelow" :disable="!filter.hideRewardsFilter" debounce="500" style="max-width: 3em" />
              </q-item-section>
              <q-item-section>
                Hide posts rewards above
              </q-item-section>
              <q-item-section>
                <q-input v-model="filter.hideRewardsAbove" :disable="!filter.hideRewardsFilter" debounce="500" style="max-width: 3em" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-popup-proxy>
      </q-btn>
      <q-btn-toggle v-model="styleType" push glossy toggle-color="primary" :options="[{label: 'Full Posts', value: 'full'}, {label: 'Previews', value: 'preview'}, {label: 'Grid', value: 'grid'}]" />
    </div>
    <div class="row justify-around">
      <div v-for="post in filteredPosts" :key="post.post_id">
        <post-preview :post="post" :styleType="styleType" />
      </div>
    </div>
    <div v-if="posts.length > 0" class="text-center">
      <q-btn color="primary" icon="search" label="Load more" @click="start_author = posts[posts.length - 1].author; start_permlink = posts[posts.length - 1].permlink; getPosts()" />
    </div>
  </div>
</template>
<style>
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
      styleType: 'preview',
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
      tag: this.showTag,
      filteredPosts: [],
      filter: {
        hideVoted: false,
        hideReblogs: false,
        hidePinned: false,
        hideHidden: true,
        hideGray: true,
        hideRewardsFilter: false,
        hideRewardsAbove: 10000,
        hideRewardsBelow: 0
      }
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
    },
    posts: {
      deep: true,
      immediate: false,
      handler: 'filterPosts'
    },
    filter: {
      deep: true,
      immediate: false,
      handler: 'filterPosts'
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
    },
    filterPosts () {
      var fp = this.posts
      this.filteredPosts = []
      if (this.filter.hideReblogs) { fp = fp.filter(post => !post.reblogged_by) }
      if (this.filter.hideVoted) { fp = fp.filter(post => post.active_votes.filter(v => v.voter === this.loggedInUser).length === 0) }
      if (this.filter.hidePinned) { fp = fp.filter(post => !post.stats.is_pinned) }
      if (this.filter.hideHidden) { fp = fp.filter(post => !post.stats.hidden) }
      if (this.filter.hideGray) { fp = fp.filter(post => !post.stats.gray) }
      if (this.filter.hideRewardsFilter) {
        if (this.filter.hideRewardsBelow !== null) { fp = fp.filter(post => (parseFloat(post.pending_payout_value.split(' ')[0]) > this.filter.hideRewardsBelow) || (parseFloat(post.payout) > this.filter.hideRewardsBelow)) }
        if (this.filter.hideRewardsAbove !== null) { fp = fp.filter(post => (parseFloat(post.pending_payout_value.split(' ')[0]) < this.filter.hideRewardsAbove) || (parseFloat(post.payout) < this.filter.hideRewardsAbove)) }
      }
      this.filteredPosts = fp
    }
  },
  mounted () {
    this.getPosts()
    document.title = 'Browsing ' + this.sortMethod
    if (this.tag) { document.title = document.title + ' / ' + this.tag }
  }
}
</script>
