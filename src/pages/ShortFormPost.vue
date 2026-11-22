<template>
  <q-page class="sfp">
    <div class="sfp-wrap">
      <nav class="sfp-back" aria-label="Breadcrumb">
        <router-link :to="{ name: 'short-form', params: { formatId } }">
          <q-icon name="arrow_back" size="15px" aria-hidden="true" /> {{ format ? format.label : 'Short posts' }}
        </router-link>
      </nav>

      <data-notice
        v-if="error"
        variant="error"
        :message="error"
        action-label="Retry"
        @action="load()"
      />

      <div v-if="loading && !post" class="sfp-loading" aria-hidden="true">
        <q-skeleton type="rect" height="180px" />
        <q-skeleton type="rect" height="120px" />
      </div>

      <template v-else-if="post">
        <article class="sfp-post home-card" :style="{ '--sfp-accent': format ? format.color : 'var(--c-link)' }">
          <header class="sfp-post__head">
            <router-link :to="{ name: 'account', params: { username: post.author } }" class="sfp-author">
              <q-avatar size="40px" class="sfp-avatar">{{ initial }}</q-avatar>
              <span>
                <span class="sfp-author__name">@{{ post.author }}</span>
                <span class="sfp-author__time">
                  <time :datetime="post.created" :title="fullTime">{{ age }}</time>
                  <span v-if="format" aria-hidden="true"> · </span>
                  <span v-if="format">{{ format.label }} on {{ format.app }}</span>
                </span>
              </span>
            </router-link>
            <q-btn flat dense no-caps size="sm" icon="open_in_new" :href="externalUrl" target="_blank" rel="noopener noreferrer" />
          </header>

          <div class="sfp-post__body">
            <render :input="post.body" />
          </div>

          <short-form-media :items="media" :author="post.author" linked />

          <footer class="sfp-post__foot">
            <vote
              :votes="post.active_votes"
              :author="post.author"
              :permlink="post.permlink"
              @Voted="weight => onVoted(weight)"
            />
            <reblog :author="post.author" :permlink="post.permlink" :reblogged="alreadyReblogged" />
            <sats-zap-button :account="post.author" :permlink="post.permlink" compact />
            <span class="sfp-action sfp-action--static">
              <q-icon name="mode_comment" size="16px" aria-hidden="true" /> {{ replies.length }} replies
            </span>
            <span class="sfp-action sfp-action--static">
              <q-icon name="paid" size="15px" aria-hidden="true" /> {{ payout }}
            </span>
            <span class="sfp-flex" />
            <q-btn flat dense no-caps size="sm" icon="code" label="Raw post" :to="{ name: 'post', params: { author: post.author, permlink: post.permlink } }" />
          </footer>

          <p v-if="container" class="sfp-container-note">
            Part of container
            <router-link :to="{ name: 'post', params: { author: container.author, permlink: container.permlink } }">
              @{{ container.author }}/{{ container.permlink }}
            </router-link>
          </p>
        </article>

        <section class="sfp-reply home-card" aria-labelledby="sfp-reply-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Posting key</div>
              <h2 id="sfp-reply-title" class="home-panel__title">
                {{ replyParent ? 'Reply to @' + replyParent.author : 'Reply to @' + post.author }}
              </h2>
            </div>
            <q-btn v-if="replyParent" flat dense no-caps size="sm" label="Cancel" @click="replyParent = null" />
          </div>
          <div v-if="!loggedInUser" class="sfp-reply__locked">
            <q-icon name="lock" size="16px" aria-hidden="true" />
            Log in with Keychain, SmartLock or HiveAuth to reply.
          </div>
          <form v-else class="sfp-reply__form" @submit.prevent="submitReply()">
            <textarea
              ref="reply"
              v-model="replyBody"
              class="sfp-reply__input"
              rows="3"
              maxlength="1000"
              :placeholder="replyParent ? '@' + replyParent.author + ' ' : 'Write a reply as @' + loggedInUser + '…'"
              aria-label="Write a reply"
            />
            <div class="sfp-reply__foot">
              <span class="sfp-reply__count">{{ 1000 - replyBody.length }}</span>
              <q-btn unelevated no-caps color="primary" type="submit" icon="send" label="Queue reply" :disable="!replyBody.trim() || replyBody.length > 1000" />
            </div>
          </form>
        </section>

        <section class="sfp-replies" aria-labelledby="sfp-replies-title">
          <h2 id="sfp-replies-title" class="sfp-replies__title">Replies ({{ replies.length }})</h2>
          <ol v-if="replies.length" class="sfp-replies__list">
            <li
              v-for="reply in replies"
              :key="reply.author + '/' + reply.permlink"
              class="sfp-reply-item home-card"
              :style="{ marginLeft: indent(reply._depth) }"
            >
              <header class="sfp-reply-item__head">
                <router-link :to="{ name: 'account', params: { username: reply.author } }" class="sfp-reply-author">@{{ reply.author }}</router-link>
                <span class="sfp-reply-meta">
                  <time :datetime="reply.created">{{ replyAge(reply) }}</time>
                  <q-btn flat dense no-caps size="sm" icon="reply" label="Reply" @click="replyTo(reply)" />
                </span>
              </header>
              <div class="sfp-reply-item__body">
                <render :input="reply.body" />
              </div>
              <short-form-media :items="replyMedia(reply)" :author="reply.author" />
            </li>
          </ol>
          <p v-else class="sfp-empty">No replies yet.</p>
        </section>
      </template>

      <div v-else-if="!error" class="sfp-empty">
        <q-icon name="search_off" size="26px" aria-hidden="true" />
        <p>That post could not be found on Hive.</p>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { setPageMeta, stripHtml } from 'src/utils/pageMeta'
