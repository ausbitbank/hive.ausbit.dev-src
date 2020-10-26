<template>
  <q-page class="flex flex-center q-pa-md">
    <q-spinner-grid size="2em" color="primary" v-if="!post" class="q-ma-lg" />
    <q-card flat bordered class="q-pa-md q-ma-md" style="max-width: 95%; max-width: 1000px;" v-if="post">
      <q-card-section class="text-h4 text-center">
        {{ post.title }}
      </q-card-section>
      <q-card-section>
        <Card3PostsContent :post="post" />
      </q-card-section>
    </q-card>
    <q-card flat bordered class="q-pa-md q-ma-md" v-if="post">
      <q-card-section>
        <q-list dense>
          <q-item>
            <q-item-section avatar>
              <q-avatar>
                <q-img :src="GetHiveAvatarUrl(author)" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <router-link :to="linkAccount(author)">{{ author }}</router-link>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section avatar>
              <q-icon name="history" />
            </q-item-section>
            <q-item-section class="text-caption text-grey">
              Posted {{ timeDelta(post.created) }}
            </q-item-section>
          </q-item>
          <q-item v-if="post.last_update !== post.created">
            <q-item-section avatar>
              <q-icon name="create" />
            </q-item-section>
            <q-item-section class="text-caption text-grey">
              Edited {{ timeDelta(post.last_update) }}
            </q-item-section>
          </q-item>
          <q-item v-if="post.pending_payout_value !== '0.000 HBD' || post.total_payout_value !== '0.000 HBD'">
            <q-item-section avatar>
              <q-icon name="monetization_on"/>
            </q-item-section>
            <q-item-section class="text-caption" title="Pending payout value" v-if="post.pending_payout_value !== '0.000 HBD'">
              {{ post.pending_payout_value }}
            </q-item-section>
            <q-item-section v-if="post.pending_payout_value !== '0.000 HBD'" title="Cashout time">
              {{ timeDelta(post.cashout_time) }}
            </q-item-section>
            <q-item-section class="text-caption" title="Total payout value" v-if="post.total_payout_value !== '0.000 HBD'">
              {{ post.total_payout_value }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-section>
        View this post on <a :href="linkHiveBlogPost(author, permlink)">Hive.blog</a>, <a :href="linkPeakdPost(author, permlink)">Peakd</a>
      </q-card-section>
    </q-card>
    <recent-posts-carousel :account="author" />
  </q-page>
</template>

<script>
import hive from '@hiveio/hive-js'
import Card3PostsContent from 'components/Card3PostsContent.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import moment from 'moment'
export default {
  name: 'postView',
  components: { Card3PostsContent: Card3PostsContent, recentPostsCarousel },
  data () {
    return {
      post: null,
      author: this.$router.currentRoute.params.author,
      permlink: this.$router.currentRoute.params.permlink
    }
  },
  watch: {
    $route: function () {
      this.init()
    }
  },
  methods: {
    getPost (author, permlink) {
      hive.api.getContentAsync(author, permlink)
        .then(post => this.setPost(post))
        .catch(error => console.log(error))
    },
    setPost (post) {
      this.post = post
    },
    linkHiveBlogPost (author, permlink) {
      return 'https://hive.blog/@' + author + '/' + permlink
    },
    linkPeakdPost (author, permlink) {
      return 'https://peakd.com/@' + author + '/' + permlink
    },
    linkAccount (username) {
      return '/@' + username
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    init () {
      this.post = null
      this.author = this.$router.currentRoute.params.author
      this.permlink = this.$router.currentRoute.params.permlink
      this.getPost(this.author, this.permlink)
    }
  },
  mounted () {
    this.init()
  }
}
</script>
