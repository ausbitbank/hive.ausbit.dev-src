<template>
  <section class="sf" :aria-label="format.label + ' timeline'">
    <header class="sf-head">
      <div class="sf-head__text">
        <div class="home-eyebrow">
          <q-icon :name="format.icon" size="14px" aria-hidden="true" />
          {{ format.app }} · {{ format.mode === 'container' ? 'container comments' : 'top-level posts' }}
        </div>
        <h1 class="page-title">{{ format.label }}</h1>
        <p class="sf-head__subtitle">{{ format.description }}</p>
      </div>
      <div class="sf-head__actions">
        <q-btn-toggle
          v-model="sort"
          no-caps
          unelevated
          dense
          toggle-color="primary"
          :options="sortOptions"
          aria-label="Sort the timeline"
          @update:model-value="reload()"
        />
        <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="reload()" />
      </div>
    </header>

    <nav class="sf-tabs" aria-label="Microblog formats">
      <router-link
        v-for="profile in formats"
        :key="profile.id"
        :to="{ name: 'short-form', params: { formatId: profile.id } }"
        class="sf-tab"
        :class="{ 'sf-tab--active': profile.id === format.id }"
        :style="profile.id === format.id ? { '--tab-color': profile.color } : null"
      >
        <q-icon :name="profile.icon" size="16px" aria-hidden="true" />
        {{ profile.label }}
      </router-link>
    </nav>

    <div class="sf-grid">
      <div class="sf-main">
        <data-notice
          v-if="error"
          variant="error"
          :message="'Could not load ' + format.label + ': ' + error"
          action-label="Retry"
          @action="reload()"
        />

        <template v-if="!loggedInUser">
          <div class="sf-composer sf-composer--locked">
            <q-icon name="lock" size="18px" aria-hidden="true" />
            <span>Log in with Keychain, SmartLock or HiveAuth from the header to post a {{ format.label }}.</span>
          </div>
        </template>
        <template v-else>
          <form v-if="format.mode === 'feed' || container" class="sf-composer" @submit.prevent="submit()">
            <div class="sf-composer__head">
              <span class="sf-composer__label">
                <q-icon :name="format.icon" size="15px" aria-hidden="true" />
                New {{ format.label }} as @{{ loggedInUser }}
              </span>
              <span class="sf-composer__count" :class="{ 'sf-composer__count--over': remaining < 0 }">{{ remaining }}</span>
            </div>
            <textarea
              ref="body"
              v-model="body"
              class="sf-composer__input"
              rows="3"
              maxlength="1000"
              :placeholder="placeholder"
              :aria-label="'Write a ' + format.label"
              @paste="onImagePaste"
              @dragover.prevent
              @drop="onImageDrop"
            />
            <div class="sf-composer__foot">
              <span class="sf-composer__hint">
                <template v-if="format.mode === 'container'">
                  Replies to the newest container from @{{ format.containerAuthor }}. Paste or drop images.
                </template>
                <template v-else>
                  Posted to #{{ format.tag }}. Uses your posting key only. Paste or drop images.
                </template>
              </span>
              <span class="sf-composer__actions">
                <image-upload-button ref="imageUpload" @before-pick="captureSelection" @insert="insertUploadedImages" />
                <q-btn unelevated no-caps color="primary" type="submit" :disable="!canPost" :loading="posting" label="Queue post" icon="send" />
              </span>
            </div>
          </form>
          <div v-else class="sf-composer sf-composer--notice">
            <q-icon name="cloud_queue" size="18px" aria-hidden="true" />
            <span>No {{ format.label }} container is available to post into yet. Refresh to try again.</span>
          </div>
        </template>

        <div v-if="loading && !items.length" class="sf-loading" aria-hidden="true">
          <q-skeleton v-for="n in 4" :key="n" type="rect" height="150px" class="sf-loading__row" />
        </div>

        <template v-else>
          <infinite-scroll
            v-if="items.length"
            :can-load="!done"
            :loading="loadingMore"
            :disabled="loading"
            @load="loadMore()"
          >
            <ol class="sf-list">
              <li v-for="item in items" :key="item.author + '/' + item.permlink" class="sf-list__item">
                <short-form-card
                  :post="item"
                  :format="format"
                  :username="loggedInUser"
                  @open="openPost(item)"
                  @voted="onVoted"
                  @reblog="onReblogged"
                />
              </li>
            </ol>
            <template #done>
              <p class="sf-end">You're all caught up.</p>
            </template>
          </infinite-scroll>
          <div v-else-if="!error" class="sf-empty">
            <q-icon name="forum" size="28px" aria-hidden="true" />
            <p>No {{ format.label }} posts found right now.</p>
          </div>
        </template>
      </div>

      <aside class="sf-side">
        <section class="home-card sf-about">
          <div class="home-panel__head sf-about__head">
            <div>
              <div class="home-eyebrow">How it works</div>
              <h2 class="home-panel__title">{{ format.label }} on Hive</h2>
            </div>
          </div>
          <dl class="sf-about__list">
            <dt>Front end</dt>
            <dd>{{ format.app }}</dd>
            <dt>Storage</dt>
            <dd>
              {{ format.mode === 'container'
                ? 'Comments on @' + format.containerAuthor + ' container posts'
                : 'Top-level posts in ' + format.community }}
            </dd>
            <dt>Community</dt>
            <dd>
              <router-link :to="{ name: 'community', params: { username: format.community } }">#{{ format.community }}</router-link>
            </dd>
            <dt>Posting key</dt>
            <dd>posting · no active-key operation</dd>
          </dl>
        </section>
      </aside>
    </div>
  </section>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { setPageMeta } from 'src/utils/pageMeta'
