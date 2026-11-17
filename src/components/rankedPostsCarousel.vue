<template>
  <div>
    <div>
      <q-card flat bordered>
      <div class="text-h6 text-center">
        <router-link to="/trending" v-if="sortMethod === 'trending'"><q-icon name="trending_up" color="green" /> Trending</router-link>
        <router-link to="/hot" v-if="sortMethod === 'hot'"><q-icon name="whatshot" v-if="sortMethod === 'hot'" color="red" /> Hot</router-link>
        <q-btn v-if="false" icon="settings" @click="settings = true" /></div>
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
        :autoplay="autoplay"
        :height="$q.screen.lt.sm ? '300px' : '250px'"
        :width="$q.screen.lt.sm ? '100%' : '400px'"
        aria-label="Trending Hive posts"
        @mouseenter="autoplay = false"
        @mouseleave="autoplay = true"
        class="bg-dark text-white shadow-2 rounded-borders"
      >
        <q-carousel-slide :name="post.permlink" class="column no-wrap flex-center" v-for="post in posts" :key="post.index" :img-src="returnPostImage(post)">
          <div class="custom-caption">
            <router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,100) }}</router-link><br />
            by <span class="text-bold"><router-link :to="linkAccount(post.author)">@{{ post.author }}</router-link></span><br />
            <span class="text-caption">{{ timeDelta(post.created) }}</span><br />
            <span class="text-caption wrap" v-if="post.json_metadata.description">{{ s(post.json_metadata.description).substr(0,150) }}</span>
            <span class="text-caption wrap" v-else>{{ returnPostSummary(post) }}</span>
          </div>
          <div class="absolute-bottom text-center"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" :alt="'Avatar of @' + post.author" /></q-avatar></div>
        </q-carousel-slide>
      </q-carousel>
      </q-card>
    </div>
    <q-dialog v-model="settings">
      <q-card class="q-pa-md q-ma-md">
        <q-input v-model="newSort" label="Sort method" />
        <q-btn label="update" color="primary" @click="settings = false; currentSort = newSort; getRankedPosts()" />
      </q-card>
    </q-dialog>
  </div>
</template>
<style scoped>
a {text-decoration: none; color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: normal; text-decoration: none; }
a:visited { color: #1d8ce0; }
.custom-caption { text-align: center; padding: 12px; font-weight: normal; color: white; background-color: rgba(0, 0, 0, .9) }
</style>
<script>
import moment from 'src/utils/time'
import { stripHtml } from 'src/utils/safeHtml'
import { postBodySummary, catchPostImage } from '@ecency/render-helper'
export default {
  name: 'trendingPostsCarousel',
  data () {
    return {
      posts: [],
      api: this.$hiveStore.user.settings.apiNode || 'https://api.hive.blog',
      slide: null,
      autoplay: true,
      settings: false,
      newSort: null,
      autoplaySlides: this.autoplay,
      loading: false,
      currentSort: this.sortMethod
    }
  },
  props: {
    sortMethod: String // eg 'trending'
  },
  computed: {
    firstPermlink: function () {
      if (this.posts.length > 0) {
        return this.posts[0].permlink
      } else {
        return null
      }
    }
  },
  methods: {
    returnPostImage (post) {
      return catchPostImage(post)
    },
    returnPostSummary (post) {
      return postBodySummary(post, 150)
    },
    returnPostPath (author, permlink) {
      return '/@' + author + '/' + permlink
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
    linkAccount (account) {
      return '/@' + account
    },
    getRankedPosts () {
      this.posts = []
      this.loading = true
      this.$axios.post(this.api, {
        id: 1,
        jsonrpc: '2.0',
        method: 'bridge.get_ranked_posts',
        params: {
          observer: null,
          limit: 15,
          sort: this.currentSort,
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
      // Strip tags/attributes and collapse whitespace for the caption.
      return stripHtml(input)
    }
  },
  mounted () {
    this.newSort = this.sortMethod
    this.getRankedPosts()
  }
}
</script>
