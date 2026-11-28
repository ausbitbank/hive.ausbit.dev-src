<template>
  <article class="blog-card" :class="{ 'blog-card--feature': feature, 'blog-card--list': list }">
    <router-link v-if="image" :to="path" class="blog-card__media" tabindex="-1" aria-hidden="true">
      <img :src="image" alt="" loading="lazy" decoding="async" />
    </router-link>

    <div class="blog-card__body">
      <div class="blog-card__meta">
        <time v-if="dateLabel" :datetime="post.created">{{ dateLabel }}</time>
        <span v-if="readingMinutes && showReadingTime" class="blog-card__dot" aria-hidden="true">·</span>
        <span v-if="readingMinutes && showReadingTime">{{ readingMinutes }} min read</span>
        <span v-if="membersOnly" class="blog-card__members">
          <q-icon name="lock" size="12px" aria-hidden="true" />
          Members
        </span>
        <span v-if="pinned" class="blog-card__pin">Pinned</span>
      </div>

      <h2 class="blog-card__title">
        <router-link :to="path">{{ title }}</router-link>
      </h2>

      <p v-if="excerpt" class="blog-card__excerpt">{{ excerpt }}</p>

      <ul v-if="showTags && tags.length" class="blog-card__tags" aria-label="Tags">
        <li v-for="tag in tags" :key="tag">#{{ tag }}</li>
      </ul>
    </div>
  </article>
</template>

<style scoped>
.blog-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  overflow: hidden;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.blog-card:hover {
  transform: translateY(-2px);
  border-color: var(--c-border-strong);
  box-shadow: var(--c-shadow-card);
}

.blog-card__media {
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--c-surface-2);
}

.blog-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.blog-card__body {
  padding: 1rem 1.1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
}

.blog-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--c-text-muted);
  font-size: 0.76rem;
  letter-spacing: 0.01em;
}

.blog-card__dot {
  opacity: 0.6;
}

.blog-card__pin {
  margin-left: auto;
  padding: 0.08rem 0.45rem;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  color: var(--c-primary);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.blog-card__members {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.08rem 0.45rem;
  border: 1px solid color-mix(in srgb, var(--c-primary) 36%, var(--c-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
  color: var(--c-primary);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.blog-card__members .q-icon {
  font-size: 12px;
}

.blog-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.18rem;
  line-height: 1.28;
}

.blog-card__title a {
  color: var(--c-text);
  text-decoration: none;
}

.blog-card__title a:hover {
  color: var(--c-link);
}

.blog-card__excerpt {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.9rem;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.15rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.blog-card--feature {
  grid-column: 1 / -1;
}

.blog-card--feature .blog-card__media {
  aspect-ratio: 21 / 9;
}

.blog-card--feature .blog-card__title {
  font-size: 1.7rem;
}

.blog-card--feature .blog-card__excerpt {
  -webkit-line-clamp: 4;
  font-size: 0.98rem;
}

.blog-card--list {
  flex-direction: row;
}

.blog-card--list .blog-card__media {
  width: 280px;
  aspect-ratio: 4 / 3;
  flex: none;
}

.blog-card--list .blog-card__title {
  font-size: 1.35rem;
}

.blog-card--list .blog-card__body {
  padding: 1.1rem 1.25rem;
}

@media (max-width: 640px) {
  .blog-card--feature .blog-card__title {
    font-size: 1.35rem;
  }

  .blog-card--feature .blog-card__media {
    aspect-ratio: 16 / 9;
  }

  .blog-card--list {
    flex-direction: column;
  }

  .blog-card--list .blog-card__media {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
}
</style>

<script>
import { blogPostExcerpt, blogPostImage, blogPostPathFor, blogPostReadingMinutes, blogPostTags, blogPostTitle, formatBlogDate, vaultSummary } from 'src/services/blogPosts'
import { useBlogStore } from 'src/stores/blog'

export default {
  name: 'BlogPostCard',
  props: {
    post: { type: Object, required: true },
    pinned: { type: Boolean, default: false },
    feature: { type: Boolean, default: false },
    list: { type: Boolean, default: false },
    showTags: { type: Boolean, default: true },
    showReadingTime: { type: Boolean, default: true }
  },
  computed: {
    blog () {
      return useBlogStore()
    },
    path () {
      return blogPostPathFor(this.post, this.blog.accountName)
    },
    image () {
      return blogPostImage(this.post)
    },
    title () {
      return blogPostTitle(this.post)
    },
    membersOnly () {
      return Boolean(vaultSummary(this.post && this.post.json_metadata))
    },
    excerpt () {
      return blogPostExcerpt(this.post, this.feature ? 260 : 180)
    },
    tags () {
      return blogPostTags(this.post, 3)
    },
    dateLabel () {
      return formatBlogDate(this.post && this.post.created)
    },
    readingMinutes () {
      return blogPostReadingMinutes(this.post)
    }
  }
}
</script>
