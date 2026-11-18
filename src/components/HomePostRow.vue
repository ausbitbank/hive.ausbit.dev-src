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
      <div class="home-post-row__meta">
        <router-link :to="'/@' + post.author">@{{ post.author }}</router-link>
        <span aria-hidden="true">·</span>
        <time :datetime="post.created" :title="absoluteTime">{{ timeLabel }}</time>
        <template v-if="communityTitle">
          <span aria-hidden="true">·</span>
          <span class="home-post-row__community">{{ communityTitle }}</span>
        </template>
      </div>
    </div>

    <div v-if="!compact" class="home-post-row__stats">
      <span title="Votes"><q-icon name="thumb_up_alt" aria-hidden="true" />{{ votes }}</span>
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
  color: #78909c;
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
  background: #10161b;
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
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
  text-decoration: none;
}

.home-post-row__title:hover {
  color: #81d4fa;
}

.home-post-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
  color: #90a4ae;
  font-size: 0.72rem;
}

.home-post-row__meta a {
  color: #b0bec5;
  text-decoration: none;
}

.home-post-row__meta a:hover {
  color: #81d4fa;
}

.home-post-row__community {
  color: #4fc3f7;
}

.home-post-row__stats {
  display: flex;
  flex: none;
  gap: 0.55rem;
  color: #90a4ae;
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
    compact: { type: Boolean, default: false }
  },
  computed: {
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
