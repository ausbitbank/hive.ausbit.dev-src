<template>
  <div>
    <transition appear enter-active-class="animated fadeInDown" leave-active-class="animated fadeOutUp">
    <q-toolbar class="bg-dark text-white text-center" v-if="showToolbar">
      <q-space />
      <q-select v-model="method" :options="['bridge.get_ranked_posts', 'bridge.get_account_posts', 'tribes']" label="method" />
      <q-input v-model="account" label="account" v-if="method === 'bridge.get_account_posts'"/>
      <q-input v-model="token" label="token" v-if="method === 'tribes' " />
      <q-select v-if="method === 'bridge.get_account_posts'" v-model="sort" :options="['feed', 'blog', 'posts', 'replies', 'comments']" label="Sort Method" />
      <q-select v-if="method === 'bridge.get_ranked_posts'" v-model="sort" :options="['trending', 'hot', 'created', 'promoted', 'payout', 'payout_comments', 'muted']" label="Sort Method" />
      <q-select v-if="method === 'tribes'" v-model="sort" :options="['trending', 'hot', 'created', 'promoted']" label="Sort Method" />
      <q-input v-model="tag" label="tag" v-if="['bridge.get_ranked_posts', 'tribes'].includes(method)" clearable @clear="tag = ''"/>
      <q-input v-model.number="limit" label="limit" />
      <q-input v-if="method !== 'tribes'" v-model="observer" label="observer" clearable @clear="observer = ''" />
      <q-input v-model="start_author" label="start_author" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts', 'tribes'].includes(method)" clearable @clear="start_author = ''" />
      <q-input v-model="start_permlink" label="start_permlink" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts', 'tribes'].includes(method)" clearable @clear="start_author = ''" />
      <q-btn flat v-if="method === 'tribes'" color="primary" label="Browse Tribe" @click="getTribePosts()" />
      <q-btn flat v-else color="primary" icon="search" label="Browse" @click="getPosts()" />
      <q-space />
    </q-toolbar>
    </transition>
    <div class="text-center">
      <q-btn flat color="grey" @click="showToolbar = !showToolbar" icon="settings" title="Toggle full navigation toolbar" />
      <q-btn flat color="grey" title="Filter posts" icon="filter">
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
            <q-item v-if="false">
              <q-item-section>
                <q-checkbox v-model="filter.hideCrossPost" />
              </q-item-section>
              <q-item-section>
                Hide Cross-Post
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
      <q-btn-toggle v-model="styleType" push glossy toggle-color="primary" :options="[{label: 'Full', value: 'full'}, {label: 'Preview', value: 'preview'}, {label: 'Media', value: 'media'}]" />
    </div>
    <div class="masonry-wrapper">
      <q-spinner-puff color="primary" v-if="loading" size="lg" class="q-ma-md text-center" style="margin:auto" />
      <div class="masonry justify-center">
        <div v-for="post in filteredPosts" :key="post.post_id" class="masonry-item">
          <post-preview :post="post" :styleType="styleType" />
        </div>
        <div v-if="!loading" class="q-ma-md">
          <h5>
            <div v-if="error"><q-icon name="error_outline" color="orange" />&nbsp; {{ error }}</div>
            <q-icon name="info" color="light-blue" />&nbsp; {{ posts.length }} posts filtered
          </h5>
        </div>
      </div>
    </div>
    <div v-if="posts.length > 0" class="text-center">
      <q-btn outline rounded color="primary" icon="search" label="Load more" @click="start_author = posts[posts.length - 1].author; start_permlink = posts[posts.length - 1].permlink; getTribePosts()" v-if="this.method === 'tribes'" />
      <q-btn outline rounded color="primary" icon="search" label="Load more" @click="start_author = posts[posts.length - 1].author; start_permlink = posts[posts.length - 1].permlink; getPosts()" v-else />
    </div>
  </div>
</template>
<style>
/* Live, working masonry layout ordered top to bottom, THEN left to right
  TODO: Find / Design a version that works left to right, THEN top to bottom */
