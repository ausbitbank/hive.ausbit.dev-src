<template>
  <div class="product-page">
    <p class="product-kicker"><router-link to="/shop">← {{ shopTitle }}</router-link></p>

    <div v-if="loading" class="product-state" role="status" aria-busy="true">
      <div class="product-state__line product-state__line--title"></div>
      <div class="product-state__line"></div>
      <div class="product-state__line product-state__line--short"></div>
    </div>

    <div v-else-if="error" class="product-state" role="alert">
      <h1 class="product-state__title">Product unavailable</h1>
      <p>{{ error }}</p>
      <q-btn outline no-caps color="primary" label="Try again" @click="load" />
      <router-link to="/shop" class="product-state__link">Back to the shop</router-link>
    </div>

    <div v-else-if="notFound" class="product-state" role="alert">
      <h1 class="product-state__title">Product not found</h1>
      <p>
        This item is not a Hive Open Market product, or it is no longer available
        on Hive. Product links look like <code>/shop/&lt;permlink&gt;</code>.
      </p>
      <router-link to="/shop" class="product-state__link">Back to the shop</router-link>
    </div>

    <article v-else-if="product" class="product">
      <div class="product-gallery">
        <figure
          ref="galleryMain"
          class="product-gallery__main"
          tabindex="-1"
          :aria-label="product.title + ' image'"
        >
          <img v-if="activeImageUrl" :src="activeImageUrl" :alt="product.title" />
          <span v-else class="product-gallery__placeholder" aria-hidden="true">{{ product.title.slice(0, 1) }}</span>
        </figure>

        <ul
          v-if="images.length > 1"
          ref="thumbnails"
          class="product-gallery__thumbs"
          aria-label="Product images"
          @keydown="onGalleryKey"
        >
          <li v-for="(image, index) in images" :key="image">
            <button
              type="button"
              class="product-gallery__thumb"
              :class="{ 'product-gallery__thumb--active': index === activeImage }"
              :aria-pressed="index === activeImage"
              :aria-label="'Show image ' + (index + 1) + ' of ' + images.length"
              @click="activeImage = index"
            >
              <img :src="image" alt="" loading="lazy" />
            </button>
          </li>
        </ul>
        <p v-if="images.length > 1" class="product-gallery__hint">
          Use the arrow keys to browse images; Escape returns to the main image.
        </p>
      </div>

      <header class="product-head">
        <p class="product-price">{{ product.priceLabel }}</p>
        <h1 class="product-title">{{ product.title }}</h1>

        <p class="product-meta">
          <span :class="'product-status product-status--' + product.status">{{ product.statusLabel }}</span>
          <template v-if="product.subscription">
            <span aria-hidden="true">·</span>
            <span>Recurring {{ recurrenceLabel(product) }}</span>
          </template>
          <template v-if="dateLabel">
            <span aria-hidden="true">·</span>
            <time :datetime="product.created">{{ dateLabel }}</time>
          </template>
          <template v-if="membership">
            <span aria-hidden="true">·</span>
            <span class="product-membership-badge">Membership</span>
          </template>
        </p>

        <p class="product-seller">
          Sold by
          <router-link v-if="isOwner" to="/">@{{ product.author }}</router-link>
          <a v-else :href="sellerUrl" target="_blank" rel="noopener noreferrer">@{{ product.author }}</a>
        </p>

        <p v-if="seller && seller.edited" class="product-edited">
          Seller edited this product on {{ seller.lastUpdateLabel }}.
        </p>

        <p v-if="purchased" class="product-badge">You bought this</p>

        <ul v-if="product.tags && product.tags.length" class="product-tags" aria-label="Product tags">
          <li v-for="tag in product.tags" :key="tag">#{{ tag }}</li>
        </ul>
      </header>

      <div class="product-actions">
        <a
          v-if="purchasable"
          :href="ctaUrl"
          class="product-buy"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ ctaLabel }}
        </a>

        <div v-if="purchasable && !membership" class="product-cart">
          <template v-if="!product.subscription">
            <label class="product-cart__label" for="product-quantity">Quantity</label>
            <input
              id="product-quantity"
              v-model.number="quantity"
              class="product-cart__input"
              type="number"
              min="1"
              max="99"
              inputmode="numeric"
            />
          </template>
          <q-btn unelevated no-caps color="primary" label="Add to cart" @click="addToCart" />
          <span v-if="product.subscription" class="product-cart__note">
            Subscriptions are added as a single recurring item.
          </span>
          <p v-if="cartMessage" class="product-cart__message" role="status">
            {{ cartMessage }}
            <a :href="cartUrl" class="product-cart__link">View cart</a>
          </p>
        </div>

        <p v-else class="product-unavailable" role="note">
          Payment is disabled for this product.
          {{ unavailableReason }}
        </p>
      </div>

      <aside v-if="seller" class="product-seller-card" aria-labelledby="product-seller-title">
        <div class="product-seller-card__head">
          <img :src="sellerAvatar" alt="" class="product-seller-card__avatar" width="40" height="40" loading="lazy" />
          <div>
            <h2 id="product-seller-title" class="product-seller-card__title">About @{{ product.author }}</h2>
            <p class="product-seller-card__note">Public Hive account signals, not a buyer-protection rating.</p>
          </div>
        </div>
        <dl class="product-seller-card__facts">
          <div v-if="seller.joinedLabel">
            <dt>On Hive</dt>
            <dd>{{ seller.joinedLabel }}<template v-if="seller.ageLabel"> · {{ seller.ageLabel }}</template></dd>
          </div>
          <div v-if="seller.reputationLabel">
            <dt>Reputation</dt>
            <dd>{{ seller.reputationLabel }}</dd>
          </div>
          <div v-if="seller.postCount !== null">
            <dt>Posts</dt>
            <dd>{{ seller.postCount }}</dd>
          </div>
        </dl>
        <a :href="sellerProfileUrl" class="product-seller-card__link" target="_blank" rel="noopener noreferrer">
          View @{{ product.author }} on Banksia
        </a>
      </aside>

      <section v-if="membership" class="product-membership" aria-label="Membership details">
        <h2 class="product-description__title">Membership</h2>
        <p class="product-membership__note">
          This is a Banksia Vault membership. Subscribe on banksia.io so your
          reader key can be attached to the payment memo and the creator can
          issue your access grant. Cart checkout is not used for memberships.
        </p>
        <ul v-if="membership.benefits.length" class="product-membership__list">
          <li v-for="benefit in membership.benefits" :key="benefit">{{ benefit }}</li>
        </ul>
        <p class="product-membership__note">
          Billing: {{ product.priceLabel }} every {{ membership.recurrenceHours }} hours.
          Cancel from <a href="https://banksia.io/subscriptions">your subscriptions</a>.
        </p>
      </section>

      <section class="product-description" aria-label="Product description">
        <h2 class="product-description__title">Description</h2>
        <p v-if="product.body" class="product-body">{{ product.body }}</p>
        <p v-else class="product-body product-body--empty">No description was provided for this product.</p>
      </section>

      <p class="product-warning">
        Payment opens on banksia.io and is a direct Hive transfer — there is no
        escrow, shipping calculation or buyer protection. Subscriptions use Hive
        recurrent transfers.
      </p>
    </article>
  </div>
