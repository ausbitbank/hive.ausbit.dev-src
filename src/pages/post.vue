<template>
  <q-page class="post-page flex">
    <account-header v-if="globalProps !== undefined && account !== undefined" :globalProps="globalProps" :account="account" :showBalances="false" :showNavBar="true" headingTag="div" class="full-width" style="overflow:hidden" />
    <div class="post-error" v-if="error !== null">
      <q-card class="q-pa-md text-center" bordered>
        <q-icon name="error" size="lg" color="orange" /><br />
        <b>{{ error.name }} : {{ error.message }}</b><br />
        {{ error.data }}
        <q-card-section v-if="error.cause.code === -31999 && error.cause.data.startsWith('Post ')">
          <q-btn label="Find the transaction" @click="findDeletedPost(error.data)" color="primary" icon="search" />
        </q-card-section>
      </q-card>
    </div>
    <div class="row items-start content-start justify-center post-layout">
      <div class="col-xs-11 col-md-9 col-lg-9 justify-center items-start post-main" v-if="post">
        <q-card flat bordered class="post-article">
          <q-card-section class="post-title-section" v-if="post.title">
            <h1 class="post-title">{{ stripHtml(post.title) }}</h1>
          </q-card-section>
          <q-card-section class="post-reply-to" v-if="post.parent_author !== ''">
            Reply to <router-link :to="linkAccount(post.parent_author)">{{ post.parent_author }}</router-link> / <router-link :to="linkPost(post.parent_author, post.parent_permlink)">{{ post.parent_permlink }}</router-link>
          </q-card-section>
          <q-card-section class="post-body-section" v-if="post.body">
            <render :input="post.body" class="postbody" />
          </q-card-section>
          <q-card-section v-else>
            <q-skeleton type="rect" height="200px" width="200" />
          </q-card-section>
        </q-card>
      </div>
      <div v-else>
        <q-skeleton type="text" height="100" />
      </div>
      <div class="col-sm-11 col-md-3 col-lg-3 text-center justify-center items-start">
        <q-card dense flat bordered class="post-sidebar q-pa-none q-ma-none" v-if="post">
          <q-card-section>
            <q-list dense separator>
              <q-item>
                <q-item-section avatar>
                <q-avatar size="sm">
                    <q-img :src="GetHiveAvatarUrl(author)" :alt="'Avatar of @' + author" />
                </q-avatar>
                <q-avatar v-if="postMeta.author && (postMeta.author !== author)"  size="sm" class="q-pt-xs q-mb-xs">
                    <q-img :src="GetHiveAvatarUrl(postMeta.author)" :alt="'Avatar of @' + postMeta.author" />
                </q-avatar>
                </q-item-section>
                <q-item-section>
                  <div>Posted by <router-link :to="linkAccount(author)">{{ author }}</router-link></div>
                  <div v-if="postMeta.author && (postMeta.author.toLowerCase() !== author.toLowerCase()) ">Authored by <router-link :to="linkAccount(postMeta.author)">{{ postMeta.author }}</router-link></div>
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
                  {{ timeDelta(post.created) }}
                </q-item-section>
              </q-item>
              <q-item v-if="post.last_update !== post.created">
                <q-item-section avatar>
                    <q-icon name="create" color="red" />
                </q-item-section>
                <q-item-section class="text-caption text-grey">
                  <span>Edited {{ timeDelta(post.last_update) }}</span>
                </q-item-section>
              </q-item>
              <q-item title="Votes">
                <q-item-section avatar>
                  <q-btn flat dense round icon="thumbs_up_down" color="purple" aria-label="View voter information" title="View voter information" class="cursor-hand" @click="showVotes = true" />
                </q-item-section>
                <q-item-section v-if="loggedInUser && postPastPayout" class="text-caption">
                  <div>This post is past its payout window.</div>
                  <div>You can still vote, but it will not affect rewards.</div>
                </q-item-section>
                <q-item-section v-if="loggedInUser">
                  <vote v-on:Voted="init()" :author='author' :permlink="permlink" :votes="post.active_votes"/>
                </q-item-section>
                <q-item-section v-else>
                  Login to vote
                </q-item-section>
                <q-dialog v-model="showVotes">
                  <votes-dialog :votes="post.active_votes" />
                </q-dialog>
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
              <q-item v-if="true">
                <q-item-section avatar>
                  <q-icon name="code" color="blue" />
                </q-item-section>
                <q-item-section>
                  <q-btn label="Full Post Metadata" rounded flat>
                  <q-popup-proxy>
                    <q-card dense flat bordered>
                      <json-viewer :data="post" :deep="1" title="Post json_metadata" />
                    </q-card>
                  </q-popup-proxy>
                  </q-btn>
                </q-item-section>
              </q-item>
              <q-item>
                <q-btn icon="comment" label="Reply" v-if="loggedInUser" push color="blue-grey-10" class="text-center" style="margin: auto"><q-popup-proxy persistent><commentBox :parent_author="post.author" :parent_permlink="post.permlink" /></q-popup-proxy></q-btn>
              </q-item>
            </q-list>
          </q-card-section>
          <q-card-section>
            View on <a :href="linkHiveBlogPost(author, permlink)">Hive.blog</a>, <a :href="linkPeakdPost(author, permlink)">Peakd</a>, <a :href="linkEcencyPost(author, permlink)">Ecency</a>
          </q-card-section>
        </q-card>
        <q-card v-else>
          <q-skeleton type="rect" height="200" width="200" />
        </q-card>
      </div>
      <div class="post-comments col-xs-12 col-md-12" v-if="post && post.children > 0">
        <comments :author="post.author" :permlink="post.permlink" />
      </div>
      <transition appear enter-active-class="animated bounceInDown" leave-active-class="animated bounceOutDown" v-if="false">
          <recent-posts-carousel v-if="post" :account="author" :autoplay=true />
      </transition>
    </div>
  </q-page>
