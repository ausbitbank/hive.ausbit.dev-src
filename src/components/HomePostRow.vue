<template>
  <article class="home-post-row" :class="{ 'home-post-row--compact': compact }">
    <span v-if="rank" class="home-post-row__rank">{{ rank }}</span>

    <router-link
      v-if="postImage"
      :to="postLink"
      class="home-post-row__thumb"
      :aria-label="'Open post: ' + displayTitle"
    >
      <q-img :src="postImage" :alt="displayTitle" fit="cover" loading="lazy" />
    </router-link>

    <div class="home-post-row__body">
      <router-link :to="postLink" class="home-post-row__title">{{ displayTitle }}</router-link>
      <p v-if="showBody && bodyExcerpt" class="home-post-row__excerpt">{{ bodyExcerpt }}</p>
      <div class="home-post-row__meta">
        <router-link :to="'/@' + post.author">@{{ post.author }}</router-link>
        <span aria-hidden="true">·</span>
        <time :datetime="post.created" :title="absoluteTime">{{ timeLabel }}</time>
        <template v-if="communityTitle">
          <span aria-hidden="true">·</span>
          <span class="home-post-row__community">{{ communityTitle }}</span>
        </template>
        <span v-if="votedByMe" class="home-post-row__voted" title="You voted on this post">
          <q-icon name="thumb_up_alt" size="13px" aria-hidden="true" /> voted
        </span>
      </div>
    </div>

    <div v-if="!compact" class="home-post-row__stats">
      <span title="Votes" :class="{ 'is-voted': votedByMe }"><q-icon name="thumb_up_alt" aria-hidden="true" />{{ votes }}</span>
      <span title="Comments"><q-icon name="comment" aria-hidden="true" />{{ comments }}</span>
      <span title="Payout"><q-icon name="monetization_on" aria-hidden="true" />{{ payout }}</span>
    </div>
  </article>
</template>

<style scoped>
.home-post-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0;
  border-top: 1px solid var(--border-subtle);
}

.home-post-row:first-child {
  border-top: 0;
}

.home-post-row__rank {
  flex: none;
  width: 1.15rem;
  color: var(--c-text-faint);
  font-size: 0.74rem;
  font-weight: 600;
  text-align: center;
}

.home-post-row__thumb {
  flex: none;
  width: 72px;
  height: 54px;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--c-bg-deep);
}

.home-post-row__thumb :deep(.q-img) {
  width: 100%;
  height: 100%;
}

.home-post-row__body {
  flex: 1;
  min-width: 0;
}

.home-post-row__title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
  text-decoration: none;
}

.home-post-row__title:hover {
  color: var(--c-link-hover);
}

.home-post-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
}

.home-post-row__meta a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.home-post-row__meta a:hover {
  color: var(--c-link-hover);
}

.home-post-row__community {
  color: var(--c-link);
}

.home-post-row__voted {
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
  color: var(--c-positive);
}

.home-post-row__excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0.18rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.4;
}

.home-post-row__stats span.is-voted {
  color: var(--c-positive);
}

.home-post-row__stats {
  display: flex;
  flex: none;
  gap: 0.55rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.home-post-row__stats span {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  white-space: nowrap;
}

.home-post-row--compact {
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.home-post-row--compact .home-post-row__thumb {
  width: 46px;
  height: 40px;
}

.home-post-row--compact .home-post-row__title {
  font-size: 0.82rem;
}

.home-post-row--compact .home-post-row__meta {
  font-size: 0.68rem;
}

@media (max-width: 599px) {
  .home-post-row__thumb {
    width: 58px;
    height: 46px;
  }

  .home-post-row__stats {
    display: none;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import { stripMarkdownImages, stripMarkdownLinks } from 'src/utils/media'
import { postImage } from 'src/utils/postPreview'
import {
  postCommentCount,
  postCommunityTitle,
  postDisplayTitle,
  postPayoutLabel,
  postVotes
} from 'src/services/posts'

export default {
  name: 'homePostRow',
  props: {
    post: { type: Object, required: true },
    rank: { type: Number, default: 0 },
    compact: { type: Boolean, default: false },
    /** Show a short, read-in-place excerpt of the post or comment body. */
    showBody: { type: Boolean, default: false }
  },
  computed: {
    bodyExcerpt () {
      if (!this.showBody) return ''
      const raw = stripMarkdownLinks(stripMarkdownImages(String(this.post.body || '')))
        .replace(/<[^>]+>/g, ' ')
        .replace(/[#*_>`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (!raw) return ''
      return raw.length > 220 ? raw.slice(0, 217).trimEnd() + '…' : raw
    },
    votedByMe () {
      const user = this.$hiveStore.user.username
      if (!user || !Array.isArray(this.post.active_votes)) return false
      return this.post.active_votes.some(vote => vote.voter === user && Number(vote.percent) > 0)
    },
    displayTitle () {
      return postDisplayTitle(this.post)
    },
    postImage () {
      return postImage(this.post) || ''
    },
    communityTitle () {
      return postCommunityTitle(this.post)
    },
    votes () {
      return postVotes(this.post)
    },
    comments () {
      return postCommentCount(this.post)
    },
    payout () {
      return postPayoutLabel(this.post)
    },
    postLink () {
      return '/@' + this.post.author + '/' + this.post.permlink
    },
    timeLabel () {
      return this.post.created ? moment.utc(this.post.created).fromNow() : ''
    },
    absoluteTime () {
      return this.post.created ? moment.utc(this.post.created).format('D MMM YYYY, HH:mm') + ' UTC' : ''
    }
  }
}
</script>
