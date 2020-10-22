<template>
  <div class="q-pa-md row">
    <div v-if="posts">
      <div class="text-h6 text-center">Recently shared by ausbitbank</div>
      <q-carousel
        v-model="slide"
        transition-prev="scale"
        transition-next="scale"
        swipeable
        animated
        control-color="primary"
        padding
        navigation
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
          <div class="absolute-top text-center"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar></div>
        </q-carousel-slide>
      </q-carousel>
    </div>
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
  name: 'recentPostsCarousel',
  props: [],
  // components: { VueJsonPretty },
  data () {
    return {
      posts: [],
      account: 'ausbitbank',
      limit: 10,
      showResteems: true,
      api: 'https://rpc.ausbit.dev',
      slide: null,
      autoplay: true
    }
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
    getRecentPosts () {
      this.$axios.post(this.api, {
        id: 1,
        jsonrpc: '2.0',
        method: 'bridge.get_account_posts',
        params: {
          sort: 'blog',
          account: this.account,
          limit: this.limit,
          observer: this.account,
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
    this.getRecentPosts()
  }
}
</script>
