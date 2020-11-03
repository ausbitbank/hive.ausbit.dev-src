<template>
  <div>
    <q-spinner-grid size="2em" color="primary" v-if="posts.length === 0" />
    <div v-if="posts.length > 0">
      <q-card flat bordered>
      <div class="text-h6 text-center"><q-icon name="rss_feed" /> Recently voted by {{ this.account }} <q-btn v-if="false" icon="settings" @click="settings = true" /></div>
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
a:visited { color: #884488; }
.custom-caption { text-align: center; padding: 12px; font-weight: normal; color: white; background-color: rgba(0, 0, 0, .9) }
</style>
<script>
import moment from 'moment'
export default {
  name: 'recentVotedPostsCarousel',
  data () {
    return {
      posts: [],
      showResteems: true,
      api: 'https://rpc.ausbit.dev',
      slide: null,
      autoplay: true,
      limit: 10,
      settings: false,
      loading: false
    }
  },
  props: {
    account: String
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
    }
  },
  mounted () {
  }
}
</script>
