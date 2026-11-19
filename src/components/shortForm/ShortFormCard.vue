<template>
  <article class="sfc" :style="{ '--sfc-accent': format.color }">
    <header class="sfc-head">
      <router-link :to="{ name: 'account', params: { username: post.author } }" class="sfc-author">
        <q-avatar size="30px" class="sfc-avatar">{{ initial }}</q-avatar>
        <span class="sfc-author__name">@{{ post.author }}</span>
      </router-link>
      <span class="sfc-meta">
        <q-badge v-if="format" :style="{ background: format.color, color: '#10161b' }" class="sfc-format">
          <q-icon :name="format.icon" size="11px" aria-hidden="true" /> {{ format.label }}
        </q-badge>
        <time :datetime="post.created" :title="fullTime">{{ age }}</time>
      </span>
    </header>

    <p v-if="preview" class="sfc-body">{{ preview }}</p>

    <div v-if="images.length" class="sfc-media" :class="{ 'sfc-media--multi': images.length > 1 }">
      <img
        v-for="(url, index) in images.slice(0, 4)"
        :key="url"
        :src="thumb(url)"
        :alt="'Image ' + (index + 1) + ' in @' + post.author + '\'s ' + (format ? format.label : 'post')"
        class="sfc-media__img"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />
    </div>

    <footer class="sfc-foot">
      <span class="sfc-stat" :title="voteHint">
        <q-icon name="favorite_border" size="15px" aria-hidden="true" />
        {{ votes }}
      </span>
      <span class="sfc-stat">
        <q-icon name="mode_comment" size="15px" aria-hidden="true" />
        {{ replies }}
      </span>
      <span v-if="payout" class="sfc-stat">
        <q-icon name="paid" size="15px" aria-hidden="true" />
        {{ payout }}
      </span>
      <span class="sfc-spacer" />
      <q-btn flat dense no-caps size="sm" icon="open_in_new" label="Open" @click="$emit('open')" />
      <q-btn flat dense no-caps size="sm" icon="reply" label="Reply" @click="$emit('reply')" />
    </footer>
  </article>
</template>

<script>
import moment from 'src/utils/time'
import { postPayoutLabel, postUserVoteDirection } from 'src/services/posts'
import { shortImages, shortPreview } from 'src/services/shortForm'

// Hive images are served resized and re-encoded by the Hive image proxy.
const IMAGE_PROXY = 'https://images.hive.blog/640x0/'

export default {
  name: 'ShortFormCard',
  props: {
    post: { type: Object, required: true },
    format: { type: Object, default: null },
    username: { type: String, default: null }
  },
  computed: {
    initial () {
      return String(this.post.author || '?').charAt(0).toUpperCase()
    },
    preview () {
      return shortPreview(this.post.body, 260)
    },
    images () {
      return shortImages(this.post)
    },
    votes () {
      const stats = this.post.stats
      if (stats && Number.isFinite(Number(stats.total_votes))) return stats.total_votes
      return Array.isArray(this.post.active_votes) ? this.post.active_votes.length : 0
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
    voteHint () {
      const direction = postUserVoteDirection(this.post, this.username)
      if (direction === 'up') return 'You upvoted this'
      if (direction === 'down') return 'You downvoted this'
      return this.votes + ' votes'
    }
  },
  methods: {
    thumb (url) {
      if (!/^https?:\/\//i.test(url) || url.startsWith(IMAGE_PROXY)) return url
      return IMAGE_PROXY + url.replace(/^https?:\/\//i, '')
    }
  }
}
</script>

<style scoped>
.sfc {
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--sfc-accent, #4fc3f7);
}

.sfc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sfc-author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: #e4eaed;
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
}

.sfc-author:hover {
  color: #81d4fa;
  text-decoration: none;
}

.sfc-avatar {
  background: rgba(255, 255, 255, 0.08);
  color: #cfd8dc;
  font-size: 0.82rem;
  font-weight: 700;
}

.sfc-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: #78909c;
  font-size: 0.75rem;
}

.sfc-format {
  gap: 0.15rem;
  padding: 1px 6px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sfc-body {
  margin: var(--space-2) 0 0;
  color: #dfe6ea;
  font-size: 0.92rem;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.sfc-media {
  display: grid;
  gap: 2px;
  margin-top: var(--space-2);
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.sfc-media--multi {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sfc-media__img {
  display: block;
  width: 100%;
  height: 160px;
  object-fit: cover;
  background: rgba(0, 0, 0, 0.25);
}

.sfc-media--multi .sfc-media__img {
  height: 120px;
}

.sfc-foot {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  color: #90a4ae;
  font-size: 0.76rem;
}

.sfc-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-variant-numeric: tabular-nums;
}

.sfc-spacer {
  flex: 1;
}
</style>
