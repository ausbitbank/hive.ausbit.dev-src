<template>
    <q-card class="postPreviewCard q-ma-sm" dark dense bordered v-if="post">
      <q-card-section horizontal>
        <q-card-section v-if="postImage">
            <router-link :to="returnPostPath(post.author, post.permlink)">
              <q-img style="width: 200px; height: 200px" :src="postImage" :title="post.title" />
            </router-link>
              <!-- <q-carousel animated v-model="thumbslide" arrows navigation infinite v-if="postMeta.image.length > 0">
                <q-carousel-slide v-for="image in postMeta.image" :key="image.index" :name="image.index" :img-src="image" />
              </q-carousel> -->
        </q-card-section>
        <q-separator vertical v-if="postImage" />
        <q-item>
            <q-item-section>
                <q-item-label>
                    <div class="text-h6 vertical-top"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,100) }}</router-link></div>
                    <span class="text-caption wrap" v-if="postMeta.description">{{ s(postMeta.description).substr(0,650) }}</span>
                    <span class="text-caption wrap" v-else>{{ s(post.body).substr(0,650) }}..</span>
                </q-item-label>
            </q-item-section>
        </q-item>
      </q-card-section>
      <q-separator />
      <q-card-section dense class="text-left">
          <router-link :to="linkAccount(post.author)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar> {{ post.author }}</router-link>
          <span class="text-caption text-center text-grey">  {{ timeDelta(post.created) }}</span>
          <q-btn dense :icon="voteIcon" flat color="secondary" v-if="post.active_votes" :label="post.active_votes.length"><q-popup-proxy v-if="myVote === undefined"><q-banner><vote :votes="post.active_votes" :author="post.author" :permlink="post.permlink" /></q-banner></q-popup-proxy></q-btn>
          <q-btn dense icon="comment" flat color="blue-grey" :label="post.children" />
          <q-btn flat dense>
            <q-icon name="img:statics/hextacular.svg" color="secondary" class="q-mr-sm" />
            <span v-if="!post.is_paidout">{{ post.pending_payout_value.split(' ')[0] }} Hive Rewards</span>
            <span v-else>{{ post.payout }} Hive Rewards</span>
          </q-btn>
          <q-btn dense icon="more_horiz" flat color="grey" />
      </q-card-section>
    </q-card>
</template>
<style>
.postPreviewCard { max-width: 95% }
</style>
<script>
import sanitize from 'sanitize-html'
import { DefaultRenderer } from 'steem-content-renderer'
import moment from 'moment'
import vote from 'components/vote.vue'
export default {
  name: 'postPreview',
  props: ['post'],
  data () {
    return {
      thumbslide: 0,
      renderer: new DefaultRenderer({
        baseUrl: 'https://hive.ausbit.dev/',
        breaks: true,
        skipSanitization: false,
        allowInsecureScriptTags: false,
        addNofollowToLinks: true,
        doNotShowImages: false,
        ipfsPrefix: '',
        assetsWidth: 640,
        assetsHeight: 480,
        imageProxyFn: (url) => url,
        usertagUrlFn: (account) => '/@' + account,
        hashtagUrlFn: (hashtag) => '/trending/' + hashtag,
        isLinkSafeFn: (url) => true
      })
    }
  },
  components: { vote },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    postMeta: function () {
      if (this.post.json_metadata) {
        return this.post.json_metadata
      } else {
        return null
      }
    },
    postImage: function () {
      if (this.postMeta.image) {
        return this.postMeta.image[0]
      } else {
        return null
      }
    },
    downVotes: function () {
      return null
    },
    myVote: function () {
      return this.post.active_votes.filter(this.filterMyVote)[0]
    },
    voteIcon: function () {
      if (this.myVote !== undefined) {
        if (Math.sign(this.myVote.rshares) === 1) {
          return 'favorite'
        } else {
          return 'favorite_border'
        }
      } else {
        return 'favorite_border'
      }
    }
  },
  methods: {
    s (input) {
      // Render markdown to html, strip all tags and attributes, remove URLS
      var options = { allowedTags: [], allowedAttributes: [], disallowedTagsMode: 'discard' }
      return sanitize(input, options)
    },
    returnPostPath (author, permlink) {
      return '/@' + author + '/' + permlink
    },
    getHiveAvatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    filterMyVote (op) { if (op.voter === this.loggedInUser) { return true } else { return false } },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    linkAccount (account) {
      return '/@' + account
    }
  }
}
</script>
