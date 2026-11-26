<template>
  <q-dialog
    :model-value="peek.open"
    :maximized="isMobile"
    :position="isMobile ? 'standard' : 'right'"
    :seamless="!isMobile"
    :full-height="!isMobile"
    :allow-focus-outside="!isMobile"
    no-route-dismiss
    transition-show="slide-left"
    transition-hide="slide-right"
    aria-labelledby="post-peek-title"
    @update:model-value="onDialogModel"
  >
    <q-card class="post-peek" :class="{ 'post-peek--sheet': !isMobile }" flat>
      <header class="post-peek__head">
        <div class="post-peek__heading">
          <div class="post-peek__eyebrow">Quick look</div>
          <h2 id="post-peek-title" class="post-peek__title">{{ displayTitle }}</h2>
          <div class="post-peek__meta">
            <router-link v-if="author" :to="'/@' + author" class="post-peek__author">@{{ author }}</router-link>
            <template v-if="communityTitle">
              <span class="post-peek__dot" aria-hidden="true">·</span>
              <span class="post-peek__community">{{ communityTitle }}</span>
            </template>
            <template v-if="createdLabel">
              <span class="post-peek__dot" aria-hidden="true">·</span>
              <time :datetime="post.created">{{ createdLabel }}</time>
            </template>
          </div>
        </div>
        <q-btn
          class="post-peek__close"
          flat
          dense
          round
          icon="close"
          aria-label="Close quick look"
          title="Close"
          @click="requestClose"
        />
      </header>

      <div class="post-peek__body" role="article" tabindex="0" aria-label="Post content">
        <moderation-notice
          v-if="moderation.primary"
          :decision="moderation"
          :show-disclosure="moderationStore && moderationStore.shouldDisclose"
          class="post-peek__moderation"
          @dismiss-disclosure="moderationMarkDisclosure"
          @show="moderationShowItem(moderation)"
          @show-author="moderationShowAuthor(moderation)"
          @hide-author="moderationHideAuthor(moderation)"
          @ignore-voter="moderationToggleIgnoredVoter"
        />

        <div v-if="error && !body" class="post-peek__state post-peek__state--error" role="alert">
          <q-icon name="error_outline" size="28px" aria-hidden="true" />
          <p>{{ error }}</p>
          <div class="post-peek__state-actions">
            <q-btn outline no-caps color="primary" icon="refresh" label="Retry" @click="loadPost" />
            <q-btn flat no-caps color="primary" icon="open_in_new" label="Open full post" :to="postLink" />
          </div>
        </div>

        <div v-else-if="loading && !body" class="post-peek__state" aria-label="Loading post">
          <q-skeleton type="rect" height="28px" width="64%" />
          <q-skeleton type="text" />
          <q-skeleton type="text" width="88%" />
          <q-skeleton type="rect" height="240px" class="q-mt-md" />
        </div>

        <div v-else-if="body" class="post-peek__content">
          <render :input="body" class="postbody" />
          <div v-if="loading" class="post-peek__refreshing" role="status">
            <q-spinner-dots size="16px" aria-hidden="true" /> Refreshing post…
          </div>
          <div v-else-if="error" class="post-peek__inline-error" role="status">
            <q-icon name="warning" size="15px" aria-hidden="true" />
            <span>Showing the preview. {{ error }}</span>
            <q-btn flat dense no-caps color="primary" label="Retry" @click="loadPost" />
          </div>
        </div>

        <div v-else class="post-peek__state">
          <q-icon name="article" size="28px" aria-hidden="true" />
          <p>This post has no body text.</p>
          <q-btn outline no-caps color="primary" icon="open_in_new" label="Open full post" :to="postLink" />
        </div>
      </div>

      <footer class="post-peek__foot">
        <vote
          v-if="loggedInUser"
          :votes="activeVotes"
          :author="author"
          :permlink="permlink"
          @Voted="onVoted"
        />
        <q-btn
          class="post-peek__stat"
          flat
          dense
          no-caps
          icon="format_list_bulleted"
          :label="voteCount + (voteCount === 1 ? ' vote' : ' votes')"
          :aria-label="'View ' + voteCount + (voteCount === 1 ? ' vote' : ' votes')"
        >
          <q-popup-proxy anchor="top right" self="bottom right" :offset="[0, 8]">
            <votes-dialog :votes="activeVotes" :author="author" :permlink="permlink" />
          </q-popup-proxy>
        </q-btn>
        <span v-if="!loggedInUser" class="post-peek__hint" title="Log in to vote">
          <q-icon name="thumb_up_off_alt" size="16px" aria-hidden="true" /> Log in to vote
        </span>
        <router-link :to="commentsLink" class="post-peek__stat post-peek__stat--link">
          <q-icon name="comment" size="16px" aria-hidden="true" />{{ commentCount }}
        </router-link>
        <span class="post-peek__stat post-peek__payout">
          <q-icon name="monetization_on" size="16px" aria-hidden="true" />{{ payoutLabel }}
        </span>
        <router-link :to="postLink" class="post-peek__open">
          Open full post <q-icon name="arrow_forward" size="16px" aria-hidden="true" />
        </router-link>
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.post-peek {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  background: var(--c-bg-deep);
  color: var(--c-text);
}