</template>
<style scoped>
.post-page {
  min-width: 0;
}
.post-layout {
  width: 100%;
  max-width: 1000px;
  min-width: 0;
  margin: auto;
  padding: 0 0.25rem 2rem;
}
.post-main {
  min-width: 0;
  padding: 0 0.25rem;
}
.post-article {
  width: 100%;
  margin: auto;
  overflow: hidden;
}
.post-title-section {
  padding: 1.35rem 1rem 0.6rem;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.09));
}
.post-title {
  margin: 0;
  font-size: clamp(1.35rem, 2.4vw, 1.85rem);
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: center;
  overflow-wrap: anywhere;
}
.post-reply-to {
  padding-top: 0.6rem;
  padding-bottom: 0.6rem;
  font-size: 0.82rem;
  color: #b0bec5;
}
.post-body-section {
  padding: 1.1rem 1.15rem 1.5rem;
}
.post-sidebar {
  width: 100%;
  min-width: 0;
  margin: 0 auto !important;
  overflow: hidden;
}
.post-sidebar :deep(.q-list .q-item) {
  padding-top: 8px;
  padding-bottom: 8px;
}
.post-error {
  margin: auto;
  padding: 1rem;
}
.post-comments {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto 1.5rem;
  padding: 0 0.25rem;
}
@media (max-width: 1023px) {
  .post-article {
    margin-bottom: 1rem;
  }
  .post-body-section {
    padding: 0.9rem 0.85rem 1.25rem;
  }
}
</style>
<script>
import render from 'components/render.vue'
// import { renderPostBody } from '@ecency/render-helper'
import accountHeader from 'components/accountHeader.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
import comments from 'components/comments.vue'
import commentBox from 'components/commentBox.vue'
import moment from 'src/utils/time'
import vote from 'components/vote.vue'
import jsonViewer from 'components/jsonViewer.vue'
import tipButton from 'components/tipButton.vue'
import shareButtons from 'components/shareButtons.vue'
import { stripHtml } from 'src/utils/safeHtml'
import reblog from 'components/reblog.vue'
import votesDialog from 'components/votesDialog.vue'
import { setPageMeta, stripHtml as stripHtmlForMeta, BASE_URL, SITE_NAME } from 'src/utils/pageMeta'
export default {
  name: 'postView',
  components: { render, recentPostsCarousel, comments, vote, jsonViewer, tipButton, accountHeader, commentBox, shareButtons, reblog, votesDialog },
  data () {
    return {
      post: null,
      author: this.$route.params.author,
      permlink: this.$route.params.permlink,
      showVotes: false,
      showShareDialog: false,
      postBody: null,
      postDescription: null,
      showFullPostMetadata: false,
      error: null
    }
  },
  watch: {
    $route () {
      this.init()
    }
  },
  computed: {
    errorShown: function () { if (this.error !== null) { return true } else { return false } },
    globalProps: function () { return this.$hiveStore.globalProps },
    account: {
      get () {
        return this.$hiveStore.accounts[this.author]
      }
    },
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
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
        .then(post => { this.error = null; this.setPost(post) })
        .catch(error => { this.error = error; console.error(error) })
    },
    setPost (post) {
      this.post = post
      this.updatePageMeta(post)
      if (post.description) { this.postDescription = stripHtml(post.description) }
    },
    getPostMeta (post) {
      if (!post || !post.json_metadata) return {}
      try {
        const metadata = JSON.parse(post.json_metadata)
        return metadata && typeof metadata === 'object' ? metadata : {}
      } catch {
        return {}
      }
    },
    updatePageMeta (post) {
      const author = (post && post.author) || this.author
      const permlink = (post && post.permlink) || this.permlink
      const metadata = this.getPostMeta(post)
      const title = post && post.title ? stripHtmlForMeta(post.title, 120) : ''
      const pageTitle = title || ('Hive post by @' + author)
      const body = post && post.body ? stripHtmlForMeta(post.body.slice(0, 4000), 160) : ''
      const description = body || ('Read @' + author + "'s post on the Hive blockchain — blocks, accounts, posts and tools at hive.ausbit.dev.")
      const image = Array.isArray(metadata.image) ? metadata.image[0] : metadata.image
      const pageUrl = BASE_URL + '/@' + author + '/' + permlink
      const jsonLd = post
        ? {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title || pageTitle,
            description,
            ...(typeof image === 'string' && image ? { image: [image] } : {}),
            datePublished: post.created || undefined,
            dateModified: post.last_update || post.created || undefined,
            author: { '@type': 'Person', name: '@' + author, url: BASE_URL + '/@' + author },
            publisher: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
            mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
            url: pageUrl
          }
        : null
      setPageMeta({
        title: pageTitle,
        description,
        image: typeof image === 'string' ? image : undefined,
        url: '/@' + author + '/' + permlink,
        type: 'article',
        jsonLd
      })
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
    stripHtml,
    init () {
      this.post = null
      this.author = this.$route.params.author
      this.permlink = this.$route.params.permlink
      this.updatePageMeta(null)
      if (this.author) this.$hiveStore.getAccount(this.author)
      this.getPost(this.author, this.permlink)
    },
    delayedInit () {
      setTimeout(this.init(), 6000)
    },
    findDeletedPost (data) {
      var author = data.split(' ')[1].split('/')[0]
      var link = '/@' + author + '?filter=comment,delete_comment'
      this.$router.push({ path: link })
    }
  },
  mounted () {
    this.init()
  }
}
</script>
