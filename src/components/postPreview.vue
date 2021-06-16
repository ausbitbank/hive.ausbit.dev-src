<template>
    <div class="q-ma-sm">
    <div v-if="post.reblogged_by && this.$route.path.endsWith('feed')" class="text-center">
      <span class="text-bold">Reblogged By: </span>
      <span v-for="reblogger in post.reblogged_by" :key="reblogger.index"><router-link :to="getAccountLink(reblogger)"><q-avatar class="q-ma-sm" size="sm"><img :src="getHiveAvatarUrl(reblogger)"></q-avatar> {{ reblogger }}</router-link> </span>
    </div>
    <transition appear enter-active-class="animated bounceInUp" leave-active-class="animated bounceOutDown">
    <q-card class="postPreviewCard q-ma-md" dark dense bordered v-if="post">
      <q-card-section horizontal v-if="styleType === 'preview'">
        <q-card-section v-if="postImage">
            <router-link :to="returnPostPath(post.author, post.permlink)">
              <q-img style="width: 200px; height: 200px" :src="postImage" :title="post.title" />
            </router-link>
        </q-card-section>
        <q-separator vertical v-if="postImage" />
        <q-item>
            <q-item-section>
                <q-item-label>
                    <div class="text-h6 vertical-top"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,100) }}</router-link></div>
                    <span><render :input="this.summary" /></span>
                </q-item-label>
            </q-item-section>
        </q-item>
      </q-card-section>
      <q-card-section v-if="styleType === 'grid'" class="text-center">
        <div class="text-h6"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,50) }}</router-link></div>
        <router-link v-if="postImage" :to="returnPostPath(post.author, post.permlink)">
          <q-img style="width: 300px; height: 300px" :src="postImage" :title="post.title" />
        </router-link>
        <div>
          <span class="text-caption" v-if="postMeta.description"><render :input="postMeta.description.substr(0,100)" /></span>
          <span class="text-caption" v-else><render :input="this.summary.substr(0,100)" /></span>
        </div>
        <!-- <q-carousel animated v-model="thumbslide" arrows navigation infinite v-if="postMeta.image.length > 0">
          <q-carousel-slide v-for="image in postMeta.image" :key="image.index" :name="image.index" :img-src="image" />
        </q-carousel> -->
      </q-card-section>
      <q-card-section v-if="styleType === 'full'" style="clear:both; max-width:900px">
        <div class="text-h5 text-center vertical-top"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title }}</router-link></div>
        <render :input="post.body" v-if="post.body" />
        <render :input="summary" v-else />
      </q-card-section>
      <q-separator />
      <q-card-section dense class="text-center">
          <q-btn color="blue-grey" icon="push_pin" v-if="post.stats && post.stats.is_pinned" label="Pinned" flat dense />
          <router-link :to="linkAccount(post.author)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(post.author)" /></q-avatar> {{ post.author }}</router-link>
          <router-link :to="linkCommunity(post.community)"><q-chip color="blue-grey" dense v-if="post.community_title"><q-avatar><img :src="getHiveAvatarUrl(post.community)" size=""></q-avatar> {{ post.community_title }}</q-chip></router-link>
          <q-chip color="blue-grey-10" dense v-if="post.author_role">{{ post.author_role }}</q-chip>
          <span v-if="post.author_title" class="text-caption">{{ post.author_title }}</span>
          <span class="text-caption text-center text-grey">  {{ timeDelta(post.created) }}</span>
          <q-btn dense icon="comment" flat color="blue-grey" :label="post.children">
            <q-popup-proxy>
              <commentBox :parent_author="post.author" :parent_permlink="post.permlink" />
            </q-popup-proxy>
          </q-btn>
          <q-btn flat dense>
            <q-icon name="img:statics/hive.svg" color="secondary" class="q-mr-sm" v-if="!post.token" />
            <span title="Hive Rewards" v-if="!post.is_paidout && post.pending_payout_value">{{ post.pending_payout_value.split(' ')[0] }}</span>
            <span title="Token Rewards" v-else-if="!post.is_paidout && post.pending_token && post.precision">{{ post.pending_token / Math.pow(10, post.precision) }} {{ post.token }}</span>
            <span title="Hive Rewards" v-else>{{ post.payout }}</span>
          </q-btn>
          <vote v-on:Voted="showVoteEarly" :votes="post.active_votes" :author="post.author" :permlink="post.permlink" />
          <q-btn dense icon="more_horiz" flat color="grey">
            <q-popup-proxy>
              <q-list>
                <q-item>
                  <reblog :author="post.author" :permlink="post.permlink" />
                </q-item>
              </q-list>
            </q-popup-proxy>
          </q-btn>
      </q-card-section>
    </q-card>
    </transition>
    </div>
</template>
<style>
.postPreviewCard { max-width: 100%; margin:auto }
</style>
<script>
import sanitize from 'sanitize-html'
import commentBox from 'components/commentBox.vue'
import moment from 'moment'
import vote from 'components/vote.vue'
import reblog from 'components/reblog.vue'
import render from 'components/render.vue'
import { postBodySummary, catchPostImage } from '@ecency/render-helper'
export default {
  name: 'postPreview',
  props: ['post', 'styleType'],
  data () {
    return {
      thumbslide: 0,
      postImage: catchPostImage(this.post),
      votedWeight: null
    }
  },
  components: { vote, commentBox, reblog, render },
  watch: {
    post: {
      deep: true,
      handler () {
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
    summary: function () {
      if (this.post.desc) {
        return postBodySummary(this.post.desc, 650)
      } else {
        return postBodySummary(this.post, 650)
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
    linkAccount (account) { return '/@' + account },
    linkCommunity (community) { return '/c/' + community + '/created' }
  }
}
</script>