.post-peek--sheet {
  width: min(680px, 92vw);
  border-left: 1px solid var(--border-subtle);
  border-radius: 0;
  box-shadow: var(--shadow-pop);
}

/* Quasar caps minimized dialogs at 560px; the reading sheet needs the room. */
.q-dialog__inner--minimized > .post-peek--sheet {
  width: min(680px, 92vw);
  max-width: min(680px, 92vw);
}

.post-peek__head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: none;
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--c-surface-1);
}

.post-peek__heading {
  flex: 1;
  min-width: 0;
}

.post-peek__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.post-peek__title {
  margin: 0.15rem 0 0.35rem;
  font-size: clamp(1.1rem, 2.4vw, 1.4rem);
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.post-peek__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.post-peek__author {
  color: var(--c-text-soft);
  font-weight: 600;
  text-decoration: none;
}

.post-peek__author:hover {
  color: var(--c-link-hover);
}

.post-peek__community {
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-peek__dot {
  color: var(--c-text-faint);
}

.post-peek__close {
  flex: none;
  color: var(--c-text-subtle);
}

.post-peek__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-4);
}

.post-peek__body:focus-visible {
  outline: 2px solid var(--c-link);
  outline-offset: -2px;
}

.post-peek__moderation {
  margin-bottom: var(--space-3);
}

.post-peek__content {
  min-width: 0;
}

.post-peek__refreshing,
.post-peek__inline-error {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.post-peek__inline-error {
  color: var(--c-warning);
}

.post-peek__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  color: var(--c-text-muted);
  text-align: center;
}

.post-peek__state p {
  margin: 0;
  overflow-wrap: anywhere;
}

.post-peek__state--error {
  color: var(--c-warning);
}

.post-peek__state-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.post-peek__foot {
  display: flex;
  align-items: center;
  gap: 0.45rem 0.65rem;
  flex: none;
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: var(--c-surface-1);
}

.post-peek__stat.q-btn,
.post-peek__stat--link {
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
}

.post-peek__stat.q-btn .q-icon,
.post-peek__stat--link .q-icon {
  margin-right: 0.2rem;
  font-size: 16px;
  color: var(--c-text-faint);
}

.post-peek__stat.q-btn:hover,
.post-peek__stat--link:hover {
  border-color: var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-strong);
}

