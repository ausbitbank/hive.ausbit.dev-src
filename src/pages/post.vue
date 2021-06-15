<template>
  <q-page class="flex flex-center">
    <account-header v-if="globalProps !== undefined && account !== undefined" :globalProps="this.globalProps" :account="this.account" :showBalances="false" :showNavBar="false" class="full-width" />
    <div v-if="post !== null" class="row items-start content-start justify-center q-pa-sm" style="max-width:1000px">
      <div class="col-xs-11 col-md-9 col-lg-9 justify-center">
        <q-card flat bordered class="q-pa-sm" style="margin:auto">
          <q-card-section class="text-h5 text-center" v-if="post.title">
            {{ Sanitize(post.title) }}
          </q-card-section>
          <q-card-section v-if="post.parent_author !== ''">
            Reply to <router-link :to="linkAccount(post.parent_author)">{{ post.parent_author }}</router-link> / <router-link :to="linkPost(post.parent_author, post.parent_permlink)">{{ post.parent_permlink }}</router-link>
          </q-card-section>
          <q-card-section v-if="post.body">
            <transition appear enter-active-class="animated bounceInUp" leave-active-class="animated bounceOutDown">
            <render :input="post.body" class="postbody" />
            </transition>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-sm-11 col-md-3 col-lg-3 text-center justify-center" v-if="post">
        <transition appear enter-active-class="animated bounceInRight" leave-active-class="animated bounceOutRight">
        <q-card dense flat bordered class="q-pa-none q-ma-none" style="min-width: 300px">
          <q-card-section>
            <q-list dense separator>
              <q-item>
                <q-item-section avatar>
                <q-avatar>
                    <q-img :src="GetHiveAvatarUrl(author)" />
                </q-avatar>
                <q-avatar v-if="postMeta.author && (postMeta.author !== author)">
                    <q-img :src="GetHiveAvatarUrl(postMeta.author)" />
                </q-avatar>
                </q-item-section>
                <q-item-section>
                  <div>Posted by <router-link :to="linkAccount(author)">{{ author }}</router-link></div>
                  <div v-if="postMeta.author && (postMeta.author !== author) ">Authored by <router-link :to="linkAccount(postMeta.author)">{{ postMeta.author }}</router-link></div>
                </q-item-section>
              </q-item>
              <q-item v-if="postDescription">
                <q-item-section>
                  <span>{{ postDescription }}</span>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="history" color="blue-grey"/>
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  Posted {{ timeDelta(post.created) }}
                </q-item-section>
              </q-item>
              <q-item v-if="post.last_update !== post.created">
                <q-item-section avatar>
                    <q-icon name="create" color="red" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  <a :href="GetEditHistoryUrl(post.author, post.permlink)" target="_blank">Edited {{ timeDelta(post.last_update) }}</a>
                </q-item-section>
              </q-item>
              <q-item v-if="post.pending_payout_value !== '0.000 HBD' || post.total_payout_value !== '0.000 HBD'">
                <q-item-section avatar>
                  <q-icon name="monetization_on" color="green"/>
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
              <q-item v-if="post.max_accepted_payout === '0.000 HBD'">
                <q-item-section avatar>
                  <q-icon name="money_off" color="grey" />
                </q-item-section>
                <q-item-section caption class="text-caption">
                  Author declined payout on this post
                </q-item-section>
              </q-item>
              <q-item v-if="post.percent_hbd === 0">
                <q-item-section avatar>
                  <q-icon name="offline_bolt" title="100% Power Up Post" color="yellow" />
                </q-item-section>
                <q-item-section caption class="text-caption">
                  Rewards 100% powered up
                </q-item-section>
              </q-item>
              <q-item v-if="parseInt(post.max_accepted_payout.split(' ')[0]) < 100">
                <q-item-section avatar>
                  <q-icon name="money_off" title="Rewards capped" color="yellow" />
                </q-item-section>
                <q-item-section caption class="text-caption">
                  Author rewards capped at {{ post.max_accepted_payout }}
                </q-item-section>
              </q-item>
              <q-item v-if="post.beneficiaries.length > 0">
                <q-item-section avatar>
                  <q-icon name="alt_route" title="Sharing payout with" color="purple" />
                </q-item-section>
                <q-item-section v-for="bene in post.beneficiaries" :key="bene.index">
                  <router-link :to="linkAccount(bene.account)">{{ bene.account }}</router-link>{{ bene.weight / 100}} %
                </q-item-section>
              </q-item>
              <q-item v-if="post.community && post.community_title" title="Community">
                <q-item-section avatar>
                    <q-icon name="label_important" color="amber" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  {{ post.community_title }} Community
                </q-item-section>
              </q-item>
              <q-item v-else-if="post.category" title="Category">
                <q-item-section avatar>
                    <q-icon name="label_important" color="orange"/>
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  <router-link :to="linkDetect(post.category)">{{ post.category }}</router-link>
                </q-item-section>
              </q-item>
              <q-item v-if="postMeta && postMeta.tags && postMeta.tags.length > 0" title="Tags">
                <q-item-section avatar>
                    <q-icon name="label" color="primary" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  <router-link v-for="tag in postMeta.tags" :key="tag.index" :to="linkTag(tag)">{{ tag }}</router-link>
                </q-item-section>
              </q-item>
              <q-item v-if="postMeta && postMeta.app" title="App">
                <q-item-section avatar>
                  <q-icon name="fingerprint" color="brown" />
                </q-item-section>
                <q-item-section>
                  {{ postMeta.app }}
                </q-item-section>
              </q-item>
              <q-item v-if="postMeta && postMeta.countdown">
                <q-item-section avatar>
                  <q-icon name="alarm_on" color="gray" />
                </q-item-section>
                <q-item-section>
                  Countdown to {{ postMeta.countdown }}<br />
                  ( {{ timeDelta(postMeta.countdown )}} )
                </q-item-section>
              </q-item>
              <q-item title="Votes">
                <q-item-section avatar>
                  <q-icon name="thumbs_up_down" color="purple" title="View voter information" class="cursor-hand" @click="showVotes = true" />
                </q-item-section>
                <q-item-section v-if="loggedInUser && postPastPayout" class="text-caption">
                  <div>This post is past its payout window.</div>
                  <div>You can still vote, but it will not affect rewards.</div>
                </q-item-section>
                <q-item-section v-if="loggedInUser">
                  <vote v-on:Voted="init()" :author='author' :permlink="permlink" :votes="this.post.active_votes"/>
                </q-item-section>
                <q-item-section v-else>
                  Login to vote
                </q-item-section>
                <q-dialog v-model="showVotes">
                  <votes-dialog :votes="post.active_votes" />
                </q-dialog>
              </q-item>
              <q-item>
                <tip-button :account="post.author" style="width: 100%" />
              </q-item>
              <q-item v-if="loggedInUser">
                <q-item-section avatar>
                  <q-icon name="share" color="secondary" />
                </q-item-section>
                <q-item-section>
                  <reblog :author="post.author" :permlink="post.permlink" />
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="share" color="orange" />
                </q-item-section>
                <q-item-section>
                  <q-btn rounded flat @click="showShareDialog = !showShareDialog">
                    Share this post:
                  </q-btn>
                  <shareButtons :title="post.title" v-if="showShareDialog" />
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="code" color="blue" />
                </q-item-section>
                <q-item-section>
                  <q-btn label="Full Post Metadata" @click="showFullPostMetadata = !showFullPostMetadata" rounded flat />
                  <q-dialog v-model="showFullPostMetadata">
                    <div class="bg-dark">
                      <json-viewer :data="post" :deep="1" title="Post json_metadata" />
                    </div>
                  </q-dialog>
                </q-item-section>
              </q-item>
              <q-item>
                <q-btn icon="comment" label="Reply" v-if="this.loggedInUser" push color="blue-grey-10" class="text-center" style="margin: auto"><q-popup-proxy persistent><commentBox :parent_author="post.author" :parent_permlink="post.permlink" /></q-popup-proxy></q-btn>
              </q-item>
            </q-list>
          </q-card-section>
          <q-card-section>
            View on <a :href="linkHiveBlogPost(author, permlink)">Hive.blog</a>, <a :href="linkPeakdPost(author, permlink)">Peakd</a>, <a :href="linkEcencyPost(author, permlink)">Ecency</a>
          </q-card-section>
        </q-card>
        </transition>
      </div>
      <div class="q-md-md" style="margin: auto"><comments :author="post.author" :permlink="post.permlink" v-if="post.children > 0" /></div>
      <transition appear enter-active-class="animated bounceInDown" leave-active-class="animated bounceOutDown">
          <recent-posts-carousel :account="author" :autoplay=true />
      </transition>
    </div>
  </q-page>