import { postPayoutLabel } from 'src/services/posts'
import {
  fetchShortFormPost,
  getShortFormat,
  shortFormQueueItem,
  shortFormQueueSummary,
  shortFormUrl,
  shortMedia
} from 'src/services/shortForm'
import DataNotice from 'components/ui/DataNotice.vue'
import ShortFormMedia from 'components/shortForm/ShortFormMedia.vue'
import Vote from 'components/vote.vue'
import SatsZapButton from 'components/lightning/SatsZapButton.vue'
import Reblog from 'components/reblog.vue'

const Render = defineAsyncComponent(() => import('components/render.vue'))

export default {
  name: 'ShortFormPost',
  components: { DataNotice, Render, ShortFormMedia, Vote, Reblog, SatsZapButton },
  props: {
    formatId: { type: String, required: true },
    author: { type: String, required: true },
    permlink: { type: String, required: true }
  },
  data () {
    return {
      post: null,
      replies: [],
      container: null,
      loading: true,
      error: null,
      replyBody: '',
      replyParent: null
    }
  },
  computed: {
    format () {
      return getShortFormat(this.formatId)
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    initial () {
      return String(this.post && this.post.author || '?').charAt(0).toUpperCase()
    },
    media () {
      return this.post ? shortMedia(this.post) : []
    },
    votes () {
      const stats = this.post && this.post.stats
      if (stats && Number.isFinite(Number(stats.total_votes))) return stats.total_votes
      return this.post && Array.isArray(this.post.active_votes) ? this.post.active_votes.length : 0
    },
    payout () {
      return this.post ? postPayoutLabel(this.post) : ''
    },
    age () {
      return this.post && this.post.created ? moment.utc(this.post.created).fromNow() : ''
    },
    fullTime () {
      return this.post && this.post.created ? moment.utc(this.post.created).format('D MMM YYYY, HH:mm') : ''
    },
    /** Reflect an existing reblog from the chain instead of local state. */
    alreadyReblogged () {
      if (!this.post || !this.loggedInUser) return false
      const list = Array.isArray(this.post.reblogged_by) ? this.post.reblogged_by : []
      const voter = String(this.loggedInUser).toLowerCase()
      return list.some(name => String(name).toLowerCase() === voter)
    },
    externalUrl () {
      return shortFormUrl(this.post, this.formatId)
    }
  },
  watch: {
    permlink: {
      immediate: true,
      handler () {
        this.load()
      }
    }
  },
  methods: {
    async load () {
      this.loading = true
      this.error = null
      this.replyParent = null
      try {
        const result = await fetchShortFormPost(this.author, this.permlink, { observer: this.loggedInUser || '' })
        if (!result) {
          this.post = null
          this.replies = []
          return
        }
        this.post = result.root
        this.replies = result.replies
        this.container = result.root.parent_author
          ? { author: result.root.parent_author, permlink: result.root.parent_permlink }
          : null
        this.updateMeta()
      } catch (error) {
        this.error = error?.message || 'Unexpected error'
      } finally {
        this.loading = false
      }
    },
    updateMeta () {
      if (!this.post) return
      const label = this.format ? this.format.label : 'Short post'
      const media = shortMedia(this.post)
      setPageMeta({
        title: '@' + this.post.author + ' on ' + label + ' — Hive microblog',
        description: stripHtml(this.post.body, 180) || label + ' post by @' + this.post.author,
        image: media.length ? media[0].url : undefined,
        url: '/shorts/' + this.formatId + '/@' + this.post.author + '/' + this.post.permlink
      })
    },
    replyMedia (reply) {
      return shortMedia(reply, { limit: 2 })
    },
    indent (depth) {
      return Math.min(4, Math.max(0, Number(depth) - 1)) * 18 + 'px'
    },
    replyAge (reply) {
      return reply.created ? moment.utc(reply.created).fromNow() : ''
    },
    replyTo (reply) {
      this.replyParent = reply
      this.$nextTick(() => {
        const input = this.$refs.reply
        if (input && input.focus) input.focus()
      })
    },
    /** Display-only sync; the shared vote control owns the queued operation. */
    onVoted (weight) {
      if (!this.post) return
      const votes = Array.isArray(this.post.active_votes) ? this.post.active_votes.slice() : []
      const index = votes.findIndex(vote => String(vote && vote.voter || '').toLowerCase() === String(this.loggedInUser).toLowerCase())
      const entry = { voter: this.loggedInUser, weight: Math.round(Number(weight) * 100), percent: Math.round(Number(weight) * 100), rshares: Math.round(Number(weight) * 100) }
      if (index >= 0) votes.splice(index, 1, entry)
      else votes.push(entry)
      this.post.active_votes = votes
    },
    submitReply () {
      if (!this.post || !this.replyBody.trim() || this.replyBody.length > 1000) return
      try {
        const target = this.replyParent || this.post
        const item = shortFormQueueItem({
          format: this.formatId,
          username: this.loggedInUser,
          body: this.replyBody,
          reply: { author: target.author, permlink: target.permlink }
        })
        this.$hiveStore.addToQueue(item)
        this.$q.notify({
          type: 'positive',
          message: 'Queued: ' + shortFormQueueSummary(item),
          caption: 'Sign it from the queue to publish on chain.'
        })
        this.replyBody = ''
        this.replyParent = null
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error?.message || 'Could not queue the reply' })
      }
    }
  }
}
</script>

