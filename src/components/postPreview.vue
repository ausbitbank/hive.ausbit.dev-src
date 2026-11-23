<template>
  <article
    class="post-card"
    :class="cardClasses"
    :aria-labelledby="titleId"
  >
    <div v-if="rebloggers.length" class="post-card__reblog">
      <q-icon name="repeat" size="16px" aria-hidden="true" />
      <q-avatar size="18px">
        <q-img :src="avatarUrl(rebloggers[0])" :alt="'Avatar of @' + rebloggers[0]" />
      </q-avatar>
      <span>
        Reblogged by
        <router-link :to="linkAccount(rebloggers[0])">@{{ rebloggers[0] }}</router-link>
        <template v-if="rebloggers.length > 1"> and {{ rebloggers.length - 1 }} more</template>
      </span>
    </div>

    <router-link
      v-if="styleType === 'list' && hasImage"
      :to="postLink"
      class="post-card__thumb"
      :aria-label="openLabel"
    >
      <q-img
        :src="postImage"
        :alt="displayTitle"
        fit="cover"
        loading="lazy"
        class="post-card__img"
        @error="imageFailed = true"
      />
      <span v-if="isVideo" class="post-card__play" aria-hidden="true">
        <q-icon name="play_arrow" />
      </span>
    </router-link>

    <router-link
      v-if="styleType === 'cards'"
      :to="postLink"
      class="post-card__media"
      :aria-label="openLabel"
    >
      <q-img
        v-if="hasImage"
        :src="postImage"
        :alt="displayTitle"
        fit="cover"
        loading="lazy"
        class="post-card__img"
        @error="imageFailed = true"
      />
      <div v-else class="post-card__placeholder" aria-hidden="true">
        <q-icon name="article" />
      </div>
      <span v-if="isVideo" class="post-card__play" aria-hidden="true">
        <q-icon name="play_arrow" />
      </span>
      <span v-if="communityTitle" class="post-card__community-overlay">{{ communityTitle }}</span>
    </router-link>

    <div class="post-card__body">
      <div class="post-card__meta">
        <router-link :to="linkAccount(post.author)" class="post-card__author">
          <q-avatar size="22px">
            <q-img :src="avatarUrl(post.author)" :alt="'Avatar of @' + post.author" />
          </q-avatar>
          <span class="post-card__author-name">@{{ post.author }}</span>
        </router-link>
        <span v-if="reputation" class="post-card__rep" :title="'Reputation ' + reputation">{{ reputation }}</span>
        <span class="post-card__dot">·</span>
        <time :datetime="post.created" :title="absoluteTime">{{ timeLabel }}</time>
        <span v-if="isPinned" class="post-card__badge">Pinned</span>
        <span v-if="isComment" class="post-card__badge post-card__badge--comment">Comment</span>
        <span v-if="hasAiDisclosure" class="post-card__badge post-card__badge--ai" :title="aiToolLabels.join(' · ')">
          <q-icon name="smart_toy" size="12px" aria-hidden="true" />AI
        </span>
        <span v-if="isPortfolio" class="post-card__badge" title="Shown in the author's portfolio">Portfolio</span>
        <span v-if="isCollection" class="post-card__badge" title="Collection of posts">Collection</span>
        <span v-if="countdownLabel" class="post-card__badge post-card__badge--countdown">
          <q-icon name="timer" size="12px" aria-hidden="true" />{{ countdownLabel }}
        </span>
        <span v-if="isComment && post.parent_author" class="post-card__reply-to">to @{{ post.parent_author }}</span>
        <q-space />
        <router-link
          v-if="communityTitle && styleType === 'list' && post.community"
          :to="communityLink"
          class="post-card__community-inline"
        >
          {{ communityTitle }}
        </router-link>
      </div>

      <h3 :id="titleId" class="post-card__title">
        <router-link :to="postLink">{{ displayTitle }}</router-link>
      </h3>

      <p v-if="summary" class="post-card__summary">{{ summary }}</p>

      <div v-if="tags.length" class="post-card__tags">
        <template v-for="tag in tags" :key="tag">
          <router-link v-if="linkTag(tag)" :to="linkTag(tag)" class="post-card__tag">#{{ tag }}</router-link>
          <span v-else class="post-card__tag" :title="'#' + tag + ' is not a valid Hive tag'">#{{ tag }}</span>
        </template>
      </div>

      <footer class="post-card__footer">
        <span
          class="post-card__stat post-card__stat--votes"
          :class="userVote ? 'post-card__stat--voted-' + userVote : null"
          :title="userVoteTitle || 'Votes'"
          :aria-label="userVoteTitle || votes + ' votes'"
        >
          <q-icon :name="userVote === 'down' ? 'thumb_down' : 'thumb_up'" aria-hidden="true" />{{ votes }}
          <span v-if="userVote" class="post-card__voted-label">{{ userVote === 'down' ? 'Downvoted' : 'Upvoted' }}</span>
        </span>
        <span class="post-card__stat" title="Comments">
          <q-icon name="comment" aria-hidden="true" />{{ commentCount }}
        </span>
        <span class="post-card__stat" title="Payout">
          <q-icon name="monetization_on" aria-hidden="true" />{{ payoutLabel }}
        </span>
        <span v-if="rebloggers.length" class="post-card__stat" title="Reblogs">
          <q-icon name="repeat" aria-hidden="true" />{{ rebloggers.length }}
        </span>
        <q-space />
        <router-link :to="postLink" class="post-card__read">
          {{ readLabel }} <q-icon name="arrow_forward" size="16px" aria-hidden="true" />
        </router-link>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.post-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.post-card:hover {
  border-color: color-mix(in srgb, var(--c-link) 32%, transparent);
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}