</template>
<style scoped>
.postview img { display:block; margin-left:auto; margin-right: auto; width: 50% }
a, a:link { color: #1d8ce0 }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
h1, h2, h3, h4, h5, h6 {font-size: 1em; font-weight: 500 }

</style>
<script>
import render from 'components/render.vue'
// import { renderPostBody } from '@ecency/render-helper'
import accountHeader from 'components/accountHeader.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import comments from 'components/comments.vue'
import commentBox from 'components/commentBox.vue'
import moment from 'moment'
import vote from 'components/vote.vue'
import jsonViewer from 'components/jsonViewer.vue'
import tipButton from 'components/tipButton.vue'
import shareButtons from 'components/shareButtons.vue'
import sanitize from 'sanitize-html' // eslint-disable-line no-unused-vars
import reblog from 'components/reblog.vue'
import votesDialog from 'components/votesDialog.vue'
export default {
  name: 'postView',
  components: { render, recentPostsCarousel, comments, vote, jsonViewer, tipButton, accountHeader, commentBox, shareButtons, reblog, votesDialog },
  data () {
    return {
      post: null,
      author: this.$router.currentRoute.params.author,
      permlink: this.$router.currentRoute.params.permlink,
      showVotes: false,
      showShareDialog: false,
      postBody: null,
      postDescription: null,
      showFullPostMetadata: false
    }
  },
  watch: {
    $route (to, from) {
      this.init()
    }
  },
  computed: {
    account: {
      get () {
        return this.$store.state.hive.accounts[this.author]
      }
    },
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
    },
    postMeta: function () {
      if (this.post.json_metadata) {
        return JSON.parse(this.post.json_metadata)
      } else {
        return null
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
      if (post.description) { this.postDescription = this.Sanitize(post.description) }
    },
    linkHiveBlogPost (author, permlink) {
      return 'https://hive.blog/@' + author + '/' + permlink
    },
    linkPeakdPost (author, permlink) {
      return 'https://peakd.com/@' + author + '/' + permlink + '?ref=ausbitbank'
    },
    linkEcencyPost (author, permlink) {
      return 'https://ecency.com/@' + author + '/' + permlink
    },
    linkAccount (username) {
      return '/@' + username
    },
    linkPost (author, permlink) {
      return '/@' + author + '/' + permlink
    },
    linkCommunity (community) {
      return '/c/' + community + '/trending'
    },
    linkTag (tag) {
      return '/trending/' + tag
    },
    linkDetect (link) {
      if (link.startsWith('hive-')) {
        return this.linkCommunity(link)
      } else {
        return this.linkTag(link)
      }
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    GetEditHistoryUrl (author, permlink) { return 'https://scribe.hivekings.com/?url=https%3A%2F%2Fhive.blog%2F%40' + author + '%2F' + permlink },
    Sanitize (input) { return sanitize(input) },
    init () {
      this.post = null
      this.author = this.$router.currentRoute.params.author
      this.permlink = this.$router.currentRoute.params.permlink
      this.getPost(this.author, this.permlink)
    },
    delayedInit () {
      setTimeout(this.init(), 6000)
    }
  },
  mounted () {
    this.init()
  }
}
</script>
