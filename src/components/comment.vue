<template>
  <article
    class="comment"
    :class="{ 'comment--nested': depth > 1, 'comment--root': depth === 1 }"
    :style="{ '--indent': indentLevel }"
  >
    <header class="comment__header">
      <router-link :to="linkAccount(comment.author)" class="comment__avatar" :aria-label="'View @' + comment.author + ' profile'">
        <q-avatar size="26px">
          <q-img :src="getHiveAvatarUrl(comment.author)" :alt="'Avatar of @' + comment.author" />
        </q-avatar>
      </router-link>
      <router-link :to="linkAccount(comment.author)" class="comment__author">@{{ comment.author }}</router-link>
      <span class="comment__rep" :title="'Reputation ' + reputation">{{ reputation }}</span>
      <span class="comment__dot">·</span>
      <router-link
        :to="linkPost(comment.author, comment.permlink)"
        class="comment__time-link"
        :title="'View this comment - ' + comment.created"
        :aria-label="'View comment by @' + comment.author"
      >
        <time class="comment__time" :datetime="comment.created">{{ timeDelta(comment.created) }}</time>
      </router-link>
      <span v-if="comment.children" class="comment__reply-count">
        {{ comment.children }} {{ comment.children === 1 ? 'reply' : 'replies' }}
      </span>
      <q-badge v-if="comment.stats && comment.stats.hide" color="grey-9" class="comment__flag">hidden</q-badge>
      <q-badge v-else-if="comment.stats && comment.stats.gray" color="grey-9" class="comment__flag">gray</q-badge>
    </header>

    <render :input="comment.body" class="postbody comment__body" />

    <post-footer :post="comment" compact class="comment__footer" @posted="$emit('posted')" />
  </article>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import render from 'components/render.vue'
import moment from 'src/utils/time'
import { formatReputation } from 'src/services/comments'
import { hiveAvatarUrl } from 'src/utils/avatar'

export default {
  name: 'comment',
  emits: ['posted'],
  components: {
    render,
    postFooter: defineAsyncComponent(() => import('components/postFooter.vue'))
  },
  props: {
    comment: { type: Object, required: true },
    depth: { type: Number, default: 1 }
  },
  computed: {
    reputation () {
      return formatReputation(this.comment.author_reputation)
    },
    indentLevel () {
      return Math.min(Math.max((this.depth || 1) - 1, 0), 4)
    }
  },
  methods: {
    linkAccount (author) { return '/@' + author },
    linkPost (author, permlink) { return '/@' + author + '/' + permlink },
    getHiveAvatarUrl (user) { return hiveAvatarUrl(user) },
    timeDelta (timestamp) {
      const now = moment.utc()
      const stamp = moment.utc(timestamp)
      return moment.duration(stamp.diff(now, 'minutes'), 'minutes').humanize(true)
    }
  }
}
</script>

<style scoped>
.comment {
  padding: 0.85rem 0;
}

.comment--root + .comment--root {
  border-top: 1px solid var(--border-subtle);
}

.comment--nested {
  margin-left: calc(var(--indent) * 16px);
  padding-left: 12px;
  border-left: 2px solid color-mix(in srgb, var(--c-primary) 28%, transparent);
}

.comment__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  min-width: 0;
  font-size: 0.8rem;
  color: var(--c-text-subtle);
}

.comment__avatar {
  display: inline-flex;
  flex: none;
}

.comment__author {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--c-text);
}

.comment__rep {
  padding: 0 0.3rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-muted);
  font-size: 0.7rem;
  line-height: 1.5;
}

.comment__dot {
  color: var(--c-text-faint);
}

.comment__time-link {
  color: inherit;
  text-decoration: none;
}

.comment__time-link:hover .comment__time {
  color: var(--c-text);
  text-decoration: underline;
  text-underline-offset: 0.14em;
}

.comment__reply-count {
  color: var(--c-text-faint);
  font-size: 0.75rem;
}

.comment__flag {
  font-size: 0.62rem;
}

.comment__body {
  margin: 0.4rem 0 0.1rem 2.15rem;
  font-size: 0.94rem;
  line-height: 1.6;
  color: var(--c-text-soft);
}

.comment__body :deep(p:last-child) {
  margin-bottom: 0;
}

.comment__body :deep(img) {
  margin: 0.7em auto;
}

.comment__footer {
  margin-left: 2.15rem;
}

@media (max-width: 599px) {
  .comment {
    padding: 0.7rem 0;
  }

  .comment--nested {
    margin-left: calc(var(--indent) * 9px);
    padding-left: 8px;
  }

  .comment__body,
  .comment__footer {
    margin-left: 0;
    font-size: 0.9rem;
  }
}
</style>