.post-card__reblog {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--c-link) 7%, transparent);
  color: var(--c-text-muted);
  font-size: 0.75rem;
}

.post-card__reblog a {
  color: var(--c-link-hover);
  font-weight: 600;
}

.post-card__media,
.post-card__thumb {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--c-bg-deep);
}

.post-card__media {
  aspect-ratio: 16 / 9;
}

.post-card__thumb {
  min-height: 150px;
}

.post-card__img,
.post-card__thumb :deep(.q-img),
.post-card__media :deep(.q-img) {
  width: 100%;
  height: 100%;
}

.post-card__img {
  display: block;
  transition: transform 0.3s ease;
}

.post-card:hover .post-card__img {
  transform: scale(1.025);
}

.post-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 150px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--c-primary) 20%, transparent), color-mix(in srgb, var(--c-accent) 12%, transparent));
  color: color-mix(in srgb, var(--c-text) 32%, transparent);
  font-size: 2.6rem;
}

.post-card__community-overlay {
  position: absolute;
  left: 0.6rem;
  bottom: 0.6rem;
  max-width: calc(100% - 1.2rem);
  padding: 0.12rem 0.5rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-bg-deep) 82%, transparent);
  color: var(--c-text);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 3Speak cards show a play badge over the thumbnail so a video is obvious
   while scanning a feed, even when the thumbnail itself has no play glyph. */
.post-card__play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid color-mix(in srgb, var(--c-text) 35%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-bg-deep) 72%, transparent);
  color: #fff;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: background 0.15s ease, transform 0.15s ease;
}

.post-card__play :deep(.q-icon) {
  font-size: 30px;
}

.post-card:hover .post-card__play {
  background: color-mix(in srgb, var(--c-bg-deep) 86%, transparent);
  transform: translate(-50%, -50%) scale(1.05);
}

@media (max-width: 599px) {
  .post-card__play {
    width: 44px;
    height: 44px;
  }

  .post-card__play :deep(.q-icon) {
    font-size: 24px;
  }
}

.post-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.8rem 0.95rem 0.75rem;
}

.post-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.28rem 0.4rem;
  min-width: 0;
  color: var(--c-text-subtle);
  font-size: 0.75rem;
}

.post-card__author {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: var(--c-text);
  text-decoration: none;
}

.post-card__author-name {
  max-width: 11rem;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-card__rep {
  padding: 0 0.3rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-muted);
  font-size: 0.66rem;
}

.post-card__dot {
  color: var(--c-text-faint);
}

.post-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0 0.32rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-muted);
  font-size: 0.63rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.post-card__badge--comment {
  background: color-mix(in srgb, var(--c-info) 14%, transparent);
  color: var(--c-info);
}

.post-card__badge--ai {
  background: color-mix(in srgb, var(--c-link) 12%, transparent);
  color: var(--c-link-hover);
}

.post-card__badge--countdown {
  background: color-mix(in srgb, var(--c-warning) 12%, transparent);
  color: var(--c-warning-soft);
  letter-spacing: 0;
  text-transform: none;
}

