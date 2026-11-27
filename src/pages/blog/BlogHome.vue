<template>
  <div class="blog-home">
    <section class="blog-hero" :class="{ 'blog-hero--cover': Boolean(cover) }">
      <img v-if="cover" :src="cover" alt="" class="blog-hero__cover" aria-hidden="true" />
      <div class="blog-hero__inner">
        <img :src="avatar" alt="" class="blog-hero__avatar" width="88" height="88" />
        <div class="blog-hero__copy">
          <h1 class="blog-hero__title">{{ title }}</h1>
          <p class="blog-hero__handle">
            <a :href="apexAccountUrl">@{{ accountName }}</a>
            <span aria-hidden="true"> · </span>
            Hive blog
          </p>
          <p v-if="description" class="blog-hero__description">{{ description }}</p>
          <div class="blog-hero__links">
            <router-link to="/about">About</router-link>
            <router-link to="/contact">Contact</router-link>
            <a :href="rssUrl">RSS</a>
            <a v-if="website" :href="website" target="_blank" rel="noopener noreferrer">Website</a>
          </div>
        </div>
      </div>
    </section>

    <section v-if="!blog.claimed" class="blog-claim" aria-label="Claim this blog">
      <div>
        <h2 class="blog-claim__title">This blog is a preview</h2>
        <p class="blog-claim__text">
          @{{ accountName }} has not claimed this address yet. The posts are public Hive content.
          <template v-if="canEdit">Claiming is free and lets you choose a theme, title and pinned posts.</template>
        </p>
      </div>
      <a class="blog-claim__button" :href="settingsUrl">Claim this blog</a>
    </section>

    <section v-if="pinnedPosts.length" class="blog-section">
      <div class="blog-section__head">
        <h2>Start here</h2>
      </div>
      <div class="blog-grid">
        <blog-post-card
          v-for="post in pinnedPosts"
          :key="'pin-' + post.permlink"
          :post="post"
          pinned
          feature
        />
      </div>
    </section>

    <section class="blog-section">
      <div class="blog-section__head">
        <h2>{{ pinnedPosts.length ? 'Archive' : 'Latest posts' }}</h2>
        <span v-if="blog.postCount" class="blog-section__count">{{ blog.postCount }} loaded</span>
      </div>

      <div v-if="blog.postsLoading && !blog.posts.length" class="blog-grid" aria-busy="true" aria-label="Loading posts">
        <div v-for="n in 4" :key="n" class="blog-card-skeleton">
          <div class="blog-card-skeleton__media"></div>
          <div class="blog-card-skeleton__line"></div>
          <div class="blog-card-skeleton__line blog-card-skeleton__line--short"></div>
        </div>
      </div>

      <p v-else-if="!blog.posts.length" class="blog-empty">
        No posts yet. When @{{ accountName }} publishes on Hive, it will appear here.
      </p>

      <div v-else class="blog-grid">
        <blog-post-card v-for="post in archivePosts" :key="post.permlink" :post="post" />
      </div>

      <div v-if="blog.hasMore" class="blog-more">
        <button type="button" class="blog-more__button" :disabled="blog.postsLoading" @click="loadMore">
          {{ blog.postsLoading ? 'Loading…' : 'Load more posts' }}
        </button>
      </div>
      <p v-if="blog.postsError" class="blog-error" role="alert">{{ blog.postsError }}</p>
    </section>
  </div>
</template>

<style scoped>
.blog-home {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.blog-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--c-border);
  border-radius: calc(var(--skin-radius-card, 12px) + 4px);
  background: var(--c-surface);
}

.blog-hero__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.28;
  filter: saturate(0.9);
}

.blog-hero--cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c-bg) 20%, transparent), var(--c-surface) 92%);
}

.blog-hero__inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 2rem;
}

.blog-hero__avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--c-surface);
  box-shadow: var(--c-shadow-card);
  background: var(--c-surface-2);
  flex: none;
}

.blog-hero__copy {
  min-width: 0;
}

.blog-hero__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 4vw, 2.6rem);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.blog-hero__handle {
  margin: 0.4rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.9rem;
}

.blog-hero__handle a {
  color: var(--c-link);
  text-decoration: none;
}

.blog-hero__description {
  margin: 0.75rem 0 0;
  max-width: 62ch;
  color: var(--c-text-soft);
  font-size: 1rem;
  white-space: pre-line;
}

