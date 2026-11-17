<template>
  <q-page class="post-page">
    <div class="post-shell">
      <div class="post-error" v-if="error !== null">
        <q-card flat bordered class="post-state-card">
          <q-icon name="error_outline" size="2.2em" color="orange" aria-hidden="true" />
          <h1 class="post-state-card__title">Post not available</h1>
          <p class="post-state-card__text">{{ error.name }}: {{ error.message }}</p>
          <p v-if="error.data" class="post-state-card__text">{{ error.data }}</p>
          <q-btn
            v-if="error.cause && error.cause.code === -31999 && typeof error.cause.data === 'string' && error.cause.data.startsWith('Post ')"
            class="q-mb-md"
            label="Find the transaction"
            color="primary"
            icon="search"
            no-caps
            @click="findDeletedPost(error.data)"
          />
          <div class="row q-gutter-sm justify-center">
            <q-btn outline no-caps color="primary" icon="arrow_back" label="Back to browse" to="/browse" />
            <q-btn flat no-caps color="primary" icon="refresh" label="Retry" @click="init" />
          </div>
        </q-card>
      </div>

      <div v-else-if="!post" class="post-loading" aria-label="Loading post">
        <q-skeleton type="rect" height="30px" width="68%" />
        <q-skeleton type="rect" height="16px" width="42%" class="q-mt-md" />
        <q-skeleton type="rect" height="16px" width="30%" class="q-mt-sm" />
        <q-skeleton type="rect" height="380px" class="q-mt-lg" />
      </div>

      <div v-else class="post-grid">
        <main class="post-main">
          <article class="post-article">
            <q-card flat bordered class="post-article-card">
              <header class="post-hero">
                <div class="post-hero__eyebrow">
                  <router-link v-if="communityTitle" :to="linkCommunity(communityName)">
                    {{ communityTitle }}
                  </router-link>
                  <router-link v-else-if="post.category" :to="linkDetect(post.category)">
                    {{ post.category }}
                  </router-link>
                  <span class="post-hero__dot">·</span>
                  <time :datetime="post.created">{{ formattedCreated }}</time>
                  <template v-if="isEdited">
                    <span class="post-hero__dot">·</span>
                    <span class="post-hero__muted">edited {{ timeDelta(post.last_update) }}</span>
                  </template>
                </div>

                <h1 class="post-hero__title">{{ stripHtml(post.title) || ('Comment by @' + author) }}</h1>

                <div class="post-reply-to" v-if="post.parent_author">
                  Reply to
                  <router-link :to="linkAccount(post.parent_author)">{{ post.parent_author }}</router-link> /
                  <router-link :to="linkPost(post.parent_author, post.parent_permlink)">{{ post.parent_permlink }}</router-link>
                </div>

                <div class="post-hero__meta">
                  <router-link :to="linkAccount(author)" class="post-author">
                    <q-avatar size="32px">
                      <q-img :src="GetHiveAvatarUrl(author)" :alt="'Avatar of @' + author" />
                    </q-avatar>
                    <span class="post-author__name">@{{ author }}</span>
                    <span class="post-author__rep" :title="'Reputation ' + reputation">{{ reputation }}</span>
                  </router-link>
                  <span class="post-hero__dot">·</span>
                  <span>{{ readingTime }} min read</span>
                  <span class="post-hero__dot">·</span>
                  <span>{{ tidyNumber(wordCount) }} words</span>
                  <span class="post-hero__dot">·</span>
                  <button type="button" class="post-hero__linkbtn" @click="scrollToComments">{{ commentCount }} comments</button>
                  <template v-if="reblogCount">
                    <span class="post-hero__dot">·</span>
                    <span>{{ reblogCount }} reblogs</span>
                  </template>
                </div>

                <div class="post-hero__actions">
                  <vote
                    v-if="loggedInUser"
                    :author="author"
                    :permlink="permlink"
                    :votes="post.active_votes"
                    @Voted="refreshPost"
                  />
                  <q-btn
                    v-else
                    flat
                    dense
                    no-caps
                    icon="thumb_up_off_alt"
                    :label="voteCount + ' votes'"
                    @click="showVotes = true"
                  />
                  <q-btn v-if="loggedInUser" flat dense no-caps icon="comment" label="Reply" @click="showReply = true" />
                  <q-btn flat dense no-caps icon="share" label="Share" @click="showShareDialog = true" />
                  <reblog v-if="loggedInUser" :author="author" :permlink="permlink" />
                </div>
              </header>

              <div class="post-body-section">
                <render v-if="post.body" :input="post.body" class="postbody" />
                <q-skeleton v-else type="rect" height="220px" />
              </div>

              <footer v-if="postTags.length" class="post-tags" aria-label="Post tags">
                <router-link v-for="tag in postTags" :key="tag" :to="linkTag(tag)" class="post-tag">#{{ tag }}</router-link>
              </footer>
            </q-card>
          </article>

          <comments :author="author" :permlink="permlink" :comment-count="commentCount" />
        </main>

          <aside class="post-sidebar" aria-label="Post information">
            <q-card flat bordered class="post-side-card post-author-card">
              <q-card-section>
                <div class="post-author-card__top">
                  <q-avatar size="54px">
                    <q-img :src="GetHiveAvatarUrl(author)" :alt="'Avatar of @' + author" />
                  </q-avatar>
                  <div class="post-author-card__ident">
                    <router-link :to="linkAccount(author)" class="post-author-card__name">@{{ author }}</router-link>
                    <span class="post-author-card__rep">Reputation {{ reputation }}</span>
                  </div>
                </div>
                <p v-if="authorAbout" class="post-author-card__about">{{ authorAbout }}</p>
                <q-btn outline no-caps color="primary" icon="person" label="Open profile" :to="linkAccount(author)" class="full-width q-mt-sm" />
              </q-card-section>
            </q-card>

            <q-card flat bordered class="post-side-card">
              <q-card-section>
                <h2 class="post-side-card__title">Post details</h2>
                <div class="post-detail">
                  <q-icon name="calendar_today" aria-hidden="true" />
                  <span>Published <time :datetime="post.created">{{ formattedCreated }}</time></span>
                </div>
                <div class="post-detail" v-if="isEdited">
                  <q-icon name="edit" aria-hidden="true" />
                  <span>Edited {{ timeDelta(post.last_update) }}</span>
                </div>
                <div class="post-detail" v-if="communityTitle">
                  <q-icon name="forum" aria-hidden="true" />
                  <router-link :to="linkCommunity(communityName)">{{ communityTitle }}</router-link>
                </div>
                <div class="post-detail" v-if="post.category && post.category !== communityName">
                  <q-icon name="label" aria-hidden="true" />
                  <router-link :to="linkDetect(post.category)">{{ post.category }}</router-link>
                </div>
                <div class="post-detail" v-if="postMeta && postMeta.app">
                  <q-icon name="fingerprint" aria-hidden="true" />
                  <span>{{ postMeta.app }}</span>
                </div>
                <button type="button" class="post-detail post-detail--button" @click="showVotes = true">
                  <q-icon name="thumb_up" aria-hidden="true" />
                  <span>{{ voteCount }} votes</span>
                </button>
                <div class="post-detail" v-if="payoutDisplay">
                  <q-icon name="monetization_on" aria-hidden="true" />
                  <span>{{ payoutDisplay }}</span>
                </div>
                <div class="post-detail" v-if="postPastPayout && loggedInUser">
                  <q-icon name="schedule" aria-hidden="true" />
                  <span>Payout window ended</span>
                </div>
                <div class="post-detail" v-if="post.max_accepted_payout === '0.000 HBD'">
                  <q-icon name="money_off" aria-hidden="true" />
                  <span>Author declined payout</span>
                </div>
                <div class="post-detail" v-if="post.percent_hbd === 0">
                  <q-icon name="bolt" aria-hidden="true" />
                  <span>Rewards 100% powered up</span>
                </div>
                <div class="post-detail" v-if="maxPayoutCapped">
                  <q-icon name="money_off" aria-hidden="true" />
                  <span>Rewards capped at {{ post.max_accepted_payout }}</span>
                </div>
                <div
                  class="post-detail"
                  v-for="bene in post.beneficiaries || []"
                  :key="bene.account + '-' + bene.weight"
                >
                  <q-icon name="alt_route" aria-hidden="true" />
                  <span>@{{ bene.account }} {{ bene.weight / 100 }}%</span>
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="post-side-card">
              <q-card-section class="post-side-card__actions">
                <tip-button :account="post.author" />
                <q-btn outline no-caps color="primary" icon="code" label="Full post metadata">
                  <q-popup-proxy>
                    <q-card class="post-meta-card">
                      <json-viewer :data="post" :deep="1" title="Post metadata" />
                    </q-card>
                  </q-popup-proxy>
                </q-btn>
              </q-card-section>
            </q-card>

            <div class="post-external">
              View on
              <a :href="linkHiveBlogPost(author, permlink)" target="_blank" rel="noopener noreferrer">Hive.blog</a>,
              <a :href="linkPeakdPost(author, permlink)" target="_blank" rel="noopener noreferrer">PeakD</a>,
              <a :href="linkEcencyPost(author, permlink)" target="_blank" rel="noopener noreferrer">Ecency</a>
            </div>
          </aside>
      </div>
    </div>

    <q-dialog v-model="showVotes">
      <votes-dialog v-if="post" :votes="post.active_votes" />
    </q-dialog>

    <q-dialog v-model="showReply">
      <q-card class="post-dialog-card">
        <comment-box
          v-if="post"
          :parent_author="post.author"
          :parent_permlink="post.permlink"
        />
      </q-card>
    </q-dialog>

    <q-dialog v-model="showShareDialog">
      <q-card class="post-share-card">
        <q-card-section>
          <div class="post-share-card__title">Share this post</div>
          <shareButtons v-if="post" :title="post.title" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.post-page {
  min-width: 0;
}