.post-card__reply-to {
  color: var(--c-text-faint);
}

.post-card__community-inline {
  color: var(--c-link);
  font-size: 0.71rem;
}

.post-card__title {
  margin: 0.05rem 0 0;
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.32;
  overflow-wrap: anywhere;
}

.post-card__title a {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--c-text);
  text-decoration: none;
}

.post-card__title a:hover {
  color: var(--c-link-hover);
}

.post-card__summary {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.post-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.post-card__tag {
  padding: 0.05rem 0.42rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  color: var(--c-text-subtle) !important;
  font-size: 0.67rem;
  text-decoration: none;
}

.post-card__tag:hover {
  background: color-mix(in srgb, var(--c-link) 12%, transparent);
  color: var(--c-link-hover) !important;
}

.post-card__footer {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: auto;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-subtle);
  font-size: 0.71rem;
}

.post-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
}

.post-card__stat .q-icon {
  font-size: 1.05em;
}

/* The user's own vote: a filled, colour-coded pill next to the vote count so
   it reads at a glance while scanning a grid of cards. */
.post-card__stat--votes {
  padding: 0 0.32rem;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.post-card__stat--voted-up {
  border-color: color-mix(in srgb, var(--c-positive) 45%, transparent);
  background: color-mix(in srgb, var(--c-positive) 16%, transparent);
  color: var(--c-positive);
}

.post-card__stat--voted-down {
  border-color: color-mix(in srgb, var(--c-negative) 45%, transparent);
  background: color-mix(in srgb, var(--c-negative) 16%, transparent);
  color: var(--c-negative);
}

.post-card__voted-label {
  margin-left: 0.1rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* A subtle directional accent on the card edge reinforces the vote state. */
.post-card--voted-up {
  box-shadow: inset 3px 0 0 0 color-mix(in srgb, var(--c-positive) 85%, transparent);
}

.post-card--voted-down {
  box-shadow: inset 3px 0 0 0 color-mix(in srgb, var(--c-negative) 85%, transparent);
}

.post-card--voted-up:hover {
  border-color: color-mix(in srgb, var(--c-positive) 50%, transparent);
}

.post-card--voted-down:hover {
  border-color: color-mix(in srgb, var(--c-negative) 50%, transparent);
}

.post-card__read {
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
  color: var(--c-link);
  font-weight: 600;
  text-decoration: none;
}

.post-card__read:hover {
  color: var(--c-link-hover);
}

.post-card--list {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
}

.post-card--list .post-card__reblog {
  grid-column: 1 / -1;
}

.post-card--list .post-card__thumb {
  width: calc(100% - 1.4rem);
  height: 140px;
  margin: 0.7rem;
  border-radius: var(--radius-sm);
  align-self: center;
}

.post-card--list .post-card__body {
  padding: 0.75rem 1rem;
}

.post-card--list .post-card__summary {
  -webkit-line-clamp: 2;
}

.post-card--list.post-card--no-image {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 599px) {
  .post-card--list {
    grid-template-columns: minmax(0, 1fr);
  }

  .post-card--list .post-card__thumb {
    width: calc(100% - 1.4rem);
    height: auto;
    aspect-ratio: 16 / 9;
    margin: 0.7rem;
  }

  .post-card__summary {
    -webkit-line-clamp: 3;
  }
}
</style>

<script>
import moment from 'src/utils/time'
import { postImage, postIsThreeSpeakVideo, postSummary } from 'src/utils/postPreview'
import { isValidTag } from 'src/utils/hiveTag'
import { stripHtml } from 'src/utils/safeHtml'
import {
  formatPostReputation,
  postCommentCount,
  postCommunityTitle,
  postDisplayTitle,
  postIsComment,
  postMetadata,
  postPayoutLabel,
  postRebloggers,
  postTags,
  postUserVoteDirection,
  postVotes
} from 'src/services/posts'
import { hiveAvatarUrl } from 'src/utils/avatar'

export default {
  name: 'postPreview',
  props: {
    post: { type: Object, required: true },
    styleType: { type: String, default: 'cards' }
  },
  data () {
    return {
      imageFailed: false
    }
  },
  computed: {
    postMeta () {
      return postMetadata(this.post)
    },
    displayTitle () {
      return postDisplayTitle(this.post)
    },
    isComment () {
      return postIsComment(this.post)
    },
    isPinned () {
      return Boolean(this.post.stats && this.post.stats.is_pinned)
    },
    isVideo () {
      return postIsThreeSpeakVideo(this.post)
    },
    aiToolLabels () {
      const labels = {
        media_generation: 'AI-generated media',
        translation: 'AI-assisted translation',
        post_draft: 'AI-written draft',
        writing_edit: 'AI grammar or editing',
        research: 'AI-assisted research',
        other: 'Other AI assistance'
      }
      const tools = this.postMeta && this.postMeta.ai_tools
      if (!tools || typeof tools !== 'object') return []
      return Object.keys(tools).filter(key => tools[key]).map(key => labels[key] || key.replace(/_/g, ' '))
    },
    hasAiDisclosure () {
      return this.aiToolLabels.length > 0
    },
    isPortfolio () {
      return Boolean(this.postMeta && this.postMeta.portfolio === true)
    },
    isCollection () {
      if (this.postMeta && this.postMeta.collection === true) return true
      const tags = this.postMeta && this.postMeta.tags
      return Array.isArray(tags) && tags.includes('c-c-c')
    },
    countdownLabel () {
      const iso = this.postMeta && this.postMeta.countdown
      const time = Date.parse(iso)
      if (!Number.isFinite(time)) return ''
      return time > Date.now() ? 'Ends ' + moment.utc(iso).fromNow() : 'Ended'
    },
    openLabel () {
      return (this.isVideo ? 'Open video: ' : 'Open post: ') + this.displayTitle
    },
    readLabel () {
      if (this.isVideo) return 'Watch'
      return this.isComment ? 'View' : 'Read'
    },
    postImage () {
      return postImage(this.post) || ''
    },
    hasImage () {
      return Boolean(this.postImage) && !this.imageFailed
    },
    summary () {
      let source = this.postMeta.description
      if (!source) {
        try {
          source = postSummary(this.post, 500)
        } catch {
          source = this.post.body
        }
      }
      let text = stripHtml(source)
      const title = this.displayTitle.toLowerCase()
      if (title && text.toLowerCase().startsWith(title)) {
        text = text.slice(this.displayTitle.length).replace(/^[\s:–—-]+/, '')
      }
      text = text.slice(0, 280).trim()
      return text && text.toLowerCase() !== title ? text : ''
    },
    tags () {
      return postTags(this.post)
    },
    communityTitle () {
      return postCommunityTitle(this.post)
    },
    communityLink () {
      return this.post.community ? '/c/' + this.post.community + '/trending' : '/browse'
    },
    reputation () {
      return formatPostReputation(this.post.author_reputation)
    },
    votes () {
      return postVotes(this.post)
    },
    commentCount () {
      return postCommentCount(this.post)
    },
    payoutLabel () {
      return postPayoutLabel(this.post)
    },
    rebloggers () {
      return postRebloggers(this.post)
    },
    postLink () {
      return '/@' + this.post.author + '/' + this.post.permlink
    },
    titleId () {
      return 'post-card-title-' + (this.post.post_id || (this.post.author + '-' + this.post.permlink))
    },
    timeLabel () {
      return this.post.created ? moment.utc(this.post.created).fromNow() : ''
    },
    absoluteTime () {
      return this.post.created ? moment.utc(this.post.created).format('D MMM YYYY, HH:mm') + ' UTC' : ''
    },
    cardClasses () {
      return {
        'post-card--cards': this.styleType === 'cards',
        'post-card--list': this.styleType === 'list',
        'post-card--no-image': !this.hasImage,
        'post-card--voted-up': this.userVote === 'up',
        'post-card--voted-down': this.userVote === 'down'
      }
    },
    userVote () {
      return postUserVoteDirection(this.post, this.$hiveStore.user.username)
    },
    userVoteTitle () {
      if (this.userVote === 'up') return 'You upvoted this post'
      if (this.userVote === 'down') return 'You downvoted this post'
      return ''
    }
  },
  watch: {
    post () {
      this.imageFailed = false
    }
  },
  methods: {
    avatarUrl (user) {
      return hiveAvatarUrl(user)
    },
    linkAccount (user) {
      return '/@' + user
    },
    linkTag (tag) {
      return isValidTag(tag) ? '/trending/' + tag : null
    }
  }
}
</script>
