<template>
  <div>
    <div v-if="!loading">
      <q-card flat bordered>
      <div class="text-h6 text-center">
        <q-icon name="forum" color="teal" /> Community Posts for {{ this.account }}
      </div>
      <q-carousel
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
            <span class="text-caption wrap" v-else> {{ returnPostSummary(post) }}</span>
          </div>
          <div class="absolute-bottom text-center"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar></div>
        </q-carousel-slide>
      </q-carousel>
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
import { postBodySummary, catchPostImage } from '@ecency/render-helper'
export default {
  name: 'communityPostsCarousel',
  data () {
    return {
      posts: [],
      showResteems: true,
      slide: null,
      limit: 10,
      settings: false,
      loading: false,
      autoplaySlides: this.autoplay,
      postType: this.type
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
    async getCommunityFeed () {
      this.loading = true
      this.posts = []
      var params = { sort: 'created', limit: this.limit, observer: this.account, tag: 'my' }
      this.$hive.api.callAsync('bridge.get_ranked_posts', params)
        .then(res => {
          this.loading = false
          this.posts = res
          this.slide = this.firstPermlink
        })
    },
    s (input) {
      var options = { allowedTags: [], allowedAttributes: [], disallowedTagsMode: 'discard' }
      return sanitize(input, options)
    },
    init () {
      this.getCommunityFeed()
    }
  },
  mounted () {
    this.init()
  }
}
</script>
