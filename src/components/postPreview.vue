<template>
    <div>
    <div v-if="post.reblogged_by && this.$route.path.endsWith('feed')" class="text-center">
      <span class="text-bold">Reblogged By: </span>
      <span v-for="reblogger in post.reblogged_by" :key="reblogger.index"><router-link :to="getAccountLink(reblogger)"><q-avatar class="q-ma-sm" size="sm"><img :src="getHiveAvatarUrl(reblogger)"></q-avatar> {{ reblogger }}</router-link> </span>
    </div>
    <transition appear enter-active-class="animated bounceInUp" leave-active-class="animated bounceOutDown">
    <q-card class="postPreviewCard q-ma-xs" dark dense bordered v-if="post">
      <q-card-section horizontal v-if="styleType === 'preview'">
        <q-card-section v-if="postImage && $q.screen.gt.sm">
            <!-- <router-link :to="returnPostPath(post.author, post.permlink)"> -->
              <q-img style="width: 200px; height: 200px" :src="postImage" :title="post.title" @click="postOverlay = true" />
            <!-- </router-link> -->
        </q-card-section>
        <q-separator vertical v-if="postImage" />
        <q-item>
            <q-item-section>
                <q-item-label>
                    <div class="text-h6 vertical-top text-center"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,100) }}</router-link></div>
                    <span v-if="$q.screen.gt.xs"><render :input="this.summary" /></span>
                    <div style="margin:auto; text-align:center" v-if="$q.screen.lt.md">
                    <router-link :to="returnPostPath(post.author, post.permlink)">
                      <q-img style="width: 200px; height: 200px" :src="postImage" :title="post.title" />
                    </router-link>
                    </div>
                </q-item-label>
            </q-item-section>
        </q-item>
      </q-card-section>
      <q-card-section v-if="styleType === 'media'" class="text-center" style="width: 100%">
        <div class="text-h6"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title.substr(0,100) }}</router-link></div>
        <!-- <router-link v-if="postImage" :to="returnPostPath(post.author, post.permlink)"> -->
          <!-- <q-img style="width: 300px; height: 300px" :src="postImage" :title="post.title" v-if="postImage" @click="postOverlay = true" /> -->
        <!-- </router-link> -->
      <q-carousel
        v-if="postImages.length > 1"
        v-model="thumbslide"
        transition-prev="jump-left"
        transition-next="jump-right"
        swipeable
        animated
        control-color="primary"
        padding
        arrows
        infinite
        navigation
        :autoplay="autoplaySlides"
        @mouseenter="autoplaySlides = false"
        class="rounded-borders"
        :fullscreen.sync="fullscreen"
      >
        <q-carousel-slide class="column no-wrap flex-center" v-for="image in postImages" :key="image" :name="image" :img-src="image" />
        <template v-slot:control>
          <q-carousel-control position="bottom-right" :offset="[18, 18]" >
          <q-btn push round dense color="dark" text-color="primary" :icon="fullscreen ? 'fullscreen_exit' : 'fullscreen'" @click="fullscreen = !fullscreen" />
          </q-carousel-control>
        </template>
      </q-carousel>
      <q-img v-if="postImages.length === 1" :src="postImages[0]" />
        <div>
          <span class="text-caption" v-if="postMeta.description"><render :input="postMeta.description.substr(0,200)" /></span>
          <span class="text-caption" v-else-if="summary"><render :input="summary.substr(0,200)" /></span>
          <span class="text-caption" v-else><render :input="post.body.substr(0,200)" /></span>
        </div>
      </q-card-section>
      <q-card-section v-if="styleType === 'full'" class="postPreviewCard" style="clear:both; max-width:900px">
        <div class="text-h5 text-center vertical-top"><router-link :to="returnPostPath(post.author, post.permlink)">{{ post.title }}</router-link></div>
        <render :input="post.body" v-if="post.body" />
        <render :input="summary" v-else />
      </q-card-section>
      <q-dialog v-model="postOverlay" class="postPreviewCard">
        <postDialog :post="post" />
      </q-dialog>
      <q-separator />
      <postFooter :post="post" />
    </q-card>
    </transition>
    </div>
</template>
<style>
.postPreviewCard { word-wrap:break-word; word-break: break-word; width: 100% }
</style>
<script>
import sanitize from 'sanitize-html'
import moment from 'moment'
import { postBodySummary, catchPostImage } from '@ecency/render-helper'
export default {
  name: 'postPreview',
  props: ['post', 'styleType'],
  data () {
    return {
      thumbslide: null,
      postImage: catchPostImage(this.post),
      votedWeight: null,
      postOverlay: false,
      autoplaySlides: true,
      fullscreen: false
    }
  },
  components: {
    render: () => import('components/render.vue'),
    postFooter: () => import('components/postFooter.vue'),
    postDialog: () => import('components/postDialog.vue')
  },
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
    },
    postImages: function () {
      if (this.post && this.postMeta && this.postMeta.image) {
        return this.postMeta.image
      } else {
        return []
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
  },
  mounted () {
    if (this.postImages.length > 0) {
      this.thumbslide = this.postImages[0]
    }
  }
}
</script>