</template>

<style scoped>
.product-page {
  max-width: 860px;
}

.product-kicker {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.product-kicker a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.product-kicker a:hover {
  color: var(--c-link);
}

.product-gallery {
  margin-bottom: 1.5rem;
}

.product-gallery__main {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  max-height: 480px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface-2);
}

.product-gallery__main:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 2px;
}

.product-gallery__main img {
  display: block;
  width: 100%;
  max-height: 480px;
  object-fit: contain;
}

.product-gallery__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 220px;
  color: var(--c-text-faint);
  font-family: var(--font-display);
  font-size: 4rem;
}

.product-gallery__thumbs {
  display: flex;
  gap: 0.5rem;
  margin: 0.7rem 0 0;
  padding: 0 0 0.2rem;
  overflow-x: auto;
  list-style: none;
}

.product-gallery__thumb {
  display: block;
  width: 72px;
  height: 72px;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--c-border);
  border-radius: 8px;
  background: var(--c-surface-2);
  cursor: pointer;
}

.product-gallery__thumb--active {
  border-color: var(--c-primary);
}

.product-gallery__thumb:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 2px;
}

.product-gallery__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-gallery__hint {
  margin: 0.45rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.product-head {
  margin-bottom: 1.25rem;
}

.product-price {
  margin: 0 0 0.35rem;
  color: var(--c-primary);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.product-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.65rem, 4vw, 2.4rem);
  line-height: 1.15;
}

.product-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.6rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.product-status--1 { color: var(--c-positive); }
.product-status--2 { color: var(--c-text-muted); }
.product-status--3 { color: var(--c-warning); }

.product-seller {
  margin: 0.5rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.85rem;
}

.product-seller a {
  color: var(--c-link);
}

