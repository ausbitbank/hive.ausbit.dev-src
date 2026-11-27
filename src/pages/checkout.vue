<template>
  <q-page class="checkout-page">
    <div class="checkout-shell">
      <nav class="checkout-crumb" aria-label="Breadcrumb">
        <router-link to="/">Banksia</router-link>
        <span aria-hidden="true">/</span>
        <router-link to="/cart">Cart</router-link>
        <span aria-hidden="true">/</span>
        <span>Checkout</span>
      </nav>

      <header class="checkout-head">
        <h1 class="checkout-title">Checkout</h1>
        <p class="checkout-note">
          Every product below was re-read from Hive. Your cart link only selects
          products and quantities; it never supplies a price, seller or memo.
        </p>
      </header>

      <div v-if="loading" aria-busy="true" aria-label="Loading checkout">
        <q-card v-for="n in 3" :key="n" flat bordered class="checkout-card">
          <q-card-section>
            <q-skeleton type="rect" height="22px" width="45%" />
            <q-skeleton type="rect" height="14px" class="q-mt-md" />
            <q-skeleton type="rect" height="14px" width="60%" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <div v-else-if="error" class="checkout-state" role="alert">
        <h2>Checkout unavailable</h2>
        <p>{{ error }}</p>
        <q-btn outline no-caps color="primary" label="Try again" @click="load" />
      </div>

      <div v-else-if="!items.length" class="checkout-state">
        <h2>Nothing to check out</h2>
        <p>Add a Hive Open Market product to your cart first.</p>
        <q-btn outline no-caps color="primary" label="Back to cart" to="/cart" />
      </div>

      <template v-else>
        <q-banner rounded class="checkout-banner checkout-banner--warning">
          <template #avatar><q-icon name="warning" /></template>
          This is a direct Hive transfer to each seller. There is no escrow and no
          buyer protection. Review every amount and memo in your wallet before
          signing.
        </q-banner>

        <q-banner v-if="!signedIn" rounded class="checkout-banner">
          <template #avatar><q-icon name="login" /></template>
          Sign in from the top bar to queue these payments.
        </q-banner>

        <q-banner v-if="problems.length" rounded class="checkout-banner checkout-banner--warning">
          <template #avatar><q-icon name="error_outline" /></template>
          <ul class="checkout-errors">
            <li v-for="message in problems" :key="message">{{ message }}</li>
          </ul>
        </q-banner>

        <q-banner v-if="queueError" rounded class="checkout-banner checkout-banner--warning" role="alert">
          <template #avatar><q-icon name="error_outline" /></template>
          {{ queueError }}
        </q-banner>

        <q-banner v-if="queued" rounded class="checkout-banner checkout-banner--ok" role="status">
          <template #avatar><q-icon name="check_circle" /></template>
          {{ queued }} {{ queued === 1 ? 'payment' : 'payments' }} queued, not sent.
          Open the signing queue in the top bar, or review
          <router-link to="/orders">your orders</router-link>.
        </q-banner>

        <section
          v-for="line in lines"
          :key="line.key"
          class="checkout-line"
          :aria-labelledby="'checkout-line-' + line.key"
        >
          <q-card flat bordered class="checkout-card">
            <q-card-section>
              <div class="checkout-line__head">
                <div>
                  <p class="checkout-kicker">Sold by @{{ line.product.author }}</p>
                  <h2 :id="'checkout-line-' + line.key" class="checkout-line__title">
                    {{ line.product.title }}
                  </h2>
                  <p class="checkout-line__meta">
                    <span :class="'checkout-status checkout-status--' + line.product.status">
                      {{ line.product.statusLabel }}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{{ line.product.priceLabel }} each · quantity {{ line.quantity }}</span>
                  </p>
                </div>
                <p class="checkout-line__amount">{{ line.totalLabel }}</p>
              </div>

              <div class="checkout-line__details">
                <p class="checkout-detail">
                  <span class="checkout-detail__label">Memo</span>
                  <code>{{ line.memo }}</code>
                </p>
                <p class="checkout-detail">
                  <span class="checkout-detail__label">Operation</span>
                  <code>{{ line.operation ? line.operation[0] : 'unavailable' }}</code>
                </p>
                <p v-if="line.product.subscription" class="checkout-detail">
                  <span class="checkout-detail__label">Recurrence</span>
                  <span>
                    Every {{ line.recurrenceHours }} hours ×
                    {{ line.executions }} {{ line.executions === 1 ? 'payment' : 'payments' }}
                    = {{ line.commitmentLabel }} total
                  </span>
                </p>
              </div>

              <div v-if="line.product.subscription" class="checkout-executions">
                <q-select
                  :model-value="line.executions"
                  :options="executionOptions"
                  :label="'Payments for ' + line.product.title"
                  :aria-label="'Number of recurring payments for ' + line.product.title"
                  outlined
                  dense
                  class="checkout-executions__input"
                  @update:model-value="setExecutions(line, $event)"
                />
                <p class="checkout-line__meta">
                  Subscriptions are limited to one per line. Choosing fewer payments
                  sends a shorter recurrent transfer.
                </p>
              </div>

              <p class="checkout-op-label">Exact operation queued</p>
              <pre class="checkout-op">{{ operationJson(line) }}</pre>
            </q-card-section>
          </q-card>
        </section>

        <div class="checkout-footer">
          <div class="checkout-totals">
            <p class="checkout-totals__label">Per-payment subtotal</p>
            <p v-for="total in totals" :key="total.ticker" class="checkout-totals__value">
              {{ total.label }}
            </p>
            <p v-if="totals.length > 1" class="checkout-muted">
              Currencies are listed separately and are never added together.
            </p>
            <p class="checkout-muted">
              One operation per item. There is no combined payment and HOM memos
              stay per product.
            </p>
          </div>

          <div class="checkout-action">
            <q-banner rounded class="checkout-banner checkout-banner--warning checkout-banner--compact">
              <template #avatar><q-icon name="warning" /></template>
              No escrow, no buyer protection. The queue is not a broadcast.
            </q-banner>

            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="queueLabel"
              :disable="!canQueue"
              @click="queuePayments"
            />

            <p v-if="!canQueue && disabledReason" class="checkout-muted">
              {{ disabledReason }}
            </p>

            <p class="checkout-muted">
              After queueing, open the signing queue in the top bar and approve each
              transfer with your active key. <router-link to="/cart">Back to cart</router-link>
            </p>
          </div>
        </div>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.checkout-page {
  background: var(--c-bg);
}

