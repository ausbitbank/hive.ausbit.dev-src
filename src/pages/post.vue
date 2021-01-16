<template>
  <q-page class="flex flex-center q-pa-sm">
    <div class="row items-start content-start justify-center">
      <q-spinner-grid size="2em" color="primary" v-if="!post" class="q-ma-lg" />
      <div class="col-xs-12 col-md-8 justify-center">
        <q-card flat bordered class="q-pa-sm" v-if="post" style="max-width: 1000px">
          <q-card-section class="text-h4 text-center" v-if="post.title">
            {{ post.title }}
          </q-card-section>
          <q-card-section v-if="post.parent_author !== ''">
            Reply to <router-link :to="linkAccount(post.parent_author)">{{ post.parent_author }}</router-link> / <router-link :to="linkPost(post.parent_author, post.parent_permlink)">{{ post.parent_permlink }}</router-link>
          </q-card-section>
          <q-card-section>
            <Card3PostsContent :post="post" />
          </q-card-section>
          <comments :author="post.author" :permlink="post.permlink" v-if="post.children > 0" />
        </q-card>
      </div>
      <div class="col-sm-12 col-md-4 text-center justify-center">
        <q-card dense flat bordered class="" v-if="post" style="min-width: 250px">
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
                  {{ post.pending_payout_value.split(' ')[0] }} Hive Rewards
                </q-item-section>
                <q-item-section v-if="post.pending_payout_value !== '0.000 HBD'" title="Cashout time">
                  {{ timeDelta(post.cashout_time) }}
                </q-item-section>
                <q-item-section class="text-caption" title="Total payout value" v-if="post.total_payout_value !== '0.000 HBD'">
                  {{ post.total_payout_value }}
                </q-item-section>
              </q-item>
              <q-item v-if="post.community && post.community_title" title="Community">
                <q-item-section avatar>
                    <q-icon name="label_important" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  {{ post.community_title }} Community
                </q-item-section>
              </q-item>
              <q-item v-else-if="post.category" title="Category">
                <q-item-section avatar>
                    <q-icon name="label_important" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  {{ post.category }}
                </q-item-section>
              </q-item>
              <q-item v-if="post.json_metadata && JSON.parse(post.json_metadata).tags" title="Tags">
                <q-item-section avatar>
                    <q-icon name="label" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  <span v-for="tag in JSON.parse(post.json_metadata).tags" :key="tag.index">{{ tag }}</span>
                </q-item-section>
              </q-item>
              <q-item v-if="post.json_metadata && JSON.parse(post.json_metadata).app" title="App">
                <q-item-section avatar>
                  <q-icon name="fingerprint" />
                </q-item-section>
                <q-item-section>
                  {{ JSON.parse(post.json_metadata).app }}
                </q-item-section>
              </q-item>
              <q-item title="Votes" v-if="post.active_votes.length > 0">
                <q-item-section avatar>
                  <q-icon name="how_to_vote" />
                </q-item-section>
                <q-item-section>
                  <span class="text-blue text-bold cursor-pointer" @click="showVotes = true">{{ post.active_votes.length }} votes</span>
                </q-item-section>
                <q-dialog v-model="showVotes">
                  <q-card flat bordered style="max-width: 1000px; max-width: 95%;">
                    <q-table title="Votes" :data="post.active_votes" :columns="voteColumns" :pagination="{ sortBy: 'weight', descending: true, rowsPerPage: 50 }" dense bordered separator="cell" />
                  </q-card>
                </q-dialog>
              </q-item>
            </q-list>
          </q-card-section>
          <q-card-section v-if="loggedInUser && postPastPayout" class="text-caption">
            <div>This post is past its payout window.</div>
            <div>You can still vote, but it will not affect rewards.</div>
          </q-card-section>
          <q-card-section v-if="loggedInUser">
            <vote :author='author' :permlink="permlink" :active_votes="this.post.active_votes"/>
          </q-card-section>
          <q-card-section>
            View this post on <a :href="linkHiveBlogPost(author, permlink)">Hive.blog</a>, <a :href="linkPeakdPost(author, permlink)">Peakd</a>
          </q-card-section>
        </q-card>
        <recent-posts-carousel :account="author" :autoplay=false />
      </div>
    </div>
  </q-page>
</template>
<style scoped>
a, a:link { color: #1d8ce0 }
</style>
<script>
import Card3PostsContent from 'components/Card3PostsContent.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import comments from 'components/comments.vue'
import moment from 'moment'
import vote from 'components/vote.vue'
export default {
  name: 'postView',
  components: { Card3PostsContent, recentPostsCarousel, comments, vote },
  data () {
    return {
      post: null,
      author: this.$router.currentRoute.params.author,
      permlink: this.$router.currentRoute.params.permlink,
      // api: 'https://rpc.ausbit.dev',
      showVotes: false,
      voteColumns: [
        {
          name: 'voter',
          label: 'Voter',
          field: 'voter',
          sortable: true
        },
        {
          name: 'percent',
          label: 'Percent',
          field: 'percent',
          sortable: true
        },
        {
          name: 'rshares',
          label: 'rshares',
          field: 'rshares',
          sortable: true
        },
        {
          name: 'weight',
          label: 'weight',
          field: 'weight',
          sortable: true
        },
        {
          name: 'reputation',
          label: 'reputation',
          field: 'reputation',
          sortable: true
        },
        {
          name: 'time',
          label: 'time',
          field: 'time',
          sortable: true
        }
      ]
    }
  },
  watch: {
    $route: function () {
      this.init()
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    postPastPayout: function () {
      var now = moment.utc()
      var stamp = moment.utc(this.post.cashout_time)
      if (now > stamp) {
        return true
      } else {
        return false
      }
    }
  },
  methods: {
    getPost (author, permlink) {
      this.$hive.api.getContentAsync(author, permlink)
        .then(post => this.setPost(post))
        .catch(error => console.log(error))
    },
    setPost (post) {
      this.post = post
      document.title = post.title
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
    linkPost (author, permlink) {
      return '/@' + author + '/' + permlink
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
