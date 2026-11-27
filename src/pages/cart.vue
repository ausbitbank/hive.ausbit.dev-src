<template>
  <q-page class="cart-page">
    <div class="cart-shell">
      <nav class="cart-crumb" aria-label="Breadcrumb">
        <router-link to="/">Banksia</router-link>
        <span aria-hidden="true">/</span>
        <span>Cart</span>
      </nav>

      <header class="cart-head">
        <h1 class="cart-title">Cart</h1>
        <p class="cart-note">
          Cart items are stored on this device. Checkout re-reads every product
          from Hive before it queues a payment.
        </p>
      </header>

      <div v-if="loading" class="cart-loading" aria-busy="true" aria-label="Loading cart">
        <q-card v-for="n in 3" :key="n" flat bordered class="cart-card">
          <q-card-section>
            <q-skeleton type="rect" height="22px" width="45%" />
            <q-skeleton type="rect" height="14px" class="q-mt-md" />
            <q-skeleton type="rect" height="14px" width="60%" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <div v-else-if="error" class="cart-state" role="alert">
        <h2>Cart unavailable</h2>
        <p>{{ error }}</p>
        <q-btn outline no-caps color="primary" label="Try again" @click="load" />
      </div>

      <div v-else-if="!items.length" class="cart-state">
        <h2>Your cart is empty</h2>
        <p>Browse a blog shop and add a Hive Open Market product to get started.</p>
        <q-btn outline no-caps color="primary" label="Browse blogs" to="/blogs" />
      </div>

      <template v-else>
        <q-banner v-if="productErrorsVisible" rounded class="cart-banner cart-banner--warning">
          <template #avatar><q-icon name="warning" /></template>
          Some products could not be loaded from Hive. Remove them or retry.
          <template #action>
            <q-btn flat no-caps label="Retry" @click="load" />
          </template>
        </q-banner>

        <q-banner v-if="cart.isFull" rounded class="cart-banner">
          <template #avatar><q-icon name="info" /></template>
          Your cart holds the maximum of {{ maxItems }} products. Remove one to
          add another.
        </q-banner>

        <section
          v-for="group in groups"
          :key="group.seller"
          class="cart-group"
          :aria-labelledby="'cart-seller-' + group.seller"
        >
          <h2 :id="'cart-seller-' + group.seller" class="cart-seller">
            Sold by
            <router-link :to="'/@' + group.seller">@{{ group.seller }}</router-link>
          </h2>

          <q-card v-for="line in group.lines" :key="line.key" flat bordered class="cart-card">
            <q-card-section class="cart-line">
              <img
                v-if="line.product && line.product.image"
                :src="line.product.image"
                alt=""
                class="cart-image"
                loading="lazy"
              />
              <span v-else class="cart-image cart-image--placeholder" aria-hidden="true">
                {{ lineTitle(line).slice(0, 1) }}
              </span>

              <div class="cart-line__copy">
                <h3 class="cart-line__title">
                  <a v-if="line.product" :href="productPath(line)">{{ lineTitle(line) }}</a>
                  <span v-else>{{ lineTitle(line) }}</span>
                </h3>

                <p v-if="line.product" class="cart-line__meta">
                  <span :class="'cart-status cart-status--' + line.product.status">
                    {{ line.product.statusLabel }}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{{ line.product.priceLabel }} each</span>
                </p>
                <p v-if="line.product && line.product.subscription" class="cart-line__meta">
                  Renews every {{ line.product.recurrenceHours }} hours. Subscriptions
                  are limited to one per line; the renewal count is chosen at checkout.
                </p>
                <p v-if="line.error" class="cart-line__error" role="alert">{{ line.error }}</p>

                <div v-if="line.product" class="cart-line__controls">
                  <template v-if="!line.product.subscription">
                    <q-btn
                      flat
                      round
                      dense
                      icon="remove"
                      :aria-label="'Decrease quantity of ' + lineTitle(line)"
                      :disable="line.quantity <= 1"
                      @click="setQuantity(line, line.quantity - 1)"
                    />
                    <span
                      class="cart-qty"
                      role="status"
                      :aria-label="'Quantity: ' + line.quantity"
                    >{{ line.quantity }}</span>
                    <q-btn
                      flat
                      round
                      dense
                      icon="add"
                      :aria-label="'Increase quantity of ' + lineTitle(line)"
                      :disable="line.quantity >= maxQuantity"
                      @click="setQuantity(line, line.quantity + 1)"
                    />
                  </template>
                  <span v-else class="cart-qty cart-qty--fixed">
                    Quantity 1
                  </span>

                  <span class="cart-line__subtotal">
                    <span class="cart-line__subtotal-label">Line total</span>
                    <strong>{{ lineTotal(line) }}</strong>
                  </span>
                </div>

                <div v-else class="cart-line__controls">
                  <span class="cart-qty cart-qty--fixed">Unavailable</span>
                </div>
              </div>

              <q-btn
                flat
                round
                dense
                icon="delete_outline"
                class="cart-remove"
                :aria-label="'Remove ' + lineTitle(line) + ' from cart'"
                @click="remove(line)"
              />
            </q-card-section>
          </q-card>
        </section>

        <div class="cart-footer">
          <div class="cart-totals">
            <p class="cart-totals__label">Subtotal</p>
            <p v-for="total in totals" :key="total.ticker" class="cart-totals__value">
              {{ total.label }}
            </p>
            <p v-if="!totals.length" class="cart-muted">No prices available.</p>
            <p v-if="totals.length > 1" class="cart-muted">
              Totals are shown per currency and are not converted.
            </p>
          </div>

          <div class="cart-actions">
            <q-btn unelevated no-caps color="primary" label="Checkout" :to="checkoutLink" />
            <q-btn flat no-caps label="Continue shopping" to="/blogs" />
            <q-btn flat no-caps color="negative" label="Clear cart" @click="confirmClear" />
          </div>
        </div>

        <q-banner rounded class="cart-banner cart-banner--warning">
          <template #avatar><q-icon name="warning" /></template>
          Checkout queues one direct Hive transfer per item for your approval.
          There is no escrow and no buyer protection.
        </q-banner>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.cart-page {
  background: var(--c-bg);
}