.checkout-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.checkout-crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.checkout-crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.checkout-head {
  margin-bottom: 1.25rem;
}

.checkout-title {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2rem);
}

.checkout-note {
  margin: 0.45rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.88rem;
  line-height: 1.6;
}

.checkout-state {
  padding: 1.25rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.checkout-state h2 {
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
}

.checkout-state p {
  margin: 0 0 1rem;
  color: var(--c-text-muted);
  line-height: 1.6;
}

.checkout-banner {
  margin-bottom: 0.9rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.checkout-banner--warning {
  border-color: var(--c-warning);
}

.checkout-banner--ok {
  border-color: var(--c-positive);
}

.checkout-banner--compact {
  margin-bottom: 0.6rem;
}

.checkout-errors {
  margin: 0;
  padding-left: 1.1rem;
}

.checkout-line {
  margin-bottom: 0.75rem;
}

.checkout-card {
  background: var(--c-surface);
  border-color: var(--c-border);
}

.checkout-line__head {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.checkout-kicker {
  margin: 0 0 0.25rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.checkout-line__title {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.3;
}

.checkout-line__meta {
  margin: 0.3rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.checkout-line__meta > span + span {
  margin-left: 0.3rem;
}

.checkout-status--1 { color: var(--c-positive); }
.checkout-status--2 { color: var(--c-text-muted); }
.checkout-status--3 { color: var(--c-warning); }

.checkout-line__amount {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.checkout-line__details {
  margin-top: 0.7rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--c-border-subtle);
}

.checkout-detail {
  margin: 0.3rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.checkout-detail__label {
  display: inline-block;
  min-width: 5.5rem;
  color: var(--c-text-muted);
  font-weight: 600;
}

.checkout-detail code {
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
}

.checkout-executions {
  margin-top: 0.75rem;
}

.checkout-executions__input {
  max-width: 18rem;
}

.checkout-op-label {
  margin: 0.9rem 0 0.3rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.checkout-op {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: var(--c-surface-2);
  color: var(--c-text);
  font-size: 0.74rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.checkout-footer {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding: 1rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.checkout-totals__label {
  margin: 0 0 0.3rem;
  color: var(--c-text-muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.checkout-totals__value {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.checkout-muted {
  margin: 0.4rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.checkout-muted a {
  color: var(--c-link);
}

.checkout-action {
  min-width: 17rem;
  max-width: 26rem;
}

@media (max-width: 699px) {
  .checkout-line__head {
    flex-direction: column;
    gap: 0.4rem;
  }

  .checkout-action {
    min-width: 100%;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchPostContent } from 'src/services/chainData'
import { normalizeProduct } from 'src/services/hiveMarket'
import { formatProductAmount, parseProductMetadata } from 'src/services/blogShop'
import {
  MAX_SUBSCRIPTION_EXECUTIONS,
  buildPaymentOperation,
  parseCheckoutItems,
  recordPurchases,
  totalsByTicker,
  validateCheckout
} from 'src/services/shopCart'

export default {
  name: 'CheckoutPage',
  data () {
    return {
      items: [],
      products: [],
      loading: true,
      error: '',
      queued: 0,
      queueError: '',
      executions: {}
    }
  },
  computed: {
    username () {
      return this.$hiveStore.user.username || ''
    },
    signedIn () {
      return Boolean(this.username)
    },
    executionOptions () {
      return Array.from({ length: MAX_SUBSCRIPTION_EXECUTIONS }, (_, index) => index + 1)
    },
    checkout () {
      return validateCheckout(this.products, this.items, this.username)
    },
    lines () {
      return this.checkout.lines.map(line => {
        const executions = this.executions[line.key] || MAX_SUBSCRIPTION_EXECUTIONS
        return {
          ...line,
          executions,
          operation: buildPaymentOperation(line.product, line.quantity, this.username, { executions }),
          commitmentLabel: formatProductAmount(
            line.product.price * line.quantity * executions,
            line.product.ticker
          )
        }
      })
    },
    totals () {
      return totalsByTicker(this.lines)
    },
    problems () {
      return this.checkout.errors.filter(message =>
        this.signedIn || !/^Sign in/.test(message)
      )
    },
    canQueue () {
      return Boolean(this.signedIn && this.checkout.ok && this.lines.length && !this.queued)
    },
    queueLabel () {
      if (this.queued) return 'Payments queued'
      const count = this.lines.length
      return count === 1 ? 'Queue 1 payment' : 'Queue ' + count + ' payments'
    },
    disabledReason () {
      if (this.queued) return 'Payments are already queued for signing.'
      if (!this.signedIn) return 'Sign in from the top bar to queue payments.'
      if (!this.checkout.ok) return 'Resolve the issues above before queueing.'
      if (!this.lines.length) return 'There are no payable items.'
      return ''
    }
  },
  created () {
    this.load()
    this.updateMeta()
  },
  methods: {
    async load () {
      this.loading = true
      this.error = ''
      this.queueError = ''
      this.queued = 0

      const items = parseCheckoutItems(this.$route.query.items)
      this.items = items
      this.products = []

      if (!items.length) {
        this.loading = false
        return
      }

      const executions = {}
      for (const item of items) executions[item.author + '/' + item.permlink] = MAX_SUBSCRIPTION_EXECUTIONS
      this.executions = executions

      try {
        const results = await Promise.allSettled(items.map(item =>
          fetchPostContent(item.author, item.permlink, { force: true })
        ))
        const products = []
        for (const result of results) {
          if (result.status !== 'fulfilled') continue
          const product = normalizeProduct(result.value) ||
            parseProductMetadata(result.value)
          if (product) products.push(product)
        }
        this.products = products
        if (products.length === 0) {
          this.error = 'None of the products in this checkout could be loaded from Hive.'
        }
      } catch (error) {
        this.error = error && error.message ? error.message : 'The checkout could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    setExecutions (line, value) {
      const number = Math.floor(Number(value))
      const clamped = Number.isFinite(number)
        ? Math.min(MAX_SUBSCRIPTION_EXECUTIONS, Math.max(1, number))
        : MAX_SUBSCRIPTION_EXECUTIONS
      this.executions = { ...this.executions, [line.key]: clamped }
    },
    operationJson (line) {
      return line.operation ? JSON.stringify(line.operation, null, 2) : ''
    },
    queuePayments () {
      if (!this.canQueue) return
      const user = this.username
      const lines = this.lines
      const operations = lines.map(line =>
        buildPaymentOperation(line.product, line.quantity, user, { executions: line.executions })
      )
      if (operations.some(operation => !operation)) {
        this.queueError = 'One product could not be prepared for payment. Reload and try again.'
        return
      }

      try {
        for (const operation of operations) {
          this.$hiveStore.addToQueue([user, 'active', operation])
        }
        recordPurchases(lines.map(line => line.product))
        this.queueError = ''
        this.queued = operations.length
      } catch (error) {
        this.queueError = error && error.message
          ? error.message
          : 'The payments could not be queued.'
      }
    },
    updateMeta () {
      setPageMeta({
        title: 'Checkout — banksia.io',
        description: 'Review Hive Open Market products and queue direct Hive payments.',
        url: '/checkout',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
