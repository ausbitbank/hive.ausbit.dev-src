<template>
  <div class="">
    <q-spinner-grid size="2em" color="primary" v-if="posts.length === 0" />
    <div v-if="posts.length > 0">
      <q-card flat bordered style="width: 500px;">
      <div class="text-h6 text-center">{{ this.sortMethod.charAt(0).toUpperCase() + this.sortMethod.slice(1) }} <q-btn v-if="false" icon="settings" @click="settings = true" /></div>
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
        :autoplay="autoplay"
        height="250px"
        @mouseenter="autoplay = false"
        @mouseleave="autoplay = true"
        class="bg-dark text-white shadow-2 rounded-borders"
      >
        <q-carousel-slide :name="post.permlink" class="column no-wrap flex-center" v-for="post in posts" :key="post.index" :img-src="returnPostImage(post)">
          <div class="custom-caption">
            <router-link :to="returnPostPath(post.author, post.permlink)" class="text-white text-italic">{{ post.title.substr(0,100) }}</router-link><br />
            by <span class="text-bold">@{{ post.author }}</span><br />
            <span class="text-caption">{{ timeDelta(post.created) }}</span>
          </div>
          <div class="absolute-bottom text-center"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar></div>
        </q-carousel-slide>
      </q-carousel>
      </q-card>
    </div>
    <q-dialog v-model="settings">
      <q-card class="q-pa-md q-ma-md">
        <q-input v-model="newSort" label="Sort method" />
        <q-btn label="update" color="primary" @click="settings = false; sortMethod = newSort; getRankedPosts()" />
      </q-card>
    </q-dialog>
  </div>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: normal; text-decoration: none; }
a:visited { color: #884488; }
.custom-caption { text-align: center; padding: 12px; font-weight: normal; color: white; background-color: rgba(0, 0, 0, .9) }
</style>
<script>
import moment from 'moment'
// import hive from '@hiveio/hive-js'
// import VueJsonPretty from 'vue-json-pretty'
// import 'vue-json-pretty/lib/styles.css'
export default {
  name: 'trendingPostsCarousel',
  // components: { VueJsonPretty },
  data () {
    return {
      posts: [],
      api: 'https://rpc.ausbit.dev',
      slide: null,
      autoplay: true,
      settings: false,
      newSort: null
    }
  },
  props: {
    // tag: String,
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
      if (post.json_metadata.image) {
        return post.json_metadata.image[0]
      } else {
        return null
      }
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
    getRankedPosts () {
      this.posts = []
      this.$axios.post(this.api, {
        id: 1,
        jsonrpc: '2.0',
        method: 'bridge.get_ranked_posts',
        params: {
          observer: null,
          limit: 10,
          sort: this.sortMethod,
          start_author: null,
          start_permlink: null
        }
      })
        .then((res) => {
          this.posts = res.data.result
          this.slide = this.firstPermlink
        })
    }
  },
  mounted () {
    this.newSort = this.sortMethod
    this.getRankedPosts()
  }
}
</script>
