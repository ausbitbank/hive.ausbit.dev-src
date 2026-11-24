<template>
  <section id="comments" class="comments" aria-labelledby="comments-heading">
    <header class="comments__header">
      <div class="comments__heading">
        <h2 id="comments-heading" class="comments__title">Comments</h2>
        <span class="comments__count">{{ count }}</span>
      </div>

      <div v-if="started && !loading && !error" class="comments__controls">
        <q-btn
          v-if="loggedInUser"
          flat
          dense
          no-caps
          icon="edit"
          :label="$q.screen.gt.xs ? 'Write a comment' : ''"
          aria-label="Write a comment"
          @click="composerOpen = true"
        />
        <q-btn flat dense round icon="refresh" aria-label="Refresh comments" title="Refresh comments" :loading="refreshing" @click="fetchComments" />
        <q-select
          v-model="sort"
          :options="sortOptions"
          dense
          options-dense
          borderless
          emit-value
          map-options
          class="comments__sort"
          aria-label="Sort comments"
        />
        <q-btn flat dense round icon="tune" aria-label="Comment filters" title="Comment filters">
          <q-popup-proxy>
            <q-card class="comments__filter-card">
              <q-card-section>
                <div class="comments__filter-title">Comment filters</div>
                <q-checkbox v-model="showFiltered" label="Show hidden or flagged comments" dense />
              </q-card-section>
            </q-card>
          </q-popup-proxy>
        </q-btn>
      </div>
    </header>

    <div v-if="!started" class="comments__intro">
      <q-icon name="forum" size="28px" class="comments__intro-icon" aria-hidden="true" />
      <p class="comments__intro-text">
        {{ count > 0 ? count + ' replies so far. Join the conversation.' : 'No comments yet. Start the conversation.' }}
      </p>
      <div class="comments__intro-actions">
        <q-btn
          v-if="count > 0"
          unelevated
          no-caps
          color="primary"
          icon="forum"
          label="Load comments"
          @click="start"
        />
        <q-btn
          v-if="loggedInUser"
          outline
          no-caps
          color="primary"
          icon="edit"
          :label="count > 0 ? 'Write a comment' : 'Write the first comment'"
          @click="composerOpen = true"
        />
        <span v-else class="comments__login-hint">Log in to join the conversation.</span>
      </div>
    </div>

    <div v-else-if="loading" class="comments__loading" aria-label="Loading comments">
      <div v-for="i in 3" :key="i" class="comments__skeleton">
        <q-skeleton type="circle" size="26px" />
        <div class="comments__skeleton-lines">
          <q-skeleton type="text" width="28%" />
          <q-skeleton type="text" />
          <q-skeleton type="text" width="72%" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="comments__state comments__state--error">
      <q-icon name="error_outline" size="28px" color="orange" aria-hidden="true" />
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" icon="refresh" label="Try again" @click="fetchComments" />
    </div>

    <template v-else>
      <div v-if="visibleComments.length === 0" class="comments__state">
        <p>{{ count > 0 ? 'No comments match the current filters.' : 'No comments yet.' }}</p>
      </div>

      <infinite-scroll
        v-else
        :can-load="hasMore"
        :loading="paging"
        :offset="300"
        @load="loadMore"
      >
        <div class="comments__list">
          <comment
            v-for="item in visibleComments"
            :key="item.key"
            :comment="item.comment"
            :depth="item.depth"
            :force-show="showFiltered"
            @posted="onCommentPosted"
          />
        </div>
      </infinite-scroll>

      <div v-if="visibleComments.length" class="comments__footer">
        <span class="comments__progress">
          Showing {{ visibleComments.length }} of {{ totalComments }} comments
        </span>
        <q-btn
          v-if="!hasMore && totalComments > pageSize"
          flat
          no-caps
          color="primary"
          icon="vertical_align_top"
          label="Back to post"
          @click="backToPost"
        />
      </div>
    </template>

    <q-dialog v-model="composerOpen">
      <q-card class="comments__composer">
        <comment-form
          heading="Write a comment"
          :context="'Commenting on @' + author"
          submit-label="Comment"
          :parent-author="author"
          :parent-permlink="permlink"
          @cancel="composerOpen = false"
          @posted="onCommentPosted"
        />
      </q-card>
    </q-dialog>
  </section>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import comment from 'components/comment.vue'
import {
  COMMENT_SORT_OPTIONS,
  countDiscussion,
  flattenDiscussion
} from 'src/services/comments'

const PAGE_SIZE = 30