.masonry-wrapper {
  padding: 1.5em;
  margin-right: auto;
  margin-left: auto;
}
.masonry {
  columns: 1;
  column-gap: 15px;
}
.masonry-item {
  display: inline-block;
  vertical-align: top;
  margin-bottom: 10px;
}
.masonry-item, .masonry-content {
  border-radius: 4px;
  overflow: visible;
}
@media only screen and (max-width: 1365px) and (min-width: 1024px) {
  .masonry {
    columns: 2;
  }
}
@media only screen and (min-width: 1366px) {
  .masonry {
    columns: 3;
  }
}
@media only screen and (min-width: 1920px) {
  .masonry {
    columns: 4;
  }
}
@media only screen and (min-width: 3600px) {
  .masonry {
    columns: 5;
  }
}
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
    tribeToken: {
      type: String,
      required: false
    },
    showToolbar: Boolean,
    showTag: String,
    showAccount: String
  },
  components: { postPreview },
  data () {
    return {
      loading: false,
      styleType: this.$route.query.style || 'preview',
      posts: [],
      method: this.callMethod || 'bridge.get_ranked_posts',
      observer: this.$route.query.observer || this.$store.state.hive.user.username,
      limit: this.$route.query.limit || this.responseLimit || 20,
      sort: this.$route.query.sort || this.sortMethod,
      start_author: this.$route.query.start_author || this.Pstart_author,
      start_permlink: this.$route.query.start_permlink || this.Pstart_permlink,
      page: this.Ppage,
      account: this.showAccount,
      name: null,
      tag: this.$route.query.tag || this.showTag,
      token: this.tribeToken || null,
      filteredPosts: [],
      error: null,
      filter: {
        hideVoted: false,
        hideReblogs: false,
        hidePinned: false,
        hideCrossPost: false,
        hideHidden: true,
        hideGray: true,
        hideRewardsFilter: false,
        hideRewardsAbove: 50,
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
      if (this.method === 'tribes') { this.getTribePosts() } else { this.getPosts() }
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
    get () {
      if (this.method === 'tribes') {
        this.getTribePosts()
      } else {
        this.getPosts()
      }
    },
    async getPosts () {
      this.loading = true
      this.posts = []
      this.error = null
      var params = { observer: this.observer, limit: this.limit, sort: this.sort, start_author: this.start_author, start_permlink: this.start_permlink }
      if (this.method === 'bridge.get_account_posts') { params.account = this.account }
      if (this.method === 'bridge.get_ranked_posts') { params.tag = this.tag }
      if (this.method === 'bridge.get_community') { params.name = this.name }
      this.$hive.api.callAsync(this.method, params)
        .then(response => {
          if (['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(this.method)) {
            this.posts = response
          }
          this.loading = false
        })
        .error(err => {
          this.loading = false
          this.error = err.cause.data
        })
    },
    async getTribePosts () {
      this.posts = []
      this.loading = true
      if (!this.sort) { this.sort = 'trending' }
      var api = 'https://scot-api.hive-engine.com/get_discussions_by_' + this.sort + '?token=' + this.token.toUpperCase() + '&limit=' + this.limit
      if (this.tag !== undefined && this.tag !== '') { api = api + '&tag=' + this.tag }
      if (this.start_author && this.start_permlink) { api = api + '&start_author=' + this.start_author + '&start_permlink=' + this.start_permlink }
      this.$axios.get(api)
        .then((res) => {
          this.posts = res.data
          this.loading = false
        })
    },
    filterPosts () {
      var fp = this.posts
      this.filteredPosts = []
      if (this.filter.hideReblogs) { fp = fp.filter(post => !post.reblogged_by) }
      if (this.filter.hideVoted) { fp = fp.filter(post => post.active_votes.filter(v => v.voter === this.loggedInUser).length === 0) }
      // if (this.filter.hideCrossPost) { fp = fp.filter(post => post.json_metadata.includes('"tags":["cross-post"]')) }
      if (this.method !== 'tribes') {
        if (this.filter.hidePinned) { fp = fp.filter(post => !post.stats.is_pinned) }
        if (this.filter.hideHidden) { fp = fp.filter(post => !post.stats.hidden) }
        if (this.filter.hideGray) { fp = fp.filter(post => !post.stats.gray) }
      }
      if (this.filter.hideRewardsFilter) {
        if (this.filter.hideRewardsBelow !== null) { fp = fp.filter(post => (parseFloat(post.pending_payout_value.split(' ')[0]) > this.filter.hideRewardsBelow) || (parseFloat(post.payout) > this.filter.hideRewardsBelow)) }
        if (this.filter.hideRewardsAbove !== null) { fp = fp.filter(post => (parseFloat(post.pending_payout_value.split(' ')[0]) < this.filter.hideRewardsAbove) || (parseFloat(post.payout) < this.filter.hideRewardsAbove)) }
      }
      this.filteredPosts = fp
    }
  },
  mounted () {
    if (this.method === 'tribes') { this.getTribePosts() } else { this.getPosts() }
    document.title = 'Browsing ' + this.sortMethod
    if (this.tag) { document.title = document.title + ' / ' + this.tag }
  }
}
</script>
