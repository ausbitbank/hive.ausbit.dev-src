<template>
  <div class="shop-page">
    <header class="shop-head">
      <p class="shop-kicker"><router-link to="/">← {{ blog.title }}</router-link></p>
      <h1 class="shop-title">{{ title }}</h1>
      <p v-if="description" class="shop-description">{{ description }}</p>
      <p class="shop-note">
        Products are ordinary Hive posts using the Hive Open Market metadata.
        Payment opens on banksia.io and is a direct Hive transfer — there is no
        escrow or buyer protection.
      </p>
    </header>

    <div v-if="loading" class="shop-grid" aria-busy="true" aria-label="Loading shop">
      <div v-for="n in 4" :key="n" class="shop-skeleton"></div>
    </div>

    <div v-else-if="error" class="shop-state" role="alert">
      <h2>Shop unavailable</h2>
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" label="Try again" @click="load" />
    </div>

    <div v-else-if="!enabled" class="shop-state">
      <h2>Shop is not enabled</h2>
      <p>The blog owner can enable it from the blog settings.</p>
    </div>

    <div v-else-if="!products.length" class="shop-state">
      <h2>No products yet</h2>
      <p>
        Publish a product as a normal Hive post with Hive Open Market metadata:
        <code>content_type: "product"</code>, <code>currency</code>,
        <code>price</code> and <code>status</code>. It will appear here.
      </p>
    </div>

    <div v-else class="shop-grid">
      <article v-for="product in products" :key="product.author + '/' + product.permlink" class="shop-item">
        <router-link :to="postPath(product)" class="shop-item__media" :aria-label="'Read ' + product.title">
          <img v-if="product.image" :src="product.image" alt="" loading="lazy" />
          <span v-else class="shop-item__placeholder" aria-hidden="true">{{ product.title.slice(0, 1) }}</span>
        </router-link>
        <div class="shop-item__body">
          <div class="shop-item__price">{{ product.priceLabel }}</div>
          <h2 class="shop-item__title"><router-link :to="postPath(product)">{{ product.title }}</router-link></h2>
          <p class="shop-item__meta">
            <span :class="'shop-item__status shop-item__status--' + product.status">{{ product.statusLabel }}</span>
            <template v-if="product.subscription">
              <span aria-hidden="true">·</span>
              <span>Every {{ product.recurrenceHours }} hours</span>
            </template>
          </p>
          <ul v-if="product.tags.length" class="shop-item__tags" aria-label="Product tags">
            <li v-for="tag in product.tags" :key="tag">#{{ tag }}</li>
          </ul>
          <div class="shop-item__actions">
            <a
              v-if="isPurchasable(product)"
              :href="payUrl(product)"
              class="shop-item__buy"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ product.subscription ? 'Subscribe' : 'Buy' }} on Banksia
            </a>
            <span v-else class="shop-item__unavailable">{{ product.statusLabel }}</span>
            <router-link :to="postPath(product)" class="shop-item__read">Read product</router-link>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.shop-page {
  max-width: 100%;
}

.shop-head {
  max-width: 720px;
  margin-bottom: 1.75rem;
}

.shop-kicker {
  margin: 0 0 0.8rem;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shop-kicker a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.shop-kicker a:hover {
  color: var(--c-link);
}

.shop-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.1;
}

.shop-description {
  margin: 0.65rem 0 0;
  color: var(--c-text-muted);
  line-height: 1.65;
}

.shop-note {
  margin: 0.9rem 0 0;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  color: var(--c-text-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 1rem;
}

.shop-item {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
}

.shop-item__media {
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--c-surface-2);
}

.shop-item__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shop-item__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--c-text-faint);
  font-family: var(--font-display);
  font-size: 3rem;
}

.shop-item__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 1rem 1rem;
  flex: 1;
}

.shop-item__price {
  color: var(--c-primary);
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.shop-item__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  line-height: 1.3;
}

.shop-item__title a {
  color: var(--c-text);
  text-decoration: none;
}

.shop-item__title a:hover {
  color: var(--c-link);
}

.shop-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.shop-item__status--1 { color: var(--c-positive); }
.shop-item__status--2 { color: var(--c-text-muted); }
.shop-item__status--3 { color: var(--c-warning); }

.shop-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.shop-item__actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 0.55rem;
}

.shop-item__buy {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}

.shop-item__buy:hover {
  filter: brightness(1.06);
}

.shop-item__unavailable {
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.shop-item__read {
  color: var(--c-link);
  font-size: 0.8rem;
}

.shop-state {
  padding: 1.5rem;
  border: 1px dashed var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  color: var(--c-text-muted);
}

.shop-state h2 {
  margin: 0 0 0.35rem;
  color: var(--c-text);
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.shop-state p {
  margin: 0 0 0.8rem;
  max-width: 68ch;
  line-height: 1.6;
}

.shop-state code {
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
}

.shop-skeleton {
  aspect-ratio: 4 / 3;
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface-2);
  animation: shop-pulse 1.4s ease-in-out infinite;
}

@keyframes shop-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .shop-skeleton { animation: none; }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccountProducts, isPurchasable } from 'src/services/blogShop'
import { blogPostPathFor } from 'src/services/blogPosts'
import { useBlogStore } from 'src/stores/blog'

export default {
  name: 'BlogShop',
  data () {
    return {
      products: [],
      loading: true,
      error: ''
    }
  },
  computed: {
    blog () {
      return useBlogStore()
    },
    shop () {
      return this.blog.shop
    },
    enabled () {
      return Boolean(this.shop.enabled)
    },
    title () {
      return this.shop.title || 'Shop'
    },
    description () {
      return this.shop.description || ''
    }
  },
  watch: {
    'blog.accountName': 'load'
  },
  created () {
    this.load()
  },
  methods: {
    async load () {
      this.loading = true
      this.error = ''
      this.products = []
      try {
        this.products = await fetchAccountProducts(this.blog.accountName)
        this.updateMeta()
      } catch (error) {
        this.error = error && error.message ? error.message : 'The shop could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    isPurchasable,
    postPath (product) {
      return blogPostPathFor(product.post, this.blog.accountName)
    },
    payUrl (product) {
      const reference = encodeURIComponent(product.author + '/' + product.permlink)
      return 'https://banksia.io/pay?product=' + reference + '&quantity=1'
    },
    updateMeta () {
      if (typeof window === 'undefined') return
      const origin = window.location.origin
      const image = this.products[0] && this.products[0].image ? this.products[0].image : ''
      setPageMeta({
        title: this.title + ' — ' + this.blog.title,
        description: this.description || ('Products from @' + this.blog.accountName + ' on Hive.'),
        image,
        url: '/shop',
        type: 'website',
        baseUrl: origin,
        siteName: this.blog.title,
        noindex: !this.blog.claimed,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: this.title,
          description: this.description,
          url: origin + '/shop'
        }
      })
    }
  }
}
</script>