.post-shell {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.post-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  align-items: start;
  gap: var(--space-4);
}

.post-main {
  min-width: 0;
}

.post-article-card {
  overflow: hidden;
}

.post-hero {
  padding: 1.3rem 1.5rem 1rem;
}

.post-hero__eyebrow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: #90a4ae;
  font-size: 0.76rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.post-hero__eyebrow a {
  color: #4fc3f7;
  font-weight: 600;
  text-decoration: none;
}

.post-hero__dot {
  color: #607d8b;
}

.post-hero__muted {
  letter-spacing: 0;
  text-transform: none;
}

.post-hero__title {
  margin: 0.55rem 0 0.7rem;
  font-size: clamp(1.5rem, 3vw, 2.05rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.post-hero__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  color: #b0bec5;
  font-size: 0.85rem;
}

.post-author {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 600;
}

.post-author__name {
  color: #e4eaed;
}

.post-author__rep {
  padding: 0 0.35rem;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  color: #b0bec5;
  font-size: 0.72rem;
  font-weight: 500;
}

.post-hero__linkbtn {
  padding: 0;
  border: 0;
  background: none;
  color: #4fc3f7;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.14em;
}

.post-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.9rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-subtle);
}

.post-body-section {
  padding: 1.25rem 1.5rem 1.6rem;
}

