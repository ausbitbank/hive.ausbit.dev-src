<template>
  <div>
    <q-card>
    <div v-for="vote in votes" :key="vote.index">
      <router-link :to="returnPostPath(vote[1].op[1].author, vote[1].op[1].permlink)" v-if="vote[1].op[1].author !== account">
        {{ vote[1].op[1].permlink }}
        </router-link>
    </div>
    </q-card>
    <q-spinner-puff size="2em" color="primary" v-if="posts.length === 0" />
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
      <ul v-for="post in posts" :key="post.index">
        <li>{{ post.author }}\{{ post.permlink }} : {{ post.title }}</li>
      </ul>
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
import { debounce } from 'quasar'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'
const op = ChainTypes.operations
const voteBitmask = makeBitMaskFilter([
  op.vote
])
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
      loading: false,
      votes: [],
      accountHistoryPointer: -1,
      accountHistoryLimit: 100,
      bitmask: voteBitmask
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
    getPost (author, permlink) {
      this.$hive.api.getContentAsync(author, permlink)
        .then(res => {
          if (res.title !== '' && res.author !== this.account) {
            this.posts.push(res)
          }
        })
    },
    async getRecentVotes (username) {
      this.loading = true
      await this.$hive.api.callAsync(
        'call',
        ['database_api',
          'get_account_history',
          [this.account,
            this.accountHistoryPointer,
            this.accountHistoryLimit,
            ...this.bitmask
          ]
        ]
      )
        .then(res => {
          this.accountHistoryPointer = parseInt(res[0][0]) - 1
          if (this.votes.length === 0) {
            this.votes = res.reverse()
          } else {
            this.votes = this.votes.concat(res.reverse())
          }
          this.loading = false
          this.votesToPosts(this.votes)
        })
        .catch(err => {
          this.loading = false
          if (err.data && err.cause) {
            if (err.data.stack[0].data.sequence && err.cause.message.includes('Could not find filtered operation in')) {
              this.accountHistoryPointer = err.data.stack[0].data.sequence
              debounce(this.getRecentVotes(username), 100)
            }
          }
        })
    },
    filterOwnPosts (tx) {
      if (tx[1].op[1].author === this.account) {
        return true
      } else {
        return false
      }
    },
    votesToPosts (votes) {
      votes.filter(this.filterOwnPosts).slice(0, 20).forEach(function (tx) {
        this.getPost(tx[1].op[1].author, tx[1].op[1].permlink)
      }.bind(this))
    },
    returnPostImage (post) {
      if (post.json_metadata) {
        var meta = JSON.parse(post.json_metadata)
      } else {
        return null
      }
      if (meta.image) {
        if (meta.image[0]) {
          return meta.image[0]
        } else {
          return null
        }
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
    this.getRecentVotes(this.account)
  }
}
</script>
