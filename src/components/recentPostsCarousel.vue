<template>
  <div>
    <div>
      <q-card flat bordered>
      <div class="text-h6 text-center section-title">
        <q-icon name="rss_feed" color="orange" /> <span v-if="postType === 'blog'" @click="postType = 'posts'; init()" class="text-primary cursor-pointer">Recently shared</span><span v-if="postType === 'posts'" @click="postType = 'blog'; init()" class="text-primary cursor-pointer">Recently posted</span> by <span @click="settings = true" class="text-primary cursor-pointer">{{ accountInput }}</span> <q-btn v-if="false" icon="settings" @click="settings = true" />
      </div>
      <q-skeleton :height="$q.screen.lt.sm ? '300px' : '250px'" width="100%" animation="fade" rect v-if="loading" />
      <q-carousel
        role="region"
        v-if="posts.length > 0"
        v-model="slide"
        transition-prev="jump-left"
        transition-next="jump-right"
        swipeable
        animated
        control-color="primary"
        padding
        arrows
        infinite
        :autoplay="autoplaySlides"
        :height="$q.screen.lt.sm ? '300px' : '250px'"
        :width="$q.screen.lt.sm ? '100%' : '450px'"
        :aria-label="'Recent posts by @' + accountInput"
        @mouseenter="autoplaySlides = false"
        class="hive-carousel bg-dark text-white shadow-2"
      >
        <q-carousel-slide :name="post.permlink" class="column no-wrap flex-center" v-for="post in posts" :key="post.index" :img-src="returnPostImage(post)">
          <div class="carousel-caption">
            <router-link class="carousel-title" :to="returnPostPath(post.author, post.permlink)">{{ s(post.title).substr(0,100) }}</router-link>
            <div class="carousel-meta">
              <span class="carousel-author"><router-link :to="linkAccount(post.author)">@{{ post.author }}</router-link></span>
              <span aria-hidden="true">·</span>
              <span class="carousel-time">{{ timeDelta(post.created) }}</span>
            </div>
            <span class="carousel-summary" v-if="post.json_metadata.description"> {{s(post.json_metadata.description).substr(0,100)}}</span>
            <span class="carousel-summary" v-else> {{ returnPostSummary(post) }}</span>
          </div>
          <div class="absolute-bottom text-center carousel-avatar"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" :alt="'Avatar of @' + post.author" /></q-avatar></div>
        </q-carousel-slide>
      </q-carousel>
      <q-dialog v-model="settings">
        <q-card flat bordered class="q-pa-md text-center">
          <q-input label="Account to view" v-model="accountInput" @submit="init()"/>
          <q-btn-toggle push glossy toggle-color="primary" :options="[{ label: 'Posts', value: 'posts' }, { label: 'Blog', value: 'blog' }]" v-model="postType" />
          <q-btn dense flat icon="refresh" label="update" color="green" @click="settings = false; init()" style="margin:both"/>
        </q-card>
      </q-dialog>
      </q-card>
    </div>
  </div>
</template>
<style scoped>
.hive-carousel :deep(.carousel-title),
.hive-carousel :deep(.carousel-author a) {
  text-decoration: none;
}
</style>
<script>
import moment from 'src/utils/time'
import { stripHtml } from 'src/utils/safeHtml'
import { postBodySummary, catchPostImage } from '@ecency/render-helper'
export default {
  name: 'recentPostsCarousel',
  data () {
    return {
      posts: [],
      showResteems: true,
      slide: null,
      limit: 10,
      settings: false,
      loading: false,
      autoplaySlides: this.autoplay,
      postType: this.type,
      accountInput: this.account
    }
  },
  watch: {
    $route: function () {
      this.getRecentPosts()
    }
  },
  props: {
    account: String,
    autoplay: {
      type: Boolean,
      required: false,
      default: true
    },
    type: {
      type: String,
      default: 'posts' // posts or blog
    }
  },
  computed: {
    firstPermlink: function () {
      if (this.posts.length > 0) {
        return this.posts[0].permlink
      } else {
        return null
      }
    },
    autoplayProp: function () {
      return this.autoplay
    }
  },
  methods: {
    returnPostImage (post) {
      return catchPostImage(post)
    },
    returnPostPath (author, permlink) {
      return '/@' + author + '/' + permlink
    },
    returnPostSummary (post) {
      return postBodySummary(post, 150)
    },
    linkAccount (author) {
      return '/@' + author
    },
    getHiveAvatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    async getRecentPosts () {
      this.loading = true
      this.posts = []
      var params = { sort: this.postType, account: this.accountInput, limit: this.limit, observer: this.loggedInUser || this.accountInput, start_author: null, start_permlink: null }
      this.$hive.api.callAsync('bridge.get_account_posts', params)
        .then(res => {
          this.loading = false
          this.posts = res
          this.slide = this.firstPermlink
        })
    },
    s (input) {
      // Strip tags/attributes and collapse whitespace for the caption.
      return stripHtml(input)
    },
    init () {
      this.getRecentPosts()
    }
  },
  mounted () {
    this.init()
  }
}
</script>