import {
  fetchShortFormPage,
  getShortFormat,
  shortFormQueueItem,
  shortFormQueueSummary,
  shortFormatList
} from 'src/services/shortForm'
import DataNotice from 'components/ui/DataNotice.vue'
import InfiniteScroll from 'components/ui/InfiniteScroll.vue'
import ImageUploadButton from 'components/ImageUploadButton.vue'
import { imageFilesFromTransfer, insertImageMarkdown } from 'src/utils/media'

const ShortFormCard = defineAsyncComponent(() => import('components/shortForm/ShortFormCard.vue'))
const MAX_CHARS = 1000
const PAGE_SIZE = 20

export default {
  name: 'ShortFormTimeline',
  components: { DataNotice, InfiniteScroll, ShortFormCard, ImageUploadButton },
  props: {
    formatId: { type: String, required: true }
  },
  data () {
    return {
      formats: shortFormatList(),
      sort: 'new',
      items: [],
      container: null,
      cursor: null,
      done: false,
      loading: true,
      loadingMore: false,
      posting: false,
      error: null,
      body: '',
      savedSelection: null
    }
  },
  computed: {
    format () {
      return getShortFormat(this.formatId)
    },
    sortOptions () {
      return [
        { label: 'Newest', value: 'new' },
        { label: 'Top', value: 'top' }
      ]
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    remaining () {
      return MAX_CHARS - this.body.length
    },
    canPost () {
      return Boolean(this.loggedInUser) && this.body.trim().length > 0 && this.remaining >= 0 && !this.posting
    },
    placeholder () {
      return 'Share a quick ' + (this.format ? this.format.label.replace(/s$/, '') : 'post') + ' update…'
    }
  },
  watch: {
    formatId: {
      immediate: true,
      handler () {
        this.reload()
      }
    }
  },
  mounted () {
    this.updateMeta()
  },
  methods: {
    updateMeta () {
      const format = this.format
      if (!format) return
      setPageMeta({
        title: format.label + ' — Hive microblog',
        description: format.description + ' Read the latest ' + format.label + ' from ' + format.app + ' on the Hive blockchain and post with your posting key.',
        url: '/shorts/' + format.id
      })
    },
    /** Start again from the first page (format or sort change, refresh). */
    async reload () {
      if (!this.format) return
      this.loading = true
      this.loadingMore = false
      this.error = null
      this.cursor = null
      this.done = false
      this.items = []
      try {
        const page = await this.fetchPage(null)
        this.items = page.items
        this.cursor = page.cursor
        this.done = page.done
        this.container = this.items.find(item => item._container)?._container || null
      } catch (error) {
        this.error = error?.message || 'Unexpected error'
      } finally {
        this.loading = false
      }
    },
    async loadMore () {
      if (this.loadingMore || this.done) return
      this.loadingMore = true
      try {
        const page = await this.fetchPage(this.cursor)
        const seen = new Set(this.items.map(item => item.author + '/' + item.permlink))
        const fresh = page.items.filter(item => !seen.has(item.author + '/' + item.permlink))
        this.items = this.items.concat(fresh)
        this.cursor = page.cursor
        this.done = page.done || fresh.length === 0
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error?.message || 'Could not load more' })
      } finally {
        this.loadingMore = false
      }
    },
    fetchPage (cursor) {
      return fetchShortFormPage(this.formatId, {
        sort: this.sort,
        limit: PAGE_SIZE,
        observer: this.loggedInUser || '',
        cursor
      })
    },
    openPost (item) {
      this.$router.push({ name: 'short-form-post', params: { formatId: this.formatId, author: item.author, permlink: item.permlink } })
    },
    /**
     * Mirror a queued vote into the card's vote list so the weight picker,
     * counts and "you voted" state update straight away. The next feed load
     * replaces this with chain data.
     */
    onVoted ({ post, weight }) {
      const stats = post.stats || (post.stats = {})
      if (Number.isFinite(Number(stats.total_votes))) stats.total_votes = Number(stats.total_votes) + (post._voted ? 0 : 1)
      post._voted = true
      const votes = Array.isArray(post.active_votes) ? post.active_votes.slice() : []
      const index = votes.findIndex(vote => String(vote && vote.voter || '').toLowerCase() === String(this.loggedInUser).toLowerCase())
      const entry = {
        voter: this.loggedInUser,
        weight: Math.round(Number(weight) * 100),
        percent: Math.round(Number(weight) * 100),
        rshares: Math.round(Number(weight) * 100)
      }
      if (index >= 0) votes.splice(index, 1, entry)
      else votes.push(entry)
      post.active_votes = votes
    },
    onReblogged ({ author, permlink }) {
      const post = this.items.find(item => item.author === author && item.permlink === permlink)
      if (!post) return
      const list = Array.isArray(post.reblogged_by) ? post.reblogged_by.slice() : []
      if (!list.some(name => String(name).toLowerCase() === String(this.loggedInUser).toLowerCase())) list.push(this.loggedInUser)
      post.reblogged_by = list
    },
    captureSelection () {
      const textarea = this.$refs.body
      this.savedSelection = textarea
        ? { start: textarea.selectionStart, end: textarea.selectionEnd }
        : { start: this.body.length, end: this.body.length }
    },
    insertUploadedImages (images) {
      const result = insertImageMarkdown(this.body, images, this.savedSelection || {})
      this.body = result.body
      this.savedSelection = { start: result.cursor, end: result.cursor }
      this.$nextTick(() => {
        const textarea = this.$refs.body
        if (!textarea) return
        textarea.focus()
        textarea.setSelectionRange(result.cursor, result.cursor)
      })
    },
    onImagePaste (event) {
      const files = imageFilesFromTransfer(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      this.captureSelection()
      this.$refs.imageUpload?.uploadFiles(files)
    },
    onImageDrop (event) {
      const files = imageFilesFromTransfer(event.dataTransfer)
      if (!files.length) return
      event.preventDefault()
      this.captureSelection()
      this.$refs.imageUpload?.uploadFiles(files)
    },
    submit () {
      if (!this.canPost) return
      this.posting = true
      try {
        const item = shortFormQueueItem({
          format: this.formatId,
          username: this.loggedInUser,
          body: this.body,
          parent: this.container
        })
        this.$hiveStore.addToQueue(item)
        this.$q.notify({
          type: 'positive',
          message: 'Queued: ' + shortFormQueueSummary(item),
          caption: 'Sign it from the queue to publish on chain.'
        })
        this.body = ''
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error?.message || 'Could not queue the post' })
      } finally {
        this.posting = false
      }
    }
  }
}
</script>

