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
      <q-btn outline no-caps color="primary" label="Try again" @click="retry" />
    </div>

    <div v-else-if="!enabled" class="shop-state">
      <h2>Shop is not enabled</h2>
      <p>The blog owner can enable it from the blog settings.</p>
    </div>

    <template v-else>
      <section class="shop-controls" aria-label="Shop filters">
        <div class="shop-control">
          <label class="shop-control__label" for="shop-search">Search products</label>
          <input
            id="shop-search"
            v-model="search"
            class="shop-control__input"
            type="search"
            autocomplete="off"
            placeholder="Titles, descriptions and tags"
          />
        </div>

        <div class="shop-control shop-control--sort">
          <label class="shop-control__label" for="shop-sort">Sort by</label>
          <select id="shop-sort" v-model="sortValue" class="shop-control__input">
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>

        <label class="shop-control__check" for="shop-sold-out">
          <input id="shop-sold-out" v-model="soldOutValue" type="checkbox" />
          Show inactive and out-of-stock
        </label>
      </section>

      <div v-if="tagOptions.length" class="shop-tags" role="group" aria-label="Filter by tag">
        <button
          type="button"
          class="shop-chip"
          :aria-pressed="activeTag === ''"
          @click="activeTag = ''"
        >
          All
        </button>
        <button
          v-for="option in tagOptions"
          :key="option.tag"
          type="button"
          class="shop-chip"
          :aria-pressed="activeTag === option.tag"
          @click="activeTag = option.tag"
        >
          #{{ option.tag }} <span class="shop-chip__count">{{ option.count }}</span>
        </button>
      </div>

      <p class="shop-results" role="status">{{ resultsLabel }}</p>

      <div v-if="!products.length" class="shop-state">
        <h2>No products yet</h2>
        <p>
          Publish a product as a normal Hive post with Hive Open Market metadata:
          <code>content_type: "product"</code>, <code>currency</code>,
          <code>price</code> and <code>status</code>. It will appear here.
        </p>
      </div>

      <div v-else-if="!sortedProducts.length" class="shop-state">
        <h2>No matching products</h2>
        <p>Try a different search or tag filter.</p>
        <q-btn outline no-caps color="primary" label="Clear filters" @click="clearFilters" />
      </div>

      <div v-else class="shop-grid" :class="layoutClass">
        <article
          v-for="product in sortedProducts"
          :key="product.author + '/' + product.permlink"
          class="shop-item"
        >
          <router-link
            :to="productPath(product)"
            class="shop-item__media"
            :aria-label="'View ' + product.title"
          >
            <img v-if="product.image" :src="product.image" alt="" loading="lazy" />
            <span v-else class="shop-item__placeholder" aria-hidden="true">{{ product.title.slice(0, 1) }}</span>
          </router-link>
          <div class="shop-item__body">
            <div class="shop-item__price">{{ product.priceLabel }}</div>
            <h2 class="shop-item__title">
              <router-link :to="productPath(product)">{{ product.title }}</router-link>
            </h2>
            <p class="shop-item__meta">
              <span :class="'shop-item__status shop-item__status--' + product.status">{{ product.statusLabel }}</span>
              <template v-if="product.subscription">
                <span aria-hidden="true">·</span>
                <span>Recurring {{ recurrenceLabel(product) }}</span>
              </template>
              <template v-if="isMembership(product)">
                <span aria-hidden="true">·</span>
                <span class="shop-item__membership">Membership</span>
              </template>
            </p>
            <ul v-if="product.tags && product.tags.length" class="shop-item__tags" aria-label="Product tags">
              <li v-for="tag in product.tags" :key="tag">#{{ tag }}</li>
            </ul>
            <div class="shop-item__actions">
              <a
                v-if="isPurchasable(product)"
                :href="buyUrl(product)"
                class="shop-item__buy"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ buyLabel(product) }}
              </a>
              <span v-else class="shop-item__unavailable">{{ product.statusLabel }}</span>
              <router-link :to="productPath(product)" class="shop-item__read">View product</router-link>
            </div>
          </div>
        </article>
      </div>

      <div v-if="products.length && nextCursor" class="shop-more">
        <q-btn
          v-if="!loadMoreError"
          outline
          no-caps
          color="primary"
          :loading="loadingMore"
          :label="loadingMore ? 'Loading…' : 'Load more products'"
          @click="loadMore"
        />
        <div v-else class="shop-more__error" role="alert">
          <p>{{ loadMoreError }}</p>
          <q-btn outline no-caps color="primary" label="Retry loading more" @click="loadMore" />
        </div>
      </div>
    </template>
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