<style scoped>
.sfp {
  padding-bottom: var(--space-6);
}

.sfp-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.sfp-back a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-link);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}

.sfp-post {
  padding: var(--space-4);
  border-left: 3px solid var(--sfp-accent);
}

.sfp-post__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.sfp-author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--c-text);
  text-decoration: none;
}

.sfp-author:hover {
  color: var(--c-link-hover);
  text-decoration: none;
}

.sfp-avatar {
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-soft);
  font-weight: 700;
}

.sfp-author__name {
  display: block;
  font-weight: 700;
}

.sfp-author__time {
  display: block;
  color: var(--c-text-faint);
  font-size: 0.76rem;
}

.sfp-post__body {
  margin-top: var(--space-3);
  color: var(--c-text);
  font-size: 1rem;
  line-height: var(--line-body);
  overflow-wrap: anywhere;
}

.sfp-post__foot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}

.sfp-action {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 32px;
  padding: 0.2rem 0.55rem;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--c-text-subtle);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.sfp-action:hover {
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-text);
}

.sfp-action--static {
  cursor: default;
}

.sfp-action--static:hover {
  background: transparent;
  color: var(--c-text-subtle);
}

.sfp-flex {
  flex: 1;
}

.sfp-container-note {
  margin: var(--space-2) 0 0;
  color: var(--c-text-faint);
  font-size: 0.76rem;
}

.sfp-reply__form,
.sfp-reply__locked {
  padding: var(--space-3);
}

.sfp-reply__locked {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--c-text-subtle);
  font-size: 0.85rem;
}

.sfp-reply__input {
  width: 100%;
  min-height: 72px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-shadow) 25%, transparent);
  color: var(--c-text);
  font: inherit;
  font-size: 0.92rem;
  resize: vertical;
}

.sfp-reply__input:focus-visible {
  border-color: var(--c-link);
  outline: 2px solid color-mix(in srgb, var(--c-link) 35%, transparent);
}

.sfp-reply__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.sfp-reply__count {
  color: var(--c-text-faint);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sfp-replies__title {
  margin: var(--space-2) 0;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.sfp-replies__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sfp-reply-item {
  padding: var(--space-2) var(--space-3);
}

.sfp-reply-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sfp-reply-author {
  color: var(--c-text);
  font-weight: 700;
  text-decoration: none;
}

.sfp-reply-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.sfp-reply-item__body {
  margin-top: 0.35rem;
  color: var(--c-text-soft);
  font-size: 0.9rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.sfp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5);
  color: var(--c-text-faint);
  text-align: center;
}

.sfp-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sfp-loading :deep(.q-skeleton) {
  border-radius: var(--radius-card);
}
</style>