<style scoped>
.sf {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.sf-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.sf-head__subtitle {
  max-width: 70ch;
  margin: 0.35rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.88rem;
}

.sf-head__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sf-tabs {
  display: flex;
  gap: 0.3rem;
  overflow-x: auto;
  margin: var(--space-3) 0;
  padding-bottom: 0.35rem;
  scrollbar-width: thin;
}

.sf-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  padding: 0.34rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}

.sf-tab:hover {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  color: var(--c-text-strong);
  text-decoration: none;
}

.sf-tab--active {
  border-color: var(--tab-color, var(--c-link));
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-text-strong);
}

.sf-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

@media (min-width: 1024px) {
  .sf-grid {
    grid-template-columns: minmax(0, 660px) 280px;
  }
}

.sf-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.sf-composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.sf-composer--locked,
.sf-composer--notice {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  color: var(--c-text-subtle);
  font-size: 0.86rem;
}

.sf-composer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.sf-composer__label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.sf-composer__count {
  color: var(--c-text-faint);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sf-composer__count--over {
  color: var(--c-negative);
}

.sf-composer__input {
  width: 100%;
  min-height: 78px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-shadow) 25%, transparent);
  color: var(--c-text);
  font: inherit;
  font-size: 0.92rem;
  line-height: 1.5;
  resize: vertical;
}

.sf-composer__input:focus-visible {
  border-color: var(--c-link);
  outline: 2px solid color-mix(in srgb, var(--c-link) 35%, transparent);
  outline-offset: 1px;
}

.sf-composer__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sf-composer__hint {
  color: var(--c-text-faint);
  font-size: 0.75rem;
}

.sf-composer__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
}

.sf-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sf-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sf-loading__row {
  border-radius: var(--radius-card);
}

.sf-end {
  margin: var(--space-3) 0 0;
  color: var(--c-text-faint);
  font-size: 0.8rem;
  text-align: center;
}

.sf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  color: var(--c-text-faint);
  text-align: center;
}

/* The shared panel header expects an inner padding wrapper (q-card-section in
   the dashboard cards). With a plain div it had none, so the eyebrow and title
   sat flush against the card edge. */
.sf-about__head {
  padding: 0.85rem 1rem 0.7rem;
}

.sf-about__list {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.4rem var(--space-3);
  margin: 0;
  padding: 0 1rem var(--space-4);
  font-size: 0.8rem;
}

.sf-about__list dt {
  color: var(--c-text-faint);
}

.sf-about__list dd {
  margin: 0;
  color: var(--c-text-soft);
  overflow-wrap: anywhere;
}
</style>
