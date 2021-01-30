<template>
    <span>
    <div v-if="post.reblogged_by && this.$route.path.endsWith('feed')" class="text-center">
      <span class="text-bold">Reblogged By: </span>
      <span v-for="reblogger in post.reblogged_by" :key="reblogger.index"><router-link :to="getAccountLink(reblogger)"><q-avatar class="q-ma-sm" size="sm"><img :src="getHiveAvatarUrl(reblogger)"></q-avatar> {{ reblogger }}</router-link> </span>
    </div>
    <transition appear enter-active-class="animated bounceInUp" leave-active-class="animated bounceOutDown">
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
                    <span class="text-caption wrap" v-if="postMeta.description">{{ postMeta.description.substr(0,650) }}</span>
                    <span class="text-caption wrap" v-else>{{ this.summary }}</span>
                </q-item-label>
            </q-item-section>
        </q-item>
      </q-card-section>
      <q-separator />
      <q-card-section dense class="text-left">
          <q-btn color="blue-gray" icon="push_pin" v-if="post.stats.is_pinned" label="Pinned" flat dense />
          <router-link :to="linkAccount(post.author)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar> {{ post.author }}</router-link>
          <q-chip color="primary" dense v-if="post.author_role">{{ post.author_role }}</q-chip>
          <span v-if="post.author_title" class="text-caption">{{ post.author_title }}</span>
          <span class="text-caption text-center text-grey">  {{ timeDelta(post.created) }}</span>
          <q-btn dense :icon="voteIcon" flat color="secondary" v-if="post.active_votes" :label="post.active_votes.length"><q-popup-proxy v-if="myVote === undefined"><q-banner><vote v-on:Voted="showVoteEarly" :votes="post.active_votes" :author="post.author" :permlink="post.permlink" /></q-banner></q-popup-proxy></q-btn>
          <q-btn dense icon="comment" flat color="blue-grey" :label="post.children">
            <q-popup-proxy>
              <commentBox :parent_author="post.author" :parent_permlink="post.permlink" />
            </q-popup-proxy>
          </q-btn>
          <q-btn flat dense>
            <q-icon name="img:statics/hextacular.svg" color="secondary" class="q-mr-sm" />
            <span title="Hive Rewards" v-if="!post.is_paidout">{{ post.pending_payout_value.split(' ')[0] }}</span>
            <span title="Hive Rewards" v-else>{{ post.payout }}</span>
          </q-btn>
          <q-btn dense icon="more_horiz" flat color="grey" v-if="false" />
      </q-card-section>
    </q-card>
    </transition>
    </span>
</template>
<style>
.postPreviewCard { max-width: 100%; margin:auto }
</style>
<script>
import sanitize from 'sanitize-html'
import commentBox from 'components/commentBox.vue'
import moment from 'moment'
import vote from 'components/vote.vue'
import { postBodySummary, catchPostImage } from '@ecency/render-helper'
export default {
  name: 'postPreview',
  props: ['post'],
  data () {
    return {
      thumbslide: 0,
      summary: postBodySummary(this.post, 650),
      postImage: catchPostImage(this.post),
      votedWeight: null
    }
  },
  components: { vote, commentBox },
  watch: {
    post: {
      deep: true,
      handler () {
        this.summary = postBodySummary(this.post, 650)
        this.postImage = catchPostImage(this.post)
      }
    }
  },
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
    downVotes: function () {
      return null
    },
    myVote: function () {
      if (this.votedWeight !== null) {
        return { voter: this.loggedInUser, weight: this.votedWeight, author: this.post.author, permlink: this.post.permlink, rshares: this.votedWeight }
      } else {
        if (this.post !== undefined) {
          return this.post.active_votes.filter(this.filterMyVote)[0]
        } else {
          return null
        }
      }
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
    showVoteEarly (weight) {
      this.votedWeight = weight
    },
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
    getAccountLink (user) {
      return '/@' + user
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
