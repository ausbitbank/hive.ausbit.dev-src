<template>
  <div class="portfolio-page">
    <header class="portfolio-head">
      <p class="portfolio-kicker"><router-link to="/">← {{ blog.title }}</router-link></p>
      <h1 class="portfolio-title">{{ title }}</h1>
      <p v-if="description" class="portfolio-description">{{ description }}</p>
    </header>

    <div v-if="loading" class="portfolio-grid" aria-busy="true" aria-label="Loading portfolio">
      <div v-for="n in 6" :key="n" class="portfolio-skeleton"></div>
    </div>

    <div v-else-if="error" class="portfolio-state" role="alert">
      <h2>Portfolio unavailable</h2>
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" label="Try again" @click="load" />
    </div>

    <div v-else-if="!enabled" class="portfolio-state">
      <h2>Portfolio is not enabled</h2>
      <p>The blog owner can enable it from the blog settings.</p>
    </div>

    <div v-else-if="!items.length" class="portfolio-state">
      <h2>No portfolio items yet</h2>
      <p>Add a few post permlinks in the blog settings to build the gallery.</p>
    </div>

    <div v-else class="portfolio-grid" :class="'portfolio-grid--' + layout">
      <article v-for="item in items" :key="item.permlink" class="portfolio-item">
        <button
          type="button"
          class="portfolio-item__image"
          :aria-label="'Open ' + item.title + ' image'"
          @click="openLightbox(item, 0)"
        >
          <img :src="item.images[0].url" :alt="item.images[0].alt || item.title" loading="lazy" />
        </button>
        <div class="portfolio-item__copy">
          <h2><router-link :to="item.path">{{ item.title }}</router-link></h2>
          <p v-if="item.tags.length" class="portfolio-item__meta">
            <span v-for="tag in item.tags" :key="tag">#{{ tag }}</span>
          </p>
          <button
            v-if="item.images.length > 1"
            type="button"
            class="portfolio-item__more"
            @click="openLightbox(item, 0)"
          >
            View {{ item.images.length }} images
          </button>
        </div>
      </article>
    </div>

    <q-dialog v-model="lightboxOpen">
      <div class="portfolio-lightbox" role="dialog" aria-label="Portfolio image viewer">
        <img :src="currentImage.url" :alt="currentImage.alt || lightbox.title" class="portfolio-lightbox__image" />
        <div class="portfolio-lightbox__bar">
          <div class="portfolio-lightbox__copy">
            <strong>{{ lightbox.title }}</strong>
            <small>{{ lightbox.index + 1 }} / {{ lightbox.images.length }}</small>
          </div>
          <div class="portfolio-lightbox__actions">
            <q-btn flat round dense icon="chevron_left" aria-label="Previous image" @click="step(-1)" />
            <q-btn flat round dense icon="chevron_right" aria-label="Next image" @click="step(1)" />
            <q-btn flat round dense icon="close" aria-label="Close image viewer" @click="lightboxOpen = false" />
          </div>
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<style scoped>
.portfolio-page {
  max-width: 100%;
}

.portfolio-head {
  max-width: 720px;
  margin-bottom: 1.75rem;
}

.portfolio-kicker {
  margin: 0 0 0.8rem;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.portfolio-kicker a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.portfolio-kicker a:hover {
  color: var(--c-link);
}

.portfolio-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.1;
}

.portfolio-description {
  margin: 0.65rem 0 0;
  color: var(--c-text-muted);
  line-height: 1.65;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.portfolio-grid--masonry {
  display: block;
  columns: 3 260px;
  column-gap: 1rem;
}

.portfolio-grid--masonry .portfolio-item {
  display: inline-block;
  width: 100%;
  margin: 0 0 1rem;
  break-inside: avoid;
}

.portfolio-item {
  overflow: hidden;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
}

.portfolio-item__image {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: var(--c-surface-2);
  cursor: zoom-in;
  overflow: hidden;
}

.portfolio-grid:not(.portfolio-grid--masonry) .portfolio-item__image {
  aspect-ratio: 4 / 3;
}

.portfolio-item__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 180ms ease;
}

.portfolio-item__image:hover img {
  transform: scale(1.02);
}

.portfolio-item__copy {
  padding: 0.8rem 0.95rem 0.95rem;
}

.portfolio-item__copy h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  line-height: 1.3;
}

.portfolio-item__copy a {
  color: var(--c-text);
  text-decoration: none;
}

