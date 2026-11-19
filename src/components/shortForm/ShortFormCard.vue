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

    <p v-if="preview" class="sfc-body" @click="$emit('open')">{{ preview }}</p>

    <short-form-media :items="media" :author="post.author" :linked="true" />

    <footer class="sfc-foot">
      <button type="button" class="sfc-action sfc-action--vote" :class="{ 'sfc-action--down': voteDirection === 'down' }" :title="voteHint" @click="$emit('vote', post)">
        <q-icon :name="voteDirection === 'up' ? 'favorite' : voteDirection === 'down' ? 'heart_broken' : 'favorite_border'" size="17px" aria-hidden="true" />
        <span>{{ votes }}</span>
      </button>
      <button type="button" class="sfc-action" title="Replies" @click="$emit('open', post)">
        <q-icon name="mode_comment" size="16px" aria-hidden="true" />
        <span>{{ replies }}</span>
      </button>
      <button type="button" class="sfc-action" title="Reblog" @click="$emit('reblog', post)">
        <q-icon name="repeat" size="17px" aria-hidden="true" />
        <span>{{ reblogs }}</span>
      </button>
      <span v-if="payout" class="sfc-action sfc-action--static" :title="'Pending payout'">
        <q-icon name="paid" size="15px" aria-hidden="true" />
        <span>{{ payout }}</span>
      </span>
      <span class="sfc-spacer" />
      <q-btn flat dense no-caps size="sm" icon="open_in_new" label="Open" @click="$emit('open', post)" />
      <q-btn flat dense no-caps size="sm" icon="reply" label="Reply" @click="$emit('open', post)" />
    </footer>
  </article>
</template>

<script>
import moment from 'src/utils/time'
import { postPayoutLabel, postUserVoteDirection } from 'src/services/posts'
import { shortFormUrl, shortMedia, shortPreview } from 'src/services/shortForm'
import ShortFormMedia from 'components/shortForm/ShortFormMedia.vue'

const DEFAULT_ACCENT = '#4fc3f7'

export default {
  name: 'ShortFormCard',
  components: { ShortFormMedia },
  props: {
    post: { type: Object, required: true },
    format: { type: Object, default: null },
    username: { type: String, default: null }
  },
  emits: ['open', 'vote', 'reblog'],
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
    votes () {
      const stats = this.post.stats
      if (stats && Number.isFinite(Number(stats.total_votes))) return stats.total_votes
      return Array.isArray(this.post.active_votes) ? this.post.active_votes.length : 0
    },
    replies () {
      return Number(this.post.children) || 0
    },
    reblogs () {
      return Number(this.post.reblogs) || (Array.isArray(this.post.reblogged_by) ? this.post.reblogged_by.length : 0)
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
    voteDirection () {
      return postUserVoteDirection(this.post, this.username)
    },
    voteHint () {
      if (this.voteDirection === 'up') return 'You upvoted this'
      if (this.voteDirection === 'down') return 'You downvoted this'
      return this.votes + ' votes'
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
  border-left: 3px solid var(--sfc-accent, #4fc3f7);
  transition: border-color 0.15s ease;
}

.sfc:hover {
  border-color: rgba(255, 255, 255, 0.16);
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
  color: #e4eaed;
  text-decoration: none;
}

.sfc-author:hover {
  color: #81d4fa;
  text-decoration: none;
}

.sfc-avatar {
  flex: none;
  background: rgba(255, 255, 255, 0.08);
  color: #cfd8dc;
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
  color: #78909c;
  font-size: 0.74rem;
}

.sfc-format {
  font-weight: 700;
}

.sfc-body {
  margin: var(--space-2) 0 0;
  color: #dfe6ea;
  font-size: 0.94rem;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.sfc-body:hover {
  color: #fff;
}

.sfc-foot {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding-top: var(--space-1);
  border-top: 1px solid var(--border-subtle);
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
  color: #90a4ae;
  font: inherit;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.sfc-action:hover {
  background: rgba(79, 195, 247, 0.1);
  color: #e4eaed;
}

.sfc-action--vote:hover {
  color: #ff8a80;
}

.sfc-action--down {
  color: #ef9a9a;
}

.sfc-action--static {
  cursor: default;
}

.sfc-action--static:hover {
  background: transparent;
  color: #90a4ae;
}

.sfc-spacer {
  flex: 1;
}
</style>
