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
      <div class="text-h6 text-center section-title"><q-icon name="rss_feed" /> Recently voted by {{ account }} <q-btn :icon="autoplay ? 'pause' : 'play_arrow'" :aria-label="autoplay ? 'Pause slideshow' : 'Play slideshow'" @click="autoplay = !autoplay" /></div>
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
        :autoplay="autoplay && !hoverPaused"
        :height="$q.screen.lt.sm ? '300px' : '250px'"
        :width="$q.screen.lt.sm ? '100%' : '450px'"
        :aria-label="'Recently voted posts by ' + account"
        @mouseenter="hoverPaused = true"
        @mouseleave="hoverPaused = false"
        class="hive-carousel text-white shadow-2"
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

function prefersReducedMotion () {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export default {
  name: 'recentVotedPostsCarousel',
  data () {
    return {
      posts: [],
      showResteems: true,
      api: 'https://api.hive.blog',
      slide: null,
      autoplay: !prefersReducedMotion(),
      hoverPaused: false,
      limit: 10,
      settings: false,
      loading: false,
      votes: [],
      accountHistoryPointer: -1,
      accountHistoryLimit: 100,
      bitmask: voteBitmask,
      retryTimer: null,
      retryCount: 0,
      destroyed: false
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
          if (this.destroyed || !res) return
          if (res.title !== '' && res.author !== this.account) {
            this.posts.push(res)
          }
        })
        .catch(() => {})
    },
    async getRecentVotes (username) {
      if (this.destroyed) return
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
          const rows = Array.isArray(res) ? res : []
          this.loading = false
          if (this.destroyed || rows.length === 0) return
          this.retryCount = 0
          this.accountHistoryPointer = parseInt(rows[0][0]) - 1
          if (this.votes.length === 0) {
            this.votes = rows.reverse()
          } else {
            this.votes = this.votes.concat(rows.reverse())
          }
          this.votesToPosts(this.votes)
        })
        .catch(err => {
          this.loading = false
          if (this.destroyed) return
          const sequence = err?.data?.stack?.[0]?.data?.sequence
          const message = err?.cause?.message || err?.message || ''
          if (sequence && message.includes('Could not find filtered operation in')) {
            this.accountHistoryPointer = sequence
            this.scheduleRetry(username)
          }
        })
    },
    scheduleRetry (username) {
      if (this.destroyed || this.retryTimer || this.retryCount >= 5) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      this.retryCount += 1
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        if (!this.destroyed) this.getRecentVotes(username)
      }, 1000 * this.retryCount)
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
      if (!post || !post.json_metadata) return null
      let meta
      try {
        meta = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata
      } catch {
        return null
      }
      const image = Array.isArray(meta?.image) ? meta.image[0] : meta?.image
      return typeof image === 'string' && image ? image : null
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
  },
  beforeUnmount () {
    this.destroyed = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }
}
</script>