.portfolio-item__copy a:hover {
  color: var(--c-link);
}

.portfolio-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.45rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.75rem;
}

.portfolio-item__more {
  margin-top: 0.5rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
}

.portfolio-state {
  padding: 1.5rem;
  border: 1px dashed var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  color: var(--c-text-muted);
}

.portfolio-state h2 {
  margin: 0 0 0.35rem;
  color: var(--c-text);
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.portfolio-state p {
  margin: 0 0 0.8rem;
}

.portfolio-skeleton {
  aspect-ratio: 4 / 3;
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface-2);
  animation: portfolio-pulse 1.4s ease-in-out infinite;
}

@keyframes portfolio-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.portfolio-lightbox {
  width: min(94vw, 1200px);
  max-width: 1200px;
  background: var(--c-bg);
  color: var(--c-text);
  border-radius: 12px;
  overflow: hidden;
}

.portfolio-lightbox__image {
  display: block;
  width: 100%;
  max-height: 78vh;
  object-fit: contain;
  background: var(--c-bg-deep);
}

.portfolio-lightbox__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0.85rem;
}

.portfolio-lightbox__copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.portfolio-lightbox__copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portfolio-lightbox__copy small {
  color: var(--c-text-muted);
}

.portfolio-lightbox__actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

@media (prefers-reduced-motion: reduce) {
  .portfolio-skeleton { animation: none; }
  .portfolio-item__image img { transition: none; }
}

@media (max-width: 640px) {
  .portfolio-grid--masonry { columns: 1; }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchPostContent } from 'src/services/chainData'
import { useBlogStore } from 'src/stores/blog'
import { blogPostPathFor, blogPostTitle } from 'src/services/blogPosts'
import { portfolioImages, portfolioPostTags } from 'src/services/blogPortfolio'

export default {
  name: 'BlogPortfolio',
  data () {
    return {
      items: [],
      loading: true,
      error: '',
      lightboxOpen: false,
      lightbox: { images: [], index: 0, title: '' }
    }
  },
  computed: {
    blog () {
      return useBlogStore()
    },
    portfolio () {
      return this.blog.portfolio
    },
    enabled () {
      return Boolean(this.portfolio.enabled)
    },
    title () {
      return this.portfolio.title || 'Portfolio'
    },
    description () {
      return this.portfolio.description || ''
    },
    layout () {
      return this.portfolio.layout === 'masonry' ? 'masonry' : 'grid'
    },
    currentImage () {
      return this.lightbox.images[this.lightbox.index] || { url: '', alt: '' }
    }
  },
  watch: {
    'blog.accountName': 'load',
    'blog.portfolio.items': 'load'
  },
  created () {
    this.load()
  },
  methods: {
    async load () {
      this.loading = true
      this.error = ''
      this.items = []
      try {
        const items = []
        const permlinks = Array.isArray(this.portfolio.items) ? this.portfolio.items.slice(0, 12) : []
        for (const permlink of permlinks) {
          let post = null
          try {
            post = await fetchPostContent(this.blog.accountName, permlink)
          } catch {
            post = null
          }
          if (!post) continue
          const images = portfolioImages(post)
          if (!images.length) continue
          items.push({
            permlink,
            post,
            images,
            title: blogPostTitle(post),
            tags: portfolioPostTags(post, 3),
            path: blogPostPathFor(post, this.blog.accountName)
          })
        }
        this.items = items
        this.updateMeta()
      } catch (error) {
        this.error = error && error.message ? error.message : 'The portfolio could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    updateMeta () {
      if (typeof window === 'undefined') return
      const origin = window.location.origin
      const image = this.items[0] && this.items[0].images[0] ? this.items[0].images[0].url : ''
      setPageMeta({
        title: this.title + ' — ' + this.blog.title,
        description: this.description || ('A portfolio from @' + this.blog.accountName + ' on Hive.'),
        image,
        url: '/portfolio',
        type: 'website',
        baseUrl: origin,
        siteName: this.blog.title,
        noindex: !this.blog.claimed,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: this.title,
          description: this.description,
          url: origin + '/portfolio'
        }
      })
    },
    openLightbox (item, index) {
      this.lightbox = { images: item.images, index, title: item.title }
      this.lightboxOpen = true
    },
    step (delta) {
      const length = this.lightbox.images.length
      if (!length) return
      this.lightbox.index = (this.lightbox.index + delta + length) % length
    }
  }
}
</script>