.post-reply-to {
  margin-bottom: 0.7rem;
  color: #b0bec5;
  font-size: 0.82rem;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.8rem 1.5rem 1rem;
  border-top: 1px solid var(--border-subtle);
}

.post-tag {
  padding: 0.12rem 0.5rem;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.06);
  color: #b0bec5 !important;
  font-size: 0.74rem;
  text-decoration: none;
}

.post-tag:hover {
  background: rgba(79, 195, 247, 0.16);
  color: #81d4fa !important;
}

.post-sidebar {
  position: sticky;
  top: 72px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.post-side-card {
  overflow: hidden;
}

.post-author-card__top {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.post-author-card__ident {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.post-author-card__name {
  color: #e4eaed;
  font-size: 0.98rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.post-author-card__rep {
  color: #90a4ae;
  font-size: 0.75rem;
}

.post-author-card__about {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0.7rem 0 0;
  color: #b0bec5;
  font-size: 0.8rem;
  line-height: 1.5;
}

.post-side-card__title {
  margin: 0 0 0.55rem;
  color: #90a4ae;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.post-detail {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.28rem 0;
  color: #b0bec5;
  font-size: 0.82rem;
  line-height: 1.4;
}

.post-detail .q-icon {
  flex: none;
  margin-top: 1px;
  color: #78909c;
}

.post-detail a {
  color: #4fc3f7;
  overflow-wrap: anywhere;
}

.post-detail--button {
  width: 100%;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.post-detail--button:hover {
  color: #e4eaed;
}

.post-side-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.post-side-card__actions :deep(.q-btn) {
  width: 100%;
}

.post-meta-card {
  width: min(720px, 92vw);
  max-height: 80vh;
  overflow: auto;
}

.post-external {
  color: #90a4ae;
  font-size: 0.76rem;
  text-align: center;
}

.post-external a {
  color: #4fc3f7;
}

.post-state-card,
.post-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.post-loading {
  align-items: stretch;
  max-width: 760px;
  margin: 0 auto;
}

.post-state-card__title {
  margin: 0;
  font-size: 1.35rem;
}

.post-state-card__text {
  margin: 0;
  color: #b0bec5;
  overflow-wrap: anywhere;
}

.post-error {
  max-width: 680px;
  margin: 2rem auto;
}

.post-dialog-card {
  width: min(720px, 94vw);
}

.post-share-card {
  width: min(540px, 94vw);
}

.post-share-card__title {
  margin-bottom: var(--space-2);
  font-weight: 600;
}

@media (max-width: 1023px) {
  .post-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .post-sidebar {
    position: static;
  }
}

@media (max-width: 599px) {
  .post-shell {
    padding: var(--space-2) var(--space-2) var(--space-5);
  }

  .post-hero {
    padding: 1rem 0.9rem 0.8rem;
  }

  .post-body-section {
    padding: 0.9rem 0.85rem 1.2rem;
  }

  .post-tags {
    padding: 0.7rem 0.85rem 0.9rem;
  }

  .post-hero__actions .q-btn {
    font-size: 0.8rem;
  }

  .post-hero__meta {
    gap: 0.25rem 0.65rem;
  }

  .post-hero__meta .post-hero__dot {
    display: none;
  }
}
</style>

<script>
import render from 'components/render.vue'
import comments from 'components/comments.vue'
import commentBox from 'components/commentBox.vue'
import moment from 'src/utils/time'
import vote from 'components/vote.vue'
import jsonViewer from 'components/jsonViewer.vue'
import tipButton from 'components/tipButton.vue'
import shareButtons from 'components/shareButtons.vue'
import { stripHtml, safeJsonParse } from 'src/utils/safeHtml'
import reblog from 'components/reblog.vue'
import votesDialog from 'components/votesDialog.vue'
import { formatReputation } from 'src/services/comments'
import { setPageMeta, stripHtml as stripHtmlForMeta, BASE_URL, SITE_NAME } from 'src/utils/pageMeta'

export default {
  name: 'postView',
  components: {
    render,
    comments,
    vote,
    jsonViewer,
    tipButton,
    commentBox,
    shareButtons,
    reblog,
    votesDialog
  },
  data () {
    return {
      post: null,
      author: this.$route.params.author,
      permlink: this.$route.params.permlink,
      showVotes: false,
      showShareDialog: false,
      showReply: false,
      error: null
    }
  },
  watch: {
    '$route.path' () {
      this.init()
    }
  },
  computed: {
    account () {
      return this.$hiveStore.accounts[this.author]
    },
    communityInfo () {
      const category = this.post && this.post.category
      if (!category) return null
      return this.$hiveStore.$state.communityInfo[category] || null
    },
    communityName () {
      if (!this.post) return ''
      if (this.post.community) return this.post.community
      return this.post.category && this.post.category.startsWith('hive-') ? this.post.category : ''
    },
    communityTitle () {
      if (!this.post) return ''
      return this.post.community_title || (this.communityInfo && this.communityInfo.title) || ''
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    postPastPayout () {
      if (!this.post) return false
      return moment.utc() > moment.utc(this.post.cashout_time)
    },
    postMeta () {
      return this.getPostMeta(this.post)
    },
    authorMeta () {
      return safeJsonParse(this.account && this.account.posting_json_metadata)
    },
    authorAbout () {
      return stripHtml((this.authorMeta.profile && this.authorMeta.profile.about) || '')
    },
    reputation () {
      return formatReputation(this.post && this.post.author_reputation)
    },
    postTags () {
      const tags = this.postMeta && this.postMeta.tags
      if (!Array.isArray(tags)) return []
      return tags.filter(tag => typeof tag === 'string' && tag.length > 0).slice(0, 8)
    },
    wordCount () {
      if (!this.post || !this.post.body) return 0
      return stripHtml(this.post.body).split(/\s+/).filter(Boolean).length
    },
    readingTime () {
      return Math.max(1, Math.ceil(this.wordCount / 200))
    },
    formattedCreated () {
      if (!this.post || !this.post.created) return ''
      return moment.utc(this.post.created).format('D MMM YYYY')
    },
    isEdited () {
      if (!this.post || !this.post.last_update || !this.post.created) return false
      return Math.abs(moment.utc(this.post.last_update).diff(moment.utc(this.post.created), 'minutes')) > 1
    },
    voteCount () {
      return (this.post && this.post.active_votes && this.post.active_votes.length) || 0
    },
    commentCount () {
      return Number(this.post && this.post.children) || 0
    },
    reblogCount () {
      return Number(this.post && this.post.reblogs) || 0
    },
    payoutDisplay () {
      if (!this.post) return ''
      const pending = this.post.pending_payout_value
      if (typeof pending === 'string' && parseFloat(pending) > 0) return pending
      const total = this.post.total_payout_value
      if (typeof total === 'string' && parseFloat(total) > 0) return total
      if (typeof this.post.payout === 'number' && this.post.payout > 0) return this.post.payout.toFixed(3) + ' HBD'
      return ''
    },
    maxPayoutCapped () {
      if (!this.post || typeof this.post.max_accepted_payout !== 'string') return false
      const max = parseFloat(this.post.max_accepted_payout)
      return Number.isFinite(max) && max > 0 && max < 100
    }
  },
  methods: {
    getPost (author, permlink) {
      this.$hive.api.getContentAsync(author, permlink)
        .then(post => {
          this.error = null
          this.setPost(post)
        })
        .catch(error => {
          this.error = error
          console.error(error)
        })
    },
    setPost (post) {
      this.post = post
      this.updatePageMeta(post)
      const category = post && post.category
      if (category && category.startsWith('hive-') && !this.$hiveStore.$state.communityInfo[category]) {
        this.$hiveStore.getCommunityInfo(category)
      }
    },
    getPostMeta (post) {
      if (!post || !post.json_metadata) return {}
      return safeJsonParse(post.json_metadata)
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
      return link.startsWith('hive-') ? this.linkCommunity(link) : this.linkTag(link)
    },
    timeDelta (timestamp) {
      const now = moment.utc()
      const stamp = moment.utc(timestamp)
      const diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    formatDate (timestamp) {
      return moment.utc(timestamp).format('D MMM YYYY')
    },
    tidyNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '0'
      return number.toLocaleString('en-US')
    },
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    stripHtml,
    scrollToComments () {
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    refreshPost () {
      this.getPost(this.author, this.permlink)
    },
    init () {
      this.post = null
      this.error = null
      this.author = this.$route.params.author
      this.permlink = this.$route.params.permlink
      this.updatePageMeta(null)
      if (this.author) this.$hiveStore.getAccount(this.author)
      this.getPost(this.author, this.permlink)
    },
    findDeletedPost (data) {
      const author = data.split(' ')[1].split('/')[0]
      this.$router.push({ path: '/@' + author + '?filter=comment,delete_comment' })
    }
  },
  mounted () {
    this.init()
  }
}
</script>
