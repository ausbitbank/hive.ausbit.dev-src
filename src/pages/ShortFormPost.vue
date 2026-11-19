<template>
  <q-page class="sfp">
    <div class="sfp-wrap">
      <nav class="sfp-back" aria-label="Breadcrumb">
        <router-link :to="{ name: 'short-form', params: { format: formatId } }">
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

      <div v-if="loading && !post" class="sfp-loading">
        <q-skeleton type="rect" height="160px" />
      </div>

      <template v-else-if="post">
        <article class="sfp-post home-card" :style="{ '--sfp-accent': format ? format.color : '#4fc3f7' }">
          <header class="sfp-post__head">
            <router-link :to="{ name: 'account', params: { username: post.author } }" class="sfp-author">
              @{{ post.author }}
            </router-link>
            <span class="sfp-meta">
              <q-chip v-if="format" dense square :style="{ background: format.color, color: '#10161b' }">
                {{ format.label }}
              </q-chip>
              <time :datetime="post.created" :title="fullTime">{{ age }}</time>
            </span>
          </header>

          <div class="sfp-post__body">
            <render :input="post.body" />
          </div>

          <footer class="sfp-post__foot">
            <span><q-icon name="favorite_border" size="15px" aria-hidden="true" /> {{ votes }} votes</span>
            <span><q-icon name="mode_comment" size="15px" aria-hidden="true" /> {{ replies.length }} replies</span>
            <span><q-icon name="paid" size="15px" aria-hidden="true" /> {{ payout }}</span>
            <span class="sfp-flex" />
            <q-btn flat dense no-caps size="sm" icon="open_in_new" :href="externalUrl" target="_blank" rel="noopener noreferrer" :label="'Open on ' + (format ? format.app : 'PeakD')" />
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
              <h2 id="sfp-reply-title" class="home-panel__title">Reply to @{{ replyTargetName }}</h2>
            </div>
          </div>
          <div v-if="!loggedInUser" class="sfp-reply__locked">
            <q-icon name="lock" size="16px" aria-hidden="true" />
            Log in with Keychain or SmartLock to reply.
          </div>
          <form v-else class="sfp-reply__form" @submit.prevent="submitReply()">
            <textarea
              v-model="replyBody"
              class="sfp-reply__input"
              rows="3"
              maxlength="1000"
              :placeholder="'Write a reply as @' + loggedInUser + '…'"
              aria-label="Write a reply"
            />
            <div class="sfp-reply__foot">
              <span v-if="replyParent" class="sfp-reply__target">
                Replying to @{{ replyParent.author }}/{{
                  replyParent.permlink
                }}
                <q-btn flat dense no-caps size="sm" label="Cancel" @click="replyParent = null" />
              </span>
              <span class="sfp-flex" />
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
                <router-link :to="{ name: 'account', params: { username: reply.author } }" class="sfp-author">@{{ reply.author }}</router-link>
                <span class="sfp-meta">
                  <time :datetime="reply.created">{{ replyAge(reply) }}</time>
                  <q-btn flat dense no-caps size="sm" icon="reply" label="Reply" @click="replyTo(reply)" />
                </span>
              </header>
              <div class="sfp-reply-item__body">
                <render :input="reply.body" />
              </div>
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
import { fetchShortFormPost, getShortFormat, shortFormQueueItem, shortFormQueueSummary, shortFormUrl } from 'src/services/shortForm'
import { postPayoutLabel } from 'src/services/posts'
import DataNotice from 'components/ui/DataNotice.vue'

const Render = defineAsyncComponent(() => import('components/render.vue'))

export default {
  name: 'ShortFormPost',
  components: { DataNotice, Render },
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
    replyTargetName () {
      return this.replyParent ? this.replyParent.author : (this.post ? this.post.author : '')
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
    externalUrl () {
      return shortFormUrl(this.post, this.formatId)
    }
  },
  watch: {
    permlink: 'load'
  },
  mounted () {
    this.load()
  },
  methods: {
    async load () {
      this.loading = true
      this.error = null
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
      const images = this.post.json_metadata && Array.isArray(this.post.json_metadata.image) ? this.post.json_metadata.image : []
      setPageMeta({
        title: '@' + this.post.author + ' on ' + label + ' — Hive microblog',
        description: stripHtml(this.post.body, 180) || label + ' post by @' + this.post.author,
        image: images[0] || undefined,
        url: '/shorts/' + this.formatId + '/@' + this.post.author + '/' + this.post.permlink
      })
    },
    indent (depth) {
      return Math.min(4, Math.max(0, Number(depth) - 1)) * 18 + 'px'
    },
    replyAge (reply) {
      return reply.created ? moment.utc(reply.created).fromNow() : ''
    },
    replyTo (reply) {
      this.replyParent = reply
      const input = this.$el.querySelector('.sfp-reply__input')
      if (input) input.focus()
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
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sfp-back a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: #4fc3f7;
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
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sfp-author {
  color: #e4eaed;
  font-weight: 700;
  text-decoration: none;
}

.sfp-author:hover {
  color: #81d4fa;
}

.sfp-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: #78909c;
  font-size: 0.76rem;
}

.sfp-post__body {
  margin-top: var(--space-3);
  color: #e4eaed;
  font-size: 0.98rem;
  line-height: var(--line-body);
  overflow-wrap: anywhere;
}

.sfp-post__foot {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  color: #90a4ae;
  font-size: 0.78rem;
}

.sfp-flex {
  flex: 1;
}

.sfp-container-note {
  margin: var(--space-2) 0 0;
  color: #78909c;
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
  color: #90a4ae;
  font-size: 0.85rem;
}

.sfp-reply__input {
  width: 100%;
  min-height: 72px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.25);
  color: #e4eaed;
  font: inherit;
  font-size: 0.92rem;
  resize: vertical;
}

.sfp-reply__input:focus-visible {
  border-color: #4fc3f7;
  outline: 2px solid rgba(79, 195, 247, 0.35);
}

.sfp-reply__foot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.sfp-reply__target {
  color: #b0bec5;
  font-size: 0.76rem;
}

.sfp-reply__count {
  color: #78909c;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sfp-replies__title {
  margin: var(--space-2) 0;
  color: #e4eaed;
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

.sfp-reply-item__body {
  margin-top: 0.35rem;
  color: #cfd8dc;
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
  color: #78909c;
  text-align: center;
}

.sfp-loading :deep(.q-skeleton) {
  border-radius: var(--radius-card);
}
</style>
