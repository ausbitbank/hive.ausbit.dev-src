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
      <div class="text-h6 text-center section-title"><q-icon name="rss_feed" /> Recently voted by {{ account }} <q-btn v-if="false" icon="settings" @click="settings = true" /></div>
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
        :height="$q.screen.lt.sm ? '300px' : '250px'"
        :width="$q.screen.lt.sm ? '100%' : '450px'"
        :aria-label="'Recently voted posts by ' + account"
        @mouseenter="autoplay = false"
        @mouseleave="autoplay = true"
        class="hive-carousel bg-dark text-white shadow-2"
      >
        <q-carousel-slide :name="post.permlink" class="column no-wrap flex-center" v-for="post in posts" :key="post.index" :img-src="returnPostImage(post)">
          <div class="carousel-caption">
            <router-link class="carousel-title" :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,100) }}</router-link>
            <div class="carousel-meta">
              <span class="carousel-author"><router-link :to="'/@' + post.author">@{{ post.author }}</router-link></span>
              <span aria-hidden="true">·</span>
              <span class="carousel-time">{{ timeDelta(post.created) }}</span>
            </div>
          </div>
          <div class="absolute-bottom text-center carousel-avatar"><q-avatar size="3em"><q-img :src="getHiveAvatarUrl(post.author)" :alt="'Avatar of @' + post.author" /></q-avatar></div>
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
.hive-carousel :deep(.carousel-title),
.hive-carousel :deep(.carousel-author a) {
  text-decoration: none;
}
</style>
<script>
import moment from 'src/utils/time'
import { operations as op, makeBitMaskFilter } from 'src/services/hiveOperations'
import { hiveAvatarUrl } from 'src/utils/avatar'
const voteBitmask = makeBitMaskFilter([
  op.vote
])
export default {
  name: 'recentVotedPostsCarousel',
  data () {
    return {
      posts: [],
      showResteems: true,
      api: 'https://api.hive.blog',
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
        ['condenser_api',
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
              setTimeout(() => this.getRecentVotes(username), 1000)
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
      return hiveAvatarUrl(user)
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