.post-peek__payout,
.post-peek__hint {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.post-peek__hint .q-icon {
  margin-right: 0.2rem;
  color: var(--c-text-faint);
}

.post-peek__payout .q-icon {
  margin-right: 0.2rem;
  font-size: 16px;
  color: var(--c-secondary);
}

.post-peek__open {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-left: auto;
  color: var(--c-link);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}

.post-peek__open:hover {
  color: var(--c-link-hover);
}

@media (max-width: 599px) {
  .post-peek__head,
  .post-peek__body,
  .post-peek__foot {
    padding-left: var(--space-3);
    padding-right: var(--space-3);
  }

  .post-peek__open {
    width: 100%;
    justify-content: flex-end;
    margin-left: 0;
  }
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import moderation from 'src/mixins/moderation'
import {
  applyLocalPeekVote,
  closePostPeek,
  localVoteFor,
  noteLocalPeekVote,
  openPostPeekFromRoute,
  parsePeekKey,
  peekKey,
  postPeek
} from 'src/services/postPeek'
import { fetchPostContent } from 'src/services/chainData'
import {
  postCommunityTitle,
  postDisplayTitle,
  postPayoutLabel,
  postUserVoteDirection,
  postVotes
} from 'src/services/posts'

export default {
  name: 'PostPeek',
  mixins: [moderation],
  components: {
    render: defineAsyncComponent(() => import('components/render.vue')),
    vote: defineAsyncComponent(() => import('components/vote.vue')),
    votesDialog: defineAsyncComponent(() => import('components/votesDialog.vue')),
    ModerationNotice: defineAsyncComponent(() => import('components/moderation/ModerationNotice.vue'))
  },
  data () {
    return {
      fullPost: null,
      loading: false,
      error: '',
      requestId: 0,
      openedByPush: false,
      navigatingAway: false,
      ready: false
    }
  },
  computed: {
    peek () {
      return postPeek
    },
    isMobile () {
      return this.$q.screen.lt.sm
    },
    post () {
      return this.fullPost || this.peek.seed || {}
    },
    author () {
      return this.post.author || this.peek.author
    },
    permlink () {
      return this.post.permlink || this.peek.permlink
    },
    displayTitle () {
      return postDisplayTitle(this.post)
    },
    communityTitle () {
      return postCommunityTitle(this.post)
    },
    body () {
      return this.post.body || ''
    },
    createdLabel () {
      return this.post.created ? moment.utc(this.post.created).fromNow() : ''
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    activeVotes () {
      const votes = Array.isArray(this.post.active_votes) ? [...this.post.active_votes] : []
      const local = localVoteFor(this.post, this.loggedInUser)
      if (!local) return votes
      const index = votes.findIndex(vote => vote && vote.voter === this.loggedInUser)
      if (local.direction === 0) {
        if (index !== -1) votes.splice(index, 1)
        return votes
      }
      const row = {
        voter: this.loggedInUser,
        percent: local.weight * 100,
        rshares: local.weight,
        weight: local.weight,
        time: new Date().toISOString()
      }
      if (index === -1) votes.push(row)
      else votes[index] = { ...votes[index], ...row }
      return votes
    },
    voteCount () {
      const base = postVotes(this.post)
      const local = localVoteFor(this.post, this.loggedInUser)
      if (!local) return base
      const chainDirection = postUserVoteDirection(this.post, this.loggedInUser)
      if (!chainDirection && local.direction) return base + 1
      if (chainDirection && local.direction === 0) return Math.max(0, base - 1)
      return base
    },
    commentCount () {
      return Number(this.post.children) || 0
    },
    payoutLabel () {
      return postPayoutLabel(this.post)
    },
    postLink () {
      return '/@' + this.author + '/' + this.permlink
    },
    commentsLink () {
      return this.postLink + '#comments'
    },
    moderation () {
      return this.moderationDecision({
        author: this.author,
        post: this.post,
        surface: 'post',
        itemKey: this.author + '/' + this.permlink
      })
    }
  },
  mounted () {
    // A ?peek= deep link opens the store from the immediate route watcher
    // before the nonce watcher exists, so start that first read here.
    this.ready = true
    if (this.peek.open && !this.fullPost && !this.loading) this.loadPost()
  },
  watch: {
    'peek.open': {
      immediate: true,
      handler (open) {
        if (!open) {
          this.reset()
          // The immediate run happens before a deep link has been parsed; do
          // not strip ?peek= before the route watcher has had a chance to open.
          if (this.ready) this.removeRoutePeek()
        }
      }
    },
    'peek.nonce' () {
      // Opening from a card or a deep link increments the nonce once, so the
      // load runs here instead of twice from both open and nonce watchers.
      if (!this.peek.open) return
      // Another card may have replaced the seed while the peek is open; show
      // that card immediately instead of the previous post until the read lands.
      this.fullPost = null
      this.error = ''
      this.loadPost()
      this.ensureRoutePeek()
    },
    '$route.query.peek': {
      immediate: true,
      handler (value) {
        this.handleRoutePeek(value)
      }
    },
    '$route.path' (to, from) {
      if (to === from) return
      this.navigatingAway = true
      this.openedByPush = false
      if (this.peek.open) closePostPeek()
      this.$nextTick(() => { this.navigatingAway = false })
    }
  },
  methods: {
    async loadPost () {
      const author = this.peek.author
      const permlink = this.peek.permlink
      if (!author || !permlink) return
      const requestId = ++this.requestId
      this.loading = true
      this.error = ''
      try {
        const fresh = await fetchPostContent(author, permlink, { force: true })
        if (requestId !== this.requestId) return
        if (!fresh || !fresh.author) throw new Error('Post not found.')
        const target = this.peek.seed || fresh
        Object.assign(target, fresh)
        applyLocalPeekVote(target, this.loggedInUser)
        this.fullPost = target
      } catch (error) {
        if (requestId !== this.requestId) return
        this.error = error?.message || 'Could not load this post.'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    reset () {
      this.requestId += 1
      this.fullPost = null
      this.error = ''
      this.loading = false
    },
    onVoted (weight) {
      noteLocalPeekVote(this.author, this.permlink, this.loggedInUser, weight)
    },
    requestClose () {
      closePostPeek()
    },
    onDialogModel (open) {
      if (!open) this.requestClose()
    },
    ensureRoutePeek () {
      if (!this.peek.open) return
      const key = peekKey(this.peek.author, this.peek.permlink)
      if (!key || this.$route.query.peek === key) return
      const alreadyOpen = Boolean(this.$route.query.peek)
      const query = { ...this.$route.query, peek: key }
      const navigation = { path: this.$route.path, query }
      if (alreadyOpen) {
        this.$router.replace(navigation).catch(() => {})
        return
      }
      this.openedByPush = this.peek.openedFromCard
      this.$router.push(navigation).catch(() => { this.openedByPush = false })
    },
    removeRoutePeek () {
      if (this.navigatingAway) return
      if (!this.$route.query.peek) {
        this.openedByPush = false
        return
      }
      if (this.openedByPush) {
        this.openedByPush = false
        this.$router.back()
        return
      }
      const query = { ...this.$route.query }
      delete query.peek
      this.$router.replace({ path: this.$route.path, query }).catch(() => {})
    },
    handleRoutePeek (value) {
      const parsed = parsePeekKey(value)
      if (!parsed) {
        if (this.peek.open) {
          this.openedByPush = false
          closePostPeek()
        }
        return
      }
      if (this.peek.open && this.peek.key === parsed.key) return
      openPostPeekFromRoute(parsed.author, parsed.permlink)
    }
  }
}
</script>