export default {
  name: 'comments',
  components: {
    comment,
    commentForm: defineAsyncComponent(() => import('components/CommentForm.vue')),
    infiniteScroll: defineAsyncComponent(() => import('components/ui/InfiniteScroll.vue'))
  },
  props: {
    author: { type: String, required: true },
    permlink: { type: String, required: true },
    commentCount: { type: Number, default: 0 },
    refreshToken: { type: Number, default: 0 }
  },
  data () {
    return {
      discussion: null,
      started: false,
      loading: false,
      error: '',
      sort: 'best',
      showFiltered: false,
      visibleCount: PAGE_SIZE,
      pageSize: PAGE_SIZE,
      paging: false,
      composerOpen: false,
      refreshing: false,
      refreshTimer: null,
      sortOptions: COMMENT_SORT_OPTIONS
    }
  },
  computed: {
    rootKey () {
      return this.author + '/' + this.permlink
    },
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    totalComments () {
      return countDiscussion(this.discussion, this.rootKey)
    },
    count () {
      if (this.started && this.discussion) return this.totalComments
      return Number(this.commentCount) || 0
    },
    flatComments () {
      if (!this.discussion) return []
      return flattenDiscussion(this.discussion, this.rootKey, {
        sort: this.sort,
        showFiltered: this.showFiltered
      })
    },
    visibleComments () {
      return this.flatComments.slice(0, this.visibleCount)
    },
    hasMore () {
      return this.visibleCount < this.flatComments.length
    }
  },
  watch: {
    sort () {
      this.visibleCount = PAGE_SIZE
    },
    showFiltered () {
      this.visibleCount = PAGE_SIZE
    },
    refreshToken () {
      this.started = true
      this.fetchComments()
    }
  },
  mounted () {
    if (window.location.hash === '#comments') this.start()
  },
  beforeUnmount () {
    clearTimeout(this.refreshTimer)
  },
  methods: {
    start () {
      if (this.started) return
      this.started = true
      this.fetchComments()
    },
    async fetchComments () {
      const hasDiscussion = Boolean(this.discussion)
      this.error = ''
      if (hasDiscussion) {
        this.refreshing = true
      } else {
        this.loading = true
      }

      const params = { author: this.author, permlink: this.permlink }
      if (this.loggedInUser) params.observer = this.loggedInUser

      try {
        this.discussion = await this.$hive.api.callAsync('bridge.get_discussion', params)
        if (!hasDiscussion) this.visibleCount = PAGE_SIZE
      } catch (error) {
        console.error('Failed to load comments', error)
        if (hasDiscussion) {
          this.$q.notify({ type: 'negative', message: 'Could not refresh comments' })
        } else {
          this.error = 'Could not load comments. The API node may be busy.'
        }
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },
    onCommentPosted () {
      this.composerOpen = false
      this.scheduleRefresh()
    },
    scheduleRefresh () {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = setTimeout(() => {
        this.started = true
        this.fetchComments()
      }, 4500)
    },
    loadMore () {
      // The next page is already in memory, so flag the request for one tick.
      // This gives the infinite scroller a completion signal while keeping the
      // pagination trivially synchronous.
      this.paging = true
      this.visibleCount += PAGE_SIZE
      this.$nextTick(() => { this.paging = false })
    },
    backToPost () {
      const post = document.querySelector('.post-article')
      post?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}
</script>

<style scoped>
.comments {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.comments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.comments__heading {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.comments__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
}

.comments__count {
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.comments__controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.comments__sort {
  width: 140px;
  font-size: 0.82rem;
}

.comments__filter-card {
  min-width: 250px;
}

.comments__filter-title {
  margin-bottom: var(--space-2);
  font-weight: 600;
}

.comments__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-2);
  text-align: center;
}

.comments__intro-icon {
  color: var(--c-text-faint);
}

.comments__intro-text {
  margin: 0;
  color: var(--c-text-muted);
}

.comments__intro-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.comments__login-hint {
  color: var(--c-text-subtle);
  font-size: 0.85rem;
}

.comments__loading {
  padding-top: var(--space-3);
}

.comments__skeleton {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.comments__skeleton-lines {
  flex: 1;
  min-width: 0;
}

.comments__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-2);
  text-align: center;
  color: var(--c-text-muted);
}

.comments__list {
  padding-top: var(--space-1);
}

.comments__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

.comments__progress {
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.comments__composer {
  width: min(720px, 94vw);
  max-height: 90vh;
  overflow: auto;
}

@media (max-width: 599px) {
  .comments {
    padding: var(--space-3);
  }

  .comments__sort {
    width: 120px;
  }

  .comments__footer {
    justify-content: center;
  }
}
</style>