.shop-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
  margin-bottom: 0.9rem;
}

.shop-control {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 220px;
  flex: 1 1 240px;
}

.shop-control--sort {
  flex: 0 1 190px;
  min-width: 170px;
}

.shop-control__label {
  color: var(--c-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.shop-control__input {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: var(--c-surface);
  color: var(--c-text);
  font: inherit;
  font-size: 0.88rem;
}

.shop-control__input:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 1px;
}

.shop-control__check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0;
  color: var(--c-text);
  font-size: 0.85rem;
  cursor: pointer;
}

.shop-control__check input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--c-primary);
}

.shop-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
}

.shop-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-surface);
  color: var(--c-text-muted);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.shop-chip[aria-pressed='true'] {
  border-color: var(--c-primary);
  background: var(--c-primary);
  color: var(--c-on-primary);
}

.shop-chip:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 2px;
}

.shop-chip__count {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.shop-chip[aria-pressed='true'] .shop-chip__count {
  color: var(--c-on-primary);
}

.shop-results {
  margin: 0 0 0.75rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 1rem;
}

.shop-grid--list {
  display: flex;
  flex-direction: column;
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

.shop-grid--list .shop-item {
  flex-direction: row;
}

.shop-item__media {
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--c-surface-2);
}

.shop-grid--list .shop-item__media {
  flex: 0 0 240px;
  width: 240px;
  aspect-ratio: auto;
  min-height: 180px;
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
  min-width: 0;
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

.shop-item__membership {
  color: var(--c-primary);
  font-weight: 700;
}

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

.shop-more {
  display: flex;
  justify-content: center;
  margin-top: 1.25rem;
}

.shop-more__error {
  width: 100%;
  max-width: 520px;
  padding: 0.85rem 1rem;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  color: var(--c-text-muted);
  text-align: center;
}

.shop-more__error p {
  margin: 0 0 0.6rem;
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

@media (max-width: 640px) {
  .shop-grid--list .shop-item {
    flex-direction: column;
  }

  .shop-grid--list .shop-item__media {
    flex: none;
    width: 100%;
    aspect-ratio: 4 / 3;
    min-height: 0;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { isPurchasable } from 'src/services/blogShop'
import { listProducts } from 'src/services/hiveMarket'
import { blogProductPath } from 'src/services/blogProductPath'
import { isMembershipProduct, membershipSubscribeUrl } from 'src/services/shopMembership'
import { useBlogStore } from 'src/stores/blog'

const PAGE_SIZE = 24
const MAX_JSON_LD_ITEMS = 50

function productTime (product) {
  const value = String((product && product.created) || '')
  if (!value) return 0
  const parsed = Date.parse(/Z$/.test(value) ? value : value + 'Z')
  return Number.isNaN(parsed) ? 0 : parsed
}

function recurrenceLabel (product) {
  const hours = Number(product && product.recurrenceHours) || 0
  if (!hours) return ''
  if (hours % 24 === 0) {
    const days = hours / 24
    return 'every ' + days + (days === 1 ? ' day' : ' days')
  }
  return 'every ' + hours + (hours === 1 ? ' hour' : ' hours')
}

export default {
  name: 'BlogShop',
  data () {
    return {
      products: [],
      nextCursor: null,
      loading: true,
      error: '',
      loadingMore: false,
      loadMoreError: '',
      search: '',
      activeTag: '',
      sortPref: null,
      soldOutPref: null,
      requestId: 0
    }
  },
  computed: {
    blog () {
      return useBlogStore()
    },
    shop () {
      return this.blog.shop
    },
    settingsReady () {
      return Boolean(this.blog.settings)
    },
    enabled () {
      return Boolean(this.shop.enabled)
    },
    title () {
      return this.shop.title || 'Shop'
    },
    description () {
      return this.shop.description || ''
    },
    layout () {
      return this.shop.layout === 'list' ? 'list' : 'grid'
    },
    layoutClass () {
      return 'shop-grid--' + this.layout
    },
    sortValue: {
      get () {
        return this.sortPref || this.shop.sort || 'newest'
      },
      set (value) {
        this.sortPref = value
      }
    },
    soldOutValue: {
      get () {
        if (this.soldOutPref !== null) return this.soldOutPref
        return this.shop.showSoldOut !== false
      },
      set (value) {
        this.soldOutPref = Boolean(value)
      }
    },
    featuredKeys () {
      const featured = Array.isArray(this.shop.featured) ? this.shop.featured : []
      return featured.map(key => String(key || '').toLowerCase())
    },
    loadKey () {
      // Reload when the tenant, its settings, the sold-out filter or a
      // settings failure changes. Sorting and search stay client-side.
      return [
        this.settingsReady,
        this.enabled,
        this.shop.source || '',
        this.shop.tag || '',
        this.featuredKeys.join(','),
        this.soldOutValue,
        this.blog.error || ''
      ].join('|')
    },
    tagOptions () {
      const counts = new Map()
      for (const product of this.products) {
        const tags = Array.isArray(product.tags) ? product.tags : []
        for (const tag of tags) {
          if (!tag) continue
          counts.set(tag, (counts.get(tag) || 0) + 1)
        }
      }
      return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([tag, count]) => ({ tag, count }))
    },
    filteredProducts () {
      const query = this.search.trim().toLowerCase()
      let items = this.products
      if (this.activeTag) {
        items = items.filter(product =>
          Array.isArray(product.tags) && product.tags.includes(this.activeTag)
        )
      }
      if (query) {
        items = items.filter(product => {
          const tags = Array.isArray(product.tags) ? product.tags : []
          const haystack = [product.title, product.body, ...tags].join(' ').toLowerCase()
          return haystack.includes(query)
        })
      }
      return items
    },
    sortedProducts () {
      const items = this.filteredProducts.slice()
      const featured = this.featuredKeys
      const rank = (product) => {
        const index = featured.indexOf(
          String(product.author).toLowerCase() + '/' + String(product.permlink).toLowerCase()
        )
        return index === -1 ? Number.MAX_SAFE_INTEGER : index
      }
      const byNewest = (left, right) => productTime(right) - productTime(left)

      if (this.sortValue === 'price-asc' || this.sortValue === 'price-desc') {
        const direction = this.sortValue === 'price-asc' ? 1 : -1
        return items.sort((left, right) => {
          const difference = (Number(left.price) - Number(right.price)) * direction
          if (difference) return difference
          return byNewest(left, right)
        })
      }

      return items.sort((left, right) => rank(left) - rank(right) || byNewest(left, right))
    },
    resultsLabel () {
      const total = this.products.length
      const shown = this.sortedProducts.length
      const noun = total === 1 ? 'product' : 'products'
      if (shown === total) return total + ' ' + noun
      return shown + ' of ' + total + ' ' + noun
    }
  },
  watch: {
    loadKey: 'load'
  },
  created () {
    this.load()
  },
  methods: {
    isPurchasable,
    query (extra = {}) {
      const params = {
        limit: PAGE_SIZE,
        includeInactive: this.soldOutValue
      }
      if (this.shop.source === 'tag' && this.shop.tag) params.tag = this.shop.tag
      else params.author = this.blog.accountName
      if (this.featuredKeys.length) params.featured = this.shop.featured
      return { ...params, ...extra }
    },
    async load () {
      const requestId = ++this.requestId
      this.error = ''
      this.loadMoreError = ''
      this.loadingMore = false
      this.products = []
      this.nextCursor = null

      if (!this.blog.accountName) {
        if (this.blog.loading) {
          this.loading = true
          return
        }
        this.loading = false
        this.error = this.blog.error || 'This host is not a Banksia blog.'
        return
      }

      if (!this.settingsReady) {
        if (this.blog.loading) {
          this.loading = true
          return
        }
        this.loading = false
        this.error = this.blog.error || 'The blog settings could not be loaded.'
        return
      }

      if (!this.enabled) {
        this.loading = false
        this.updateMeta()
        return
      }

      this.loading = true
      try {
        const page = await listProducts(this.query())
        if (requestId !== this.requestId) return
        this.products = page && Array.isArray(page.items) ? page.items.filter(Boolean) : []
        this.nextCursor = page && page.nextCursor ? page.nextCursor : null
        if (this.activeTag && !this.tagOptions.some(option => option.tag === this.activeTag)) {
          this.activeTag = ''
        }
        this.updateMeta()
      } catch (error) {
        if (requestId !== this.requestId) return
        this.error = error && error.message ? error.message : 'The shop could not be loaded.'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    async loadMore () {
      if (!this.nextCursor || this.loadingMore || this.loading) return
      this.loadingMore = true
      this.loadMoreError = ''
      const requestId = this.requestId
      try {
        const page = await listProducts(this.query({ cursor: this.nextCursor }))
        if (requestId !== this.requestId) return
        const items = page && Array.isArray(page.items) ? page.items.filter(Boolean) : []
        const known = new Set(this.products.map(product => product.author + '/' + product.permlink))
        this.products = [
          ...this.products,
          ...items.filter(product => {
            const key = product.author + '/' + product.permlink
            if (known.has(key)) return false
            known.add(key)
            return true
          })
        ]
        this.nextCursor = page && page.nextCursor ? page.nextCursor : null
        this.updateMeta()
      } catch (error) {
        if (requestId !== this.requestId) return
        this.loadMoreError = error && error.message
          ? error.message
          : 'More products could not be loaded.'
      } finally {
        if (requestId === this.requestId) this.loadingMore = false
      }
    },
    retry () {
      if (!this.settingsReady) return this.blog.load()
      return this.load()
    },
    clearFilters () {
      this.search = ''
      this.activeTag = ''
    },
    productPath (product) {
      return blogProductPath(product.permlink, product.author, this.blog.accountName)
    },
    payUrl (product) {
      const reference = encodeURIComponent(product.author + '/' + product.permlink)
      return 'https://banksia.io/pay?product=' + reference + '&quantity=1'
    },
    isMembership (product) {
      return isMembershipProduct(product)
    },
    membershipUrl (product) {
      return membershipSubscribeUrl(product, { absolute: true })
    },
    buyUrl (product) {
      return this.isMembership(product) ? this.membershipUrl(product) : this.payUrl(product)
    },
    recurrenceLabel,
    buyLabel (product) {
      if (this.isMembership(product)) return 'Subscribe (membership)'
      if (!product.subscription) return 'Buy on Banksia'
      return 'Subscribe (' + recurrenceLabel(product) + ')'
    },
    updateMeta () {
      if (typeof window === 'undefined') return
      const origin = window.location.origin
      const first = this.products[0]
      const image = first && first.image ? first.image : this.blog.ogImage
      const items = this.enabled
        ? this.products.slice(0, MAX_JSON_LD_ITEMS).map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Product',
              name: product.title,
              url: origin + this.productPath(product)
            }
          }))
        : []
      setPageMeta({
        title: this.title + ' — ' + this.blog.title,
        description: this.description || ('Products from @' + this.blog.accountName + ' on Hive.'),
        image,
        url: '/shop',
        type: 'website',
        baseUrl: origin,
        siteName: this.blog.title,
        noindex: !this.blog.claimed,
        jsonLd: this.enabled
          ? {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: this.title,
              description: this.description || undefined,
              url: origin + '/shop',
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: items.length,
                itemListElement: items
              }
            }
          : null
      })
    }
  }
}
</script>