.product-badge {
  display: inline-block;
  margin: 0.7rem 0 0;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--c-positive);
  border-radius: 999px;
  color: var(--c-positive);
  font-size: 0.78rem;
  font-weight: 600;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--c-text-faint);
  font-size: 0.78rem;
}

.product-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
  padding: 0.9rem 0;
  border-top: 1px solid var(--c-border);
  border-bottom: 1px solid var(--c-border);
}

.product-buy {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.product-buy:hover {
  filter: brightness(1.06);
}

.product-cart {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.product-cart__label {
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.product-cart__input {
  width: 4.5rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: var(--c-surface);
  color: var(--c-text);
  font: inherit;
  font-size: 0.85rem;
}

.product-cart__input:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 1px;
}

.product-cart__note {
  flex-basis: 100%;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.product-cart__message {
  flex-basis: 100%;
  margin: 0;
  color: var(--c-positive);
  font-size: 0.8rem;
}

.product-cart__link {
  margin-left: 0.35rem;
  color: var(--c-link);
}

.product-unavailable {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

.product-edited {
  margin: 0.35rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.product-seller-card {
  margin: 1.5rem 0 0;
  padding: 1rem 1.1rem;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
}

.product-seller-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.product-seller-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  flex: none;
}

.product-seller-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.product-seller-card__note {
  margin: 0.2rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.product-seller-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.5rem;
  margin: 0.85rem 0 0;
}

.product-seller-card__facts dt {
  color: var(--c-text-faint);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.product-seller-card__facts dd {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.86rem;
}

.product-seller-card__link {
  display: inline-block;
  margin-top: 0.75rem;
  color: var(--c-link);
  font-size: 0.82rem;
}

.product-membership {
  margin: 1.5rem 0 0;
  padding: 1rem 1.1rem;
  border: 1px solid var(--c-primary);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
}

.product-membership__note {
  margin: 0.35rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
  line-height: 1.6;
}

.product-membership__note a {
  color: var(--c-link);
}

.product-membership__list {
  margin: 0.6rem 0 0;
  padding-left: 1.1rem;
  color: var(--c-text);
  font-size: 0.88rem;
  line-height: 1.6;
}

.product-membership-badge {
  color: var(--c-primary);
  font-weight: 700;
}

.product-description {
  margin: 1.5rem 0 0;
}

.product-description__title {
  margin: 0 0 0.6rem;
  color: var(--c-text-muted);
  font-family: var(--font-display);
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.product-body {
  margin: 0;
  color: var(--c-text);
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.product-body--empty {
  color: var(--c-text-muted);
  font-style: italic;
}

.product-warning {
  margin: 1.5rem 0 0;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  color: var(--c-text-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.product-state {
  padding: 1.35rem;
  border: 1px dashed var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  color: var(--c-text-muted);
}

.product-state__title {
  margin: 0 0 0.35rem;
  color: var(--c-text);
  font-family: var(--font-display);
  font-size: 1.3rem;
}

.product-state p {
  margin: 0 0 0.8rem;
  max-width: 68ch;
  line-height: 1.6;
}

.product-state code {
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
}

.product-state__link {
  display: inline-block;
  margin-left: 0.75rem;
  color: var(--c-link);
  font-size: 0.85rem;
}

.product-state__line {
  height: 0.8rem;
  margin-bottom: 0.6rem;
  border-radius: 999px;
  background: var(--c-surface-2);
  animation: product-pulse 1.4s ease-in-out infinite;
}

.product-state__line--title {
  width: 52%;
  height: 1.4rem;
}

.product-state__line--short {
  width: 68%;
}

@keyframes product-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .product-state__line { animation: none; }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccount, fetchPostContent } from 'src/services/chainData'
import { isPurchasable, isSupportedProduct } from 'src/services/blogShop'
import { normalizeProduct, productJsonLd } from 'src/services/hiveMarket'
import { blogProductPath, parseProductRoute } from 'src/services/blogProductPath'
import { blogPostExcerpt, formatBlogDate } from 'src/services/blogPosts'
import { PURCHASES_STORAGE_KEY, serializeCheckoutItems } from 'src/services/shopCart'
import { membershipFromProduct, membershipSubscribeUrl } from 'src/services/shopMembership'
import { buildSellerTrust } from 'src/services/shopSeller'
import { useBlogStore } from 'src/stores/blog'
import { useCartStore } from 'src/stores/cart'

const MAX_QUANTITY = 99

function recurrenceLabel (product) {
  const hours = Number(product && product.recurrenceHours) || 0
  if (!hours) return ''
  if (hours % 24 === 0) {
    const days = hours / 24
    return 'every ' + days + (days === 1 ? ' day' : ' days')
  }
  return 'every ' + hours + (hours === 1 ? ' hour' : ' hours')
}

function matchesPurchase (value, key) {
  if (!value) return false
  if (typeof value === 'string') return value.trim().toLowerCase() === key
  if (Array.isArray(value)) return value.some(entry => matchesPurchase(entry, key))
  if (typeof value !== 'object') return false
  if (typeof value.key === 'string' && value.key.trim().toLowerCase() === key) return true
  if (value.author && value.permlink) {
    return (String(value.author) + '/' + String(value.permlink)).toLowerCase() === key
  }
  if (Object.prototype.hasOwnProperty.call(value, key) && value[key]) return true
  if (Array.isArray(value.items) && matchesPurchase(value.items, key)) return true
  return Object.keys(value).some(name => name.toLowerCase() === key && Boolean(value[name]))
}

function purchaseRecorded (author, permlink) {
  if (typeof window === 'undefined') return false
  const key = (String(author) + '/' + String(permlink)).toLowerCase()
  try {
    const raw = window.localStorage.getItem(PURCHASES_STORAGE_KEY)
    if (!raw) return false
    return matchesPurchase(JSON.parse(raw), key)
  } catch {
    return false
  }
}

export default {
  name: 'BlogProduct',
  data () {
    return {
      product: null,
      seller: null,
      loading: true,
      error: '',
      notFound: false,
      activeImage: 0,
      quantity: 1,
      cartMessage: '',
      purchased: false,
      requestId: 0
    }
  },
  computed: {
    blog () {
      return useBlogStore()
    },
    shopTitle () {
      return this.blog.shop.title || 'Shop'
    },
    images () {
      if (!this.product) return []
      const list = Array.isArray(this.product.images) ? this.product.images.filter(Boolean) : []
      if (list.length) return list
      return this.product.image ? [this.product.image] : []
    },
    activeImageUrl () {
      return this.images[this.activeImage] || this.images[0] || ''
    },
    dateLabel () {
      return this.product ? formatBlogDate(this.product.created) : ''
    },
    isOwner () {
      if (!this.product) return false
      return String(this.product.author).toLowerCase() === String(this.blog.accountName).toLowerCase()
    },
    sellerUrl () {
      return this.product ? 'https://banksia.io/@' + this.product.author : 'https://banksia.io'
    },
    sellerProfileUrl () {
      return this.sellerUrl
    },
    sellerAvatar () {
      return this.product
        ? 'https://images.hive.blog/u/' + encodeURIComponent(this.product.author) + '/avatar'
        : ''
    },
    membership () {
      return membershipFromProduct(this.product)
    },
    membershipUrl () {
      return membershipSubscribeUrl(this.product, { absolute: true })
    },
    purchasable () {
      return isPurchasable(this.product)
    },
    unavailableReason () {
      if (!this.product) return ''
      if (this.product.status !== 1) {
        return 'This product is ' + String(this.product.statusLabel || 'unavailable').toLowerCase() + '.'
      }
      if (!isSupportedProduct(this.product)) {
        return 'Banksia only supports HBD and HIVE products.'
      }
      return ''
    },
    payUrl () {
      if (!this.product) return 'https://banksia.io/pay'
      const reference = encodeURIComponent(this.product.author + '/' + this.product.permlink)
      return 'https://banksia.io/pay?product=' + reference + '&quantity=1'
    },
    ctaUrl () {
      return this.membership ? this.membershipUrl : this.payUrl
    },
    ctaLabel () {
      if (this.membership) return 'Subscribe to membership'
      return this.product && this.product.subscription
        ? 'Subscribe (' + recurrenceLabel(this.product) + ')'
        : 'Buy on Banksia'
    },
    path () {
      if (!this.product) return '/shop'
      return blogProductPath(this.product.permlink, this.product.author, this.blog.accountName)
    },
    cartQuantity () {
      if (!this.product) return 1
      if (this.product.subscription) return 1
      const value = Math.floor(Number(this.quantity) || 1)
      return Math.min(MAX_QUANTITY, Math.max(1, value))
    },
    cartUrl () {
      // The blog host and the apex are different origins, so localStorage does
      // not cross the boundary. Carry the local cart in the link; /cart merges
      // it into the apex cart without trusting prices or sellers.
      const items = useCartStore().items
      const serialized = serializeCheckoutItems(items)
      return 'https://banksia.io/cart' + (serialized ? '?items=' + serialized : '')
    }
  },
  watch: {
    '$route.params.permlink': 'load',
    '$route.params.author': 'load',
    'blog.accountName': 'load',
    'blog.settings': 'refreshMeta'
  },
  created () {
    this.load()
  },
  mounted () {
    this.loadPurchases()
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.loadPurchases)
    }
  },
  beforeUnmount () {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.loadPurchases)
    }
  },
  methods: {
    async load () {
      const requestId = ++this.requestId
      this.loading = true
      this.error = ''
      this.notFound = false
      this.product = null
      this.seller = null
      this.activeImage = 0
      this.quantity = 1
      this.cartMessage = ''

      if (!this.blog.accountName) {
        if (this.blog.loading) return
        this.loading = false
        this.notFound = true
        this.updateNotFoundMeta()
        return
      }

      const route = parseProductRoute(this.$route.params, this.blog.accountName)
      if (!route) {
        this.loading = false
        this.notFound = true
        this.updateNotFoundMeta()
        return
      }

      try {
        const post = await fetchPostContent(route.author, route.permlink)
        if (requestId !== this.requestId) return
        const product = post ? normalizeProduct(post) : null
        if (!product) {
          this.notFound = true
          this.updateNotFoundMeta()
          return
        }
        this.product = product
        this.loadPurchases()
        this.updateMeta()
        this.loadSeller(requestId)
      } catch (error) {
        if (requestId !== this.requestId) return
        this.error = error && error.message ? error.message : 'This product could not be loaded.'
        this.updateErrorMeta()
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    async loadSeller (requestId = this.requestId) {
      const author = this.product && this.product.author
      if (!author) return
      try {
        const account = await fetchAccount(author)
        if (requestId !== this.requestId) return
        this.seller = buildSellerTrust(account, { product: this.product })
      } catch {
        if (requestId === this.requestId) this.seller = null
      }
    },
    loadPurchases () {
      if (!this.product) {
        this.purchased = false
        return
      }
      this.purchased = purchaseRecorded(this.product.author, this.product.permlink)
    },
    refreshMeta () {
      if (this.product) this.updateMeta()
    },
    addToCart () {
      if (!this.product || !this.purchasable) return
      this.cartMessage = ''
      try {
        const cart = useCartStore()
        const added = cart.add({
          author: this.product.author,
          permlink: this.product.permlink,
          quantity: this.cartQuantity
        })
        if (added === false) {
          this.cartMessage = 'The cart is full or this product cannot be added.'
          return
        }
        this.cartMessage = this.product.subscription
          ? 'Subscription added to the cart.'
          : 'Added to the cart.'
      } catch {
        this.cartMessage = 'The cart could not be updated. Try again.'
      }
    },
    recurrenceLabel,
    onGalleryKey (event) {
      const length = this.images.length
      if (!length) return
      if (event.key === 'Escape') {
        event.preventDefault()
        const main = this.$refs.galleryMain
        if (main && typeof main.focus === 'function') main.focus()
        return
      }
      let next = this.activeImage
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (this.activeImage + 1) % length
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (this.activeImage - 1 + length) % length
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = length - 1
      } else {
        return
      }
      event.preventDefault()
      this.activeImage = next
      this.$nextTick(() => {
        const thumbnails = this.$refs.thumbnails
        const buttons = thumbnails ? thumbnails.querySelectorAll('button') : []
        if (buttons[next]) buttons[next].focus()
      })
    },
    updateMeta () {
      if (!this.product || typeof window === 'undefined') return
      const origin = window.location.origin
      const url = origin + this.path
      const description = blogPostExcerpt({ body: this.product.body }, 200) ||
        ('A Hive Open Market product from @' + this.product.author + '.')
      setPageMeta({
        title: this.product.title + ' — ' + this.shopTitle + ' — ' + this.blog.title,
        description,
        image: this.product.image || this.images[0] || this.blog.ogImage,
        url: this.path,
        type: 'website',
        baseUrl: origin,
        siteName: this.blog.title,
        noindex: !this.blog.claimed,
        jsonLd: productJsonLd(this.product, url)
      })
    },
    updateNotFoundMeta () {
      this.setProblemMeta('Product not found', 'This product is not available on Hive.')
    },
    updateErrorMeta () {
      this.setProblemMeta('Product unavailable', 'This product could not be loaded right now.')
    },
    setProblemMeta (heading, description) {
      if (typeof window === 'undefined') return
      setPageMeta({
        title: heading + ' — ' + this.shopTitle + ' — ' + this.blog.title,
        description,
        url: '/shop',
        type: 'website',
        baseUrl: window.location.origin,
        siteName: this.blog.title,
        noindex: true,
        jsonLd: null
      })
    }
  }
}
</script>
