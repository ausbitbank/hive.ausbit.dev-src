<template>
  <article class="sfc home-card" :style="{ '--sfc-accent': accentColor }">
    <header class="sfc-head">
      <router-link :to="{ name: 'account', params: { username: post.author } }" class="sfc-author">
        <q-avatar size="34px" class="sfc-avatar">{{ initial }}</q-avatar>
        <span class="sfc-author__meta">
          <span class="sfc-author__name">@{{ post.author }}</span>
          <span class="sfc-author__sub">
            <span v-if="format" class="sfc-format" :style="{ color: accentColor }">{{ format.label }}</span>
            <span aria-hidden="true">·</span>
            <time :datetime="post.created" :title="fullTime">{{ age }}</time>
          </span>
        </span>
      </router-link>
      <q-btn flat dense round size="sm" icon="more_horiz" aria-label="Open on front end" :href="externalUrl" target="_blank" rel="noopener noreferrer" />
    </header>

    <p v-if="preview" class="sfc-body" @click="$emit('open', post)">{{ preview }}</p>

    <short-form-media :items="media" :author="post.author" :linked="true" />

    <footer class="sfc-foot">
      <!-- The same control as blog posts: shows totals and your own vote, and
           opens the weight picker instead of voting at full weight directly. -->
      <vote
        class="sfc-vote"
        :votes="post.active_votes"
        :author="post.author"
        :permlink="post.permlink"
        @Voted="weight => $emit('voted', { post, weight })"
      />
      <button type="button" class="sfc-action" title="Replies" @click="$emit('open', post)">
        <q-icon name="mode_comment" size="16px" aria-hidden="true" />
        <span>{{ replies }}</span>
      </button>
      <reblog
        class="sfc-reblog"
        :author="post.author"
        :permlink="post.permlink"
        :reblogged="alreadyReblogged"
        @queued="$emit('reblog', post)"
      />
      <span v-if="payout" class="sfc-action sfc-action--static" :title="'Pending payout'">
        <q-icon name="paid" size="15px" aria-hidden="true" />
        <span>{{ payout }}</span>
      </span>
      <span class="sfc-spacer" />
      <q-btn flat dense no-caps size="sm" icon="open_in_new" label="Open" @click="$emit('open', post)" />
    </footer>
  </article>
</template>

<script>
import moment from 'src/utils/time'
import { postPayoutLabel } from 'src/services/posts'
import { shortFormUrl, shortMedia, shortPreview } from 'src/services/shortForm'
import ShortFormMedia from 'components/shortForm/ShortFormMedia.vue'
import Vote from 'components/vote.vue'
import Reblog from 'components/reblog.vue'

const DEFAULT_ACCENT = 'var(--c-link)'

export default {
  name: 'ShortFormCard',
  components: { ShortFormMedia, Vote, Reblog },
  props: {
    post: { type: Object, required: true },
    format: { type: Object, default: null },
    username: { type: String, default: null }
  },
  emits: ['open', 'voted', 'reblog'],
  computed: {
    accentColor () {
      return (this.format && this.format.color) || DEFAULT_ACCENT
    },
    initial () {
      return String(this.post.author || '?').charAt(0).toUpperCase()
    },
    preview () {
      return shortPreview(this.post.body, 280)
    },
    media () {
      return shortMedia(this.post)
    },
    replies () {
      return Number(this.post.children) || 0
    },
    payout () {
      const label = postPayoutLabel(this.post)
      return label === '0 HBD' ? '' : label
    },
    age () {
      return this.post.created ? moment.utc(this.post.created).fromNow() : ''
    },
    fullTime () {
      return this.post.created ? moment.utc(this.post.created).format('D MMM YYYY, HH:mm') : ''
    },
    /** Reflect a reblog already on chain rather than relying on local state. */
    alreadyReblogged () {
      if (!this.username) return false
      const voter = String(this.username).toLowerCase()
      return this.rebloggers.some(name => String(name).toLowerCase() === voter)
    },
    rebloggers () {
      return Array.isArray(this.post.reblogged_by) ? this.post.reblogged_by : []
    },
    externalUrl () {
      return shortFormUrl(this.post, this.format && this.format.id)
    }
  }
}
</script>

<style scoped>
.sfc {
  padding: var(--space-3) var(--space-3) var(--space-2);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--sfc-accent, var(--c-link));
  transition: border-color 0.15s ease;
}

.sfc:hover {
  border-color: color-mix(in srgb, var(--c-text) 16%, transparent);
}

.sfc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.sfc-author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  color: var(--c-text);
  text-decoration: none;
}

.sfc-author:hover {
  color: var(--c-link-hover);
  text-decoration: none;
}

.sfc-avatar {
  flex: none;
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-soft);
  font-size: 0.9rem;
  font-weight: 700;
}

.sfc-author__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.sfc-author__name {
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
}

.sfc-author__sub {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.sfc-format {
  font-weight: 700;
}

.sfc-body {
  margin: var(--space-2) 0 0;
  color: var(--c-text-soft);
  font-size: 0.94rem;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.sfc-body:hover {
  color: var(--c-text-strong);
}

.sfc-foot {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-top: var(--space-2);
  padding-top: var(--space-1);
  border-top: 1px solid var(--border-subtle);
}

/* Give the shared vote and reblog controls the same compact rhythm as the
   card's own action buttons. */
.sfc-foot :deep(.vote-control),
.sfc-foot :deep(.reblog-btn) {
  flex: none;
}

.sfc-action {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 32px;
  padding: 0.2rem 0.5rem;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--c-text-subtle);
  font: inherit;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.sfc-action:hover {
  background: color-mix(in srgb, var(--c-link) 10%, transparent);
  color: var(--c-text);
}

.sfc-action--static {
  cursor: default;
}

.sfc-action--static:hover {
  background: transparent;
  color: var(--c-text-subtle);
}

.sfc-spacer {
  flex: 1;
}
</style>
