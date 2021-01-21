<template>
  <div>
    <q-spinner-grid size="2em" color="primary" v-if="loading" />
    <div v-if="posts.length > 0">
      <q-card flat bordered>
      <div class="text-h6 text-center">
        <q-icon name="rss_feed" /> <span v-if="type === 'blog'">Recently shared</span><span v-if="type === 'posts'">Recently posted</span> by {{ this.account }} <q-btn v-if="false" icon="settings" @click="settings = true" />
      </div>
      <q-carousel
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
        height="250px"
        width="450px"
        @mouseenter="autoplaySlides = false"
        class="bg-dark text-white shadow-2 rounded-borders"
      >
        <q-carousel-slide :name="post.permlink" class="column no-wrap flex-center" v-for="post in posts" :key="post.index" :img-src="returnPostImage(post)">
          <div class="custom-caption">
            <router-link :to="returnPostPath(post.author, post.permlink)">{{ s(post.title).substr(0,100) }}</router-link><br />
            by <span class="text-bold"><router-link :to="linkAccount(post.author)">@{{ post.author }}</router-link></span><br />
            <span class="text-caption">{{ timeDelta(post.created) }}</span><br />
            <span class="text-caption wrap" v-if="post.json_metadata.description"> {{s(post.json_metadata.description).substr(0,100)}}</span>
            <span class="text-caption wrap" v-else> {{ s(post.body).substr(0,100) }}</span>
          </div>
          <div class="absolute-bottom text-center"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar></div>
        </q-carousel-slide>
      </q-carousel>
      <q-dialog v-model="settings">
        <q-card class="q-pa-md q-ma-md">
          <q-input label="account" v-model="account" />
          <q-btn push label="update" color="primary" @click="settings = false; getRecentPosts()"/>
        </q-card>
      </q-dialog>
      </q-card>
    </div>
  </div>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: normal; text-decoration: none; }
a:visited { color: #1d8ce0; }
.custom-caption { text-align: center; padding: 12px; font-weight: normal; color: white; background-color: rgba(0, 0, 0, .9) }
</style>
<script>
import moment from 'moment'
import sanitize from 'sanitize-html'
import { DefaultRenderer } from 'steem-content-renderer'
export default {
  name: 'recentPostsCarousel',
  data () {
    return {
      posts: [],
      showResteems: true,
      api: 'https://rpc.ausbit.dev',
      slide: null,
      limit: 10,
      settings: false,
      loading: false,
      autoplaySlides: this.autoplay,
      renderer: new DefaultRenderer({
        baseUrl: 'https://hive.ausbit.dev/',
        breaks: false,
        skipSanitization: false,
        allowInsecureScriptTags: false,
        addNofollowToLinks: true,
        doNotShowImages: true,
        ipfsPrefix: '',
        assetsWidth: 640,
        assetsHeight: 480,
        imageProxyFn: (url) => url,
        usertagUrlFn: (account) => '/@' + account,
        hashtagUrlFn: (hashtag) => '/trending/' + hashtag,
        isLinkSafeFn: (url) => true
      })
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
      if (post.json_metadata.image) {
        return post.json_metadata.image[0]
      } else {
        return null
      }
    },
    returnPostPath (author, permlink) {
      return '/@' + author + '/' + permlink
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
    getRecentPosts () {
      this.loading = true
      this.posts = []
      this.$axios.post(this.api, {
        id: 1,
        jsonrpc: '2.0',
        method: 'bridge.get_account_posts',
        params: {
          sort: this.type, // blog or posts
          account: this.account,
          limit: this.limit,
          observer: this.account,
          start_author: null,
          start_permlink: null
        }
      })
        .then((res) => {
          this.loading = false
          this.posts = res.data.result
          this.slide = this.firstPermlink
        })
    },
    s (input) {
      // Render markdown to html, strip all tags and attributes, remove URLS
      var options = { allowedTags: [], allowedAttributes: [], disallowedTagsMode: 'discard' }
      return sanitize(input, options)
      //  .replace(/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/g, '')
    }
  },
  mounted () {
    this.getRecentPosts()
  }
}
</script>
