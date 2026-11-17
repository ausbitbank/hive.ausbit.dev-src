<template>
  <div>
    <transition appear enter-active-class="animated fadeInDown" leave-active-class="animated fadeOutUp">
    <q-toolbar class="bg-dark text-white text-center gt-xs" v-if="toolbarOpen">
      <q-space />
      <q-select dense v-model="method" :options="['bridge.get_ranked_posts', 'bridge.get_account_posts']" label="method" />
      <q-input dense maxlength="25" v-model="account" label="account" v-if="method === 'bridge.get_account_posts'"/>
      <q-select dense v-if="method === 'bridge.get_account_posts'" v-model="sort" :options="['feed', 'blog', 'posts', 'replies', 'comments']" label="Sort Method" />
      <q-select dense v-if="method === 'bridge.get_ranked_posts'" v-model="sort" :options="['trending', 'hot', 'created', 'promoted', 'payout', 'payout_comments', 'muted']" label="Sort Method" />
      <q-input dense v-model="tag" label="tag" v-if="method === 'bridge.get_ranked_posts'" clearable @clear="tag = ''" style="max-width: 150px"/>
      <q-input dense maxlength="3" v-model.number="limit" label="limit" style="max-width: 50px" />
      <q-input dense v-model="observer" label="observer" clearable @clear="observer = ''" style="max-width: 150px" />
      <q-input dense v-model="start_author" label="start_author" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" style="max-width: 100px" />
      <q-input dense v-model="start_permlink" label="start_permlink" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" style="max-width: 100px" />
      <q-btn flat dense color="primary" icon="search" label="Browse" @click="getPosts()" />
      <q-space />
    </q-toolbar>
    </transition>
    <div class="lt-sm row items-center justify-center q-gutter-sm q-py-sm">
      <q-btn outline color="primary" icon="filter_alt" label="Filters" aria-label="Open advanced browse filters" @click="filtersDialog = true" />
      <q-btn outline color="primary" icon="search" label="Browse" aria-label="Browse posts with the current filters" @click="getPosts()" />
    </div>
    <q-dialog v-model="filtersDialog">
      <q-card class="q-pa-md" style="width: 100%; max-width: 460px">
        <div class="text-h6 text-center q-mb-md">Browse filters</div>
        <q-select dense v-model="method" :options="['bridge.get_ranked_posts', 'bridge.get_account_posts']" label="method" class="q-mb-sm" />
        <q-input dense maxlength="25" v-model="account" label="account" v-if="method === 'bridge.get_account_posts'" class="q-mb-sm" />
        <q-select dense v-if="method === 'bridge.get_account_posts'" v-model="sort" :options="['feed', 'blog', 'posts', 'replies', 'comments']" label="Sort Method" class="q-mb-sm" />
        <q-select dense v-if="method === 'bridge.get_ranked_posts'" v-model="sort" :options="['trending', 'hot', 'created', 'promoted', 'payout', 'payout_comments', 'muted']" label="Sort Method" class="q-mb-sm" />
        <q-input dense v-model="tag" label="tag" v-if="method === 'bridge.get_ranked_posts'" clearable @clear="tag = ''" class="q-mb-sm" />
        <q-input dense maxlength="3" v-model.number="limit" label="limit" type="number" class="q-mb-sm" />
        <q-input dense v-model="observer" label="observer" clearable @clear="observer = ''" class="q-mb-sm" />
        <q-input dense v-model="start_author" label="start_author" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_author = ''" class="q-mb-sm" />
        <q-input dense v-model="start_permlink" label="start_permlink" v-if="['bridge.get_account_posts', 'bridge.get_ranked_posts'].includes(method)" clearable @clear="start_permlink = ''" class="q-mb-sm" />
        <div class="text-center q-mt-md">
          <q-btn flat label="Close" color="grey" v-close-popup />
          <q-btn color="primary" label="Browse" icon="search" @click="filtersDialog = false; getPosts()" />
        </div>
      </q-card>
    </q-dialog>
    <div class="text-center">
      <q-btn flat color="grey" class="gt-xs" @click="toolbarOpen = !toolbarOpen" icon="settings" title="Toggle full navigation toolbar" aria-label="Toggle full navigation toolbar" />
      <q-btn flat color="grey" title="Filter posts" aria-label="Filter posts" icon="filter_alt">
        <q-badge color="primary" floating transparent v-if="(posts.length - filteredPosts.length) > 0">{{ posts.length - filteredPosts.length }}/{{ posts.length }}</q-badge>
        <q-popup-proxy>
          <q-card flat bordered>
          <div v-if="(posts.length - filteredPosts.length) > 0" class="text-center text-bold">
            {{ posts.length - filteredPosts.length }} / {{ posts.length }} posts filtered with the settings below
          </div>
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
          </q-card>
        </q-popup-proxy>
      </q-btn>
      <q-select class="lt-sm" dense outlined options-dense v-model="styleType" :options="styleOptions" label="View" aria-label="Choose post layout" style="min-width: 130px" />
      <q-btn-toggle class="gt-xs" dense no-caps v-model="styleType" push glossy toggle-color="primary" aria-label="Choose post layout" :options="styleOptions" />
      <q-spinner-puff color="primary" v-if="loading && styleType !== 'table'" size="lg" class="q-ma-md text-center" style="margin:auto" />
    </div>
    <div v-if="!loading && !error && filteredPosts.length === 0" class="text-center q-pa-lg text-grey">
      <q-icon name="search_off" size="2.5em" />
      <div class="text-subtitle1 q-mt-sm">{{ posts.length === 0 ? 'No posts found.' : 'No posts match the current filters.' }}</div>
    </div>
    <div class="masonry-wrapper" v-if="filteredPosts.length > 0 || error">
      <div class="masonry justify-center" v-if="styleType !== 'table'">
        <div v-for="post in filteredPosts" :key="post.post_id" class="masonry-item">
          <post-preview :post="post" :styleType="styleType" />
        </div>
         <div v-if="!loading" class="q-ma-md" style="clear:both">
          <h5>
            <div v-if="error"><q-icon name="error_outline" color="orange" />&nbsp; {{ error }}</div>
          </h5>
        </div>
      </div>
      <div v-if="styleType === 'table'">
        <browseTable :filteredPosts="filteredPosts" :loading="loading" />
         <div v-if="!loading" class="q-ma-md" style="clear:both">
          <h5>
            <div v-if="error"><q-icon name="error_outline" color="orange" />&nbsp; {{ error }}</div>
          </h5>
        </div>
      </div>
    </div>
    <div v-if="posts.length > 0" class="text-center">
      <q-btn outline rounded color="primary" icon="search" label="Load more" @click="start_author = posts[posts.length - 1].author; start_permlink = posts[posts.length - 1].permlink; getPosts()" />
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
import { defineAsyncComponent } from 'vue'
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
  components: {
    postPreview: defineAsyncComponent(() => import('components/postPreview.vue')),
    browseTable: defineAsyncComponent(() => import('components/browseTable.vue'))
  },
  data () {
    return {
      loading: false,
      toolbarOpen: this.showToolbar,
      filtersDialog: false,
      styleType: this.$route.query.style || 'preview',
      styleOptions: [
        { label: 'Full', value: 'full', icon: 'subject' },
        { label: 'Preview', value: 'preview', icon: 'preview' },
        { label: 'Media', value: 'media', icon: 'photo_library' },
        { label: 'Table', value: 'table', icon: 'table_view' }
      ],
      posts: [],
      method: this.callMethod || 'bridge.get_ranked_posts',
      observer: this.$route.query.observer || this.$hiveStore.user.username,
      limit: this.$route.query.limit || this.responseLimit || 20,
      sort: this.$route.query.sort || this.sortMethod,
      start_author: this.$route.query.start_author || this.Pstart_author,
      start_permlink: this.$route.query.start_permlink || this.Pstart_permlink,
      page: this.Ppage,
      account: this.showAccount,
      name: null,
      tag: this.$route.query.tag || this.showTag,
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
      get () { return this.$hiveStore.user.username }
    }
  },
  watch: {
    sortMethod: function (newData) {
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
    get () {
      this.getPosts()
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
        .catch(err => {
          this.loading = false
          this.error = err?.cause?.data || err?.message || 'Failed to load posts'
        })
    },
    filterPosts () {
      if (!Array.isArray(this.posts)) {
        this.filteredPosts = []
        return
      }
      var fp = this.posts
      this.filteredPosts = []
      if (this.filter.hideReblogs) { fp = fp.filter(post => !post.reblogged_by) }
      if (this.filter.hideVoted) { fp = fp.filter(post => post.active_votes.filter(v => v.voter === this.loggedInUser).length === 0) }
      // if (this.filter.hideCrossPost) { fp = fp.filter(post => post.json_metadata.includes('"tags":["cross-post"]')) }
      if (this.filter.hidePinned) { fp = fp.filter(post => !post.stats?.is_pinned) }
      if (this.filter.hideHidden) { fp = fp.filter(post => !post.stats?.hidden) }
      if (this.filter.hideGray) { fp = fp.filter(post => !post.stats?.gray) }
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