.cart-shell {
  max-width: 820px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.cart-crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.cart-crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.cart-head {
  margin-bottom: 1.25rem;
}

.cart-title {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2rem);
}

.cart-note {
  margin: 0.45rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.88rem;
  line-height: 1.6;
}

.cart-loading {
  display: grid;
  gap: 0.75rem;
}

.cart-state {
  padding: 1.25rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.cart-state h2 {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
}

.cart-state p {
  margin: 0 0 1rem;
  color: var(--c-text-muted);
  line-height: 1.6;
}

.cart-banner {
  margin-bottom: 0.9rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.cart-banner--warning {
  border-color: var(--c-warning);
}

.cart-group {
  margin-bottom: 1.25rem;
}

.cart-seller {
  margin: 0 0 0.5rem;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cart-seller a {
  color: var(--c-link);
  text-decoration: none;
}

.cart-card {
  margin-bottom: 0.6rem;
  background: var(--c-surface);
  border-color: var(--c-border);
}

.cart-line {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
}

.cart-image {
  width: 84px;
  height: 84px;
  flex: none;
  border-radius: 10px;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  object-fit: cover;
}

.cart-image--placeholder {
  display: grid;
  place-items: center;
  color: var(--c-text-muted);
  font-size: 1.5rem;
  font-weight: 700;
  text-transform: uppercase;
}

.cart-line__copy {
  min-width: 0;
  flex: 1;
}

.cart-line__title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
}

.cart-line__title a {
  color: var(--c-text);
  text-decoration: none;
}

.cart-line__title a:hover {
  color: var(--c-link);
}

.cart-line__meta {
  margin: 0.3rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.cart-line__meta > span + span {
  margin-left: 0.3rem;
}

.cart-line__error {
  margin: 0.35rem 0 0;
  color: var(--c-warning);
  font-size: 0.82rem;
}

.cart-status--1 { color: var(--c-positive); }
.cart-status--2 { color: var(--c-text-muted); }
.cart-status--3 { color: var(--c-warning); }

.cart-line__controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}

.cart-qty {
  min-width: 2rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.cart-qty--fixed {
  color: var(--c-text-muted);
  font-size: 0.8rem;
  font-weight: 400;
}

.cart-line__subtotal {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.cart-line__subtotal-label {
  color: var(--c-text-muted);
  font-size: 0.75rem;
}

.cart-line__subtotal strong {
  font-variant-numeric: tabular-nums;
}

.cart-remove {
  flex: none;
  color: var(--c-text-muted);
}

.cart-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin: 1.25rem 0;
  padding: 1rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.cart-totals__label {
  margin: 0 0 0.3rem;
  color: var(--c-text-muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cart-totals__value {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cart-muted {
  margin: 0.3rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.cart-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .cart-line {
    flex-wrap: wrap;
  }

  .cart-image {
    width: 64px;
    height: 64px;
  }

  .cart-line__subtotal {
    margin-left: 0;
    width: 100%;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchPostContent } from 'src/services/chainData'
import { normalizeProduct } from 'src/services/hiveMarket'
import { blogBaseUrl } from 'src/services/blogHost'
import { parseProductMetadata, productTotalLabel } from 'src/services/blogShop'
import { checkoutUrl, parseCheckoutItems, totalsByTicker } from 'src/services/shopCart'
import { MAX_CART_QUANTITY, useCartStore } from 'src/stores/cart'
import { BLOG_MAX_CART_ITEMS } from 'src/config/blog'

export default {
  name: 'CartPage',
  data () {
    return {
      loading: true,
      error: '',
      products: {},
      productErrors: {},
      maxItems: BLOG_MAX_CART_ITEMS,
      maxQuantity: MAX_CART_QUANTITY
    }
  },
  computed: {
    cart () {
      return useCartStore()
    },
    items () {
      return this.cart.items
    },
    lines () {
      return this.items.map(item => {
        const key = item.author + '/' + item.permlink
        return {
          ...item,
          key,
          product: this.products[key] || null,
          error: this.productErrors[key] || ''
        }
      })
    },
    groups () {
      const groups = []
      const index = new Map()
      for (const line of this.lines) {
        if (!index.has(line.author)) {
          index.set(line.author, { seller: line.author, lines: [] })
          groups.push(index.get(line.author))
        }
        index.get(line.author).lines.push(line)
      }
      return groups
    },
    totals () {
      return totalsByTicker(this.lines.filter(line => line.product))
    },
    productErrorsVisible () {
      return this.lines.some(line => line.error)
    },
    checkoutLink () {
      return checkoutUrl(this.items)
    }
  },
  created () {
    this.mergeRouteItems()
    this.load()
    this.updateMeta()
  },
  methods: {
    /**
     * A product page on a blog host carries the local cart in `?items=` because
     * localStorage is origin-scoped. Merge it without duplicating lines or
     * increasing a quantity the buyer already chose.
     */
    mergeRouteItems () {
      const items = parseCheckoutItems(this.$route.query.items)
      for (const item of items) {
        const key = item.author + '/' + item.permlink
        if (!this.cart.has(key)) this.cart.add(item)
      }
    },
    async load () {
      const items = this.items.slice()
      this.loading = true
      this.error = ''
      this.productErrors = {}

      if (!items.length) {
        this.loading = false
        return
      }

      const products = {}
      const productErrors = {}
      const results = await Promise.allSettled(items.map(item =>
        fetchPostContent(item.author, item.permlink, { force: true })
      ))

      results.forEach((result, position) => {
        const item = items[position]
        const key = item.author + '/' + item.permlink
        if (result.status !== 'fulfilled') {
          productErrors[key] = 'This product could not be loaded from Hive.'
          return
        }
        const product = normalizeProduct(result.value) ||
          parseProductMetadata(result.value)
        if (!product) {
          productErrors[key] = 'That post is not a Hive Open Market product.'
          return
        }
        products[key] = product
      })

      this.products = products
      this.productErrors = productErrors

      if (items.length && Object.keys(products).length === 0) {
        this.error = 'None of the products in your cart could be loaded from Hive.'
      }
      this.loading = false
    },
    lineTitle (line) {
      return line.product ? line.product.title : line.permlink
    },
    lineTotal (line) {
      return line.product ? productTotalLabel(line.product, line.quantity) : ''
    },
    productPath (line) {
      if (!line.product) return ''
      return blogBaseUrl(line.product.author) + '/@' + line.product.author + '/' + line.product.permlink
    },
    setQuantity (line, quantity) {
      this.cart.setQuantity(line.key, quantity)
    },
    remove (line) {
      this.cart.remove(line.key)
    },
    confirmClear () {
      this.$q.dialog({
        title: 'Clear cart?',
        message: 'This removes every product from this device. It cannot be undone.',
        cancel: true,
        persistent: true
      }).onOk(() => {
        this.cart.clear()
      })
    },
    updateMeta () {
      setPageMeta({
        title: 'Cart — banksia.io',
        description: 'Review Hive Open Market products before checkout.',
        url: '/cart',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