.blog-hero__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 0.9rem;
  font-size: 0.85rem;
}

.blog-hero__links a {
  color: var(--c-link);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.blog-hero__links a:hover {
  border-bottom-color: currentColor;
}

.blog-claim {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.5rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
  border: 1px solid var(--c-border);
  border-left: 3px solid var(--c-primary);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface-2);
}

.blog-claim__title {
  margin: 0 0 0.25rem;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.blog-claim__text {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.9rem;
  max-width: 70ch;
}

.blog-claim__button,
.blog-more__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--c-primary);
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.blog-claim__button:hover,
.blog-more__button:hover {
  filter: brightness(1.06);
}

.blog-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.blog-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--c-border);
  padding-bottom: 0.5rem;
}

.blog-section__head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--c-text-muted);
}

.blog-section__count {
  color: var(--c-text-faint);
  font-size: 0.78rem;
}

.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.blog-card-skeleton {
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  overflow: hidden;
  background: var(--c-surface);
  padding-bottom: 1rem;
}

.blog-card-skeleton__media {
  aspect-ratio: 16 / 9;
  background: var(--c-surface-2);
  animation: blog-pulse 1.4s ease-in-out infinite;
}

.blog-card-skeleton__line {
  height: 12px;
  margin: 0.8rem 1rem 0;
  border-radius: 6px;
  background: var(--c-surface-2);
  animation: blog-pulse 1.4s ease-in-out infinite;
}

.blog-card-skeleton__line--short {
  width: 55%;
}

@keyframes blog-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.blog-empty,
.blog-error {
  margin: 0;
  padding: 1.25rem;
  border: 1px dashed var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  color: var(--c-text-muted);
  font-size: 0.92rem;
}

.blog-error {
  border-style: solid;
  border-color: var(--c-negative);
  color: var(--c-negative);
}

.blog-more {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

.blog-more__button:disabled {
  opacity: 0.6;
  cursor: progress;
}

@media (prefers-reduced-motion: reduce) {
  .blog-card-skeleton__media,
  .blog-card-skeleton__line {
    animation: none;
  }
}

@media (max-width: 640px) {
  .blog-home {
    gap: 1.75rem;
  }

  .blog-hero__inner {
    flex-direction: column;
    padding: 1.25rem;
  }

  .blog-hero__avatar {
    width: 64px;
    height: 64px;
  }

  .blog-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { useBlogStore } from 'src/stores/blog'
import BlogPostCard from 'src/components/blog/BlogPostCard.vue'

export default {
  name: 'BlogHome',
  components: { BlogPostCard },
  computed: {
    blog () {
      return useBlogStore()
    },
    title () {
      return this.blog.title
    },
    accountName () {
      return this.blog.accountName
    },
    avatar () {
      return this.blog.avatar
    },
    cover () {
      return this.blog.cover
    },
    description () {
      return this.blog.description
    },
    website () {
      return this.blog.website
    },
    rssUrl () {
      return this.blog.rssUrl
    },
    apexAccountUrl () {
      return this.blog.apexAccountUrl
    },
    settingsUrl () {
      return this.blog.settingsUrl
    },
    pinnedPosts () {
      return this.blog.pinnedPosts
    },
    archivePosts () {
      return this.blog.archivePosts
    }
  },
  watch: {
    'blog.title': 'updateMeta',
    'blog.description': 'updateMeta',
    'blog.claimed': 'updateMeta'
  },
  mounted () {
    this.updateMeta()
  },
  methods: {
    updateMeta () {
      if (typeof window === 'undefined') return
      const origin = window.location.origin
      const description = this.description || ('Posts by @' + this.accountName + ' on Hive.')
      setPageMeta({
        title: this.title,
        description,
        image: this.blog.ogImage || this.cover || this.avatar,
        url: '/',
        type: 'website',
        baseUrl: origin,
        siteName: this.title,
        noindex: !this.blog.claimed,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: this.title,
          description,
          url: origin + '/',
          author: {
            '@type': 'Person',
            name: '@' + this.accountName,
            url: 'https://banksia.io/@' + this.accountName
          }
        }
      })
    },
    loadMore () {
      this.blog.loadMore()
    }
  }
}
</script>
