<template>
  <q-page class="orders-page">
    <div class="orders-shell">
      <header class="orders-head">
        <p class="orders-kicker">Hive Open Market</p>
        <h1 class="orders-title">Orders</h1>
        <p class="orders-note">
          Purchases, sales and subscriptions are read from your public Hive
          account history and active recurring transfers. Nothing is stored on a
          server, and nothing here broadcasts a transaction.
        </p>
      </header>

      <div v-if="!signedIn" class="orders-state">
        <q-icon name="login" size="28px" class="orders-state__icon" />
        <h2>Sign in to see your orders</h2>
        <p>
          Use the sign-in button in the top bar. This page then reloads your
          purchases, sales and subscriptions from the Hive blockchain.
        </p>
        <q-btn outline no-caps color="primary" label="Browse products" to="/blogs" />
      </div>

      <template v-else>
        <div class="orders-toolbar">
          <q-tabs
            v-model="tab"
            dense
            no-caps
            inline-label
            align="left"
            active-color="primary"
            indicator-color="primary"
            class="orders-tabs"
            aria-label="Order sections"
          >
            <q-tab id="orders-tab-purchases" name="purchases" aria-controls="orders-panel-purchases">
              Purchases
              <q-badge v-if="purchases.length" color="primary" class="orders-tab__count">{{ purchases.length }}</q-badge>
            </q-tab>
            <q-tab id="orders-tab-sales" name="sales" aria-controls="orders-panel-sales">
              Sales
              <q-badge v-if="sales.length" color="primary" class="orders-tab__count">{{ sales.length }}</q-badge>
            </q-tab>
            <q-tab id="orders-tab-subscriptions" name="subscriptions" aria-controls="orders-panel-subscriptions">
              Subscriptions
              <q-badge v-if="subscriptions.length" color="primary" class="orders-tab__count">{{ subscriptions.length }}</q-badge>
            </q-tab>
          </q-tabs>

          <q-btn
            flat
            dense
            no-caps
            icon="refresh"
            label="Refresh"
            class="orders-refresh"
            :loading="refreshing"
            :disable="loading"
            @click="load({ force: true })"
          />
        </div>

        <div v-if="loading" class="orders-list" aria-busy="true" aria-label="Loading orders">
          <q-card v-for="n in 4" :key="n" flat bordered class="orders-skeleton">
            <q-skeleton type="rect" height="20px" width="55%" />
            <q-skeleton type="rect" height="12px" width="80%" class="q-mt-md" />
            <q-skeleton type="rect" height="12px" width="35%" class="q-mt-sm" />
          </q-card>
        </div>

        <div v-else-if="error" class="orders-state" role="alert">
          <h2>Orders unavailable</h2>
          <p>{{ error }}</p>
          <q-btn outline no-caps color="primary" label="Try again" @click="load({ force: true })" />
        </div>

        <template v-else>
          <section
            v-if="tab === 'purchases'"
            id="orders-panel-purchases"
            role="tabpanel"
            aria-labelledby="orders-tab-purchases"
            tabindex="0"
            class="orders-panel"
          >
            <div v-if="!purchases.length" class="orders-state orders-state--compact">
              <h2>No purchases yet</h2>
              <p>
                A purchase appears after a transfer or recurring transfer whose
                memo contains a Hive Open Market product reference.
              </p>
              <q-btn flat no-caps color="primary" label="Browse products" to="/blogs" />
            </div>

            <ul v-else class="orders-list">
              <li v-for="order in purchases" :key="order.id" class="orders-item">
                <div class="orders-item__main">
                  <h2 class="orders-item__title">
                    <a :href="productUrl(order)" target="_blank" rel="noopener noreferrer">{{ productTitle(order) }}</a>
                  </h2>
                  <p class="orders-item__meta">
                    <span>
                      Bought from
                      <a :href="accountUrl(order.counterparty)" target="_blank" rel="noopener noreferrer">@{{ order.counterparty }}</a>
                    </span>
                    <span aria-hidden="true">·</span>
                    <time v-if="order.timestamp" :datetime="order.timestamp">{{ formatDate(order.timestamp) }}</time>
                    <template v-if="order.recurring">
                      <span aria-hidden="true">·</span>
                      <span>Recurring payment</span>
                    </template>
                    <span aria-hidden="true">·</span>
                    <span>Quantity {{ order.quantity }}</span>
                  </p>
                  <p v-if="productTitle(order) !== productRef(order)" class="orders-item__ref">{{ productRef(order) }}</p>
                </div>
                <div class="orders-item__amount">
                  <strong>{{ order.amount }}</strong>
                </div>
              </li>
            </ul>
          </section>

          <section
            v-if="tab === 'sales'"
            id="orders-panel-sales"
            role="tabpanel"
            aria-labelledby="orders-tab-sales"
            tabindex="0"
            class="orders-panel"
          >
            <div v-if="!sales.length" class="orders-state orders-state--compact">
              <h2>No sales yet</h2>
              <p>
                A sale appears after someone sends you a transfer whose memo
                contains one of your Hive Open Market product references.
              </p>
              <q-btn flat no-caps color="primary" label="Read shop settings" to="/settings/blog" />
            </div>

            <ul v-else class="orders-list">
              <li v-for="order in sales" :key="order.id" class="orders-item">
                <div class="orders-item__main">
                  <h2 class="orders-item__title">
                    <a :href="productUrl(order)" target="_blank" rel="noopener noreferrer">{{ productTitle(order) }}</a>
                  </h2>
                  <p class="orders-item__meta">
                    <span>
                      Sold to
                      <a :href="accountUrl(order.counterparty)" target="_blank" rel="noopener noreferrer">@{{ order.counterparty }}</a>
                    </span>
                    <span aria-hidden="true">·</span>
                    <time v-if="order.timestamp" :datetime="order.timestamp">{{ formatDate(order.timestamp) }}</time>
                    <template v-if="order.recurring">
                      <span aria-hidden="true">·</span>
                      <span>Recurring payment</span>
                    </template>
                    <span aria-hidden="true">·</span>
                    <span>Quantity {{ order.quantity }}</span>
                  </p>
                  <p v-if="productTitle(order) !== productRef(order)" class="orders-item__ref">{{ productRef(order) }}</p>
                </div>
                <div class="orders-item__amount">
                  <strong>{{ order.amount }}</strong>
                </div>
              </li>
            </ul>
          </section>

          <section
            v-if="tab === 'subscriptions'"
            id="orders-panel-subscriptions"
            role="tabpanel"
            aria-labelledby="orders-tab-subscriptions"
            tabindex="0"
            class="orders-panel"
          >
            <q-banner v-if="queuedNotice" rounded class="orders-banner orders-banner--ok" role="status">
              <template #avatar><q-icon name="check_circle" /></template>
              {{ queuedNotice }}
            </q-banner>

            <q-banner v-if="cancelError" rounded class="orders-banner" role="alert">
              <template #avatar><q-icon name="warning" /></template>
              {{ cancelError }}
            </q-banner>

            <q-banner v-if="subscriptionsError" rounded class="orders-banner" role="status">
              <template #avatar><q-icon name="warning" /></template>
              {{ subscriptionsError }}
            </q-banner>

            <div v-if="!subscriptionsError && !subscriptions.length" class="orders-state orders-state--compact">
              <h2>No active subscriptions</h2>
              <p>
                Subscriptions appear when you have an active recurring transfer
                to a Hive Open Market product. Cancelling one queues a wallet
                action; this page never signs or broadcasts it.
              </p>
              <q-btn flat no-caps color="primary" label="Browse products" to="/blogs" />
            </div>

            <ul v-else-if="subscriptions.length" class="orders-list">
              <li v-for="subscription in subscriptions" :key="subscription.id" class="orders-item">
                <div class="orders-item__main">
                  <h2 class="orders-item__title">
                    <a :href="productUrl(subscription.product)" target="_blank" rel="noopener noreferrer">{{ productTitle(subscription.product) }}</a>
                  </h2>
                  <p class="orders-item__meta">
                    <span>
                      Paying
                      <a :href="accountUrl(subscription.to)" target="_blank" rel="noopener noreferrer">@{{ subscription.to }}</a>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Every {{ formatRecurrenceLabel(subscription.recurrenceHours) }}</span>
                  </p>
                  <p v-if="productTitle(subscription.product) !== productRef(subscription.product)" class="orders-item__ref">{{ productRef(subscription.product) }}</p>

                  <dl class="orders-facts">
                    <div>
                      <dt>Amount</dt>
                      <dd>{{ subscription.amount }}</dd>
                    </div>
                    <div>
                      <dt>Remaining payments</dt>
                      <dd>{{ remainingLabel(subscription) }}</dd>
                    </div>
                    <div>
                      <dt>Next payment</dt>
                      <dd>
                        <time v-if="subscription.nextExecution" :datetime="subscription.nextExecution">{{ formatDate(subscription.nextExecution) }}</time>
                        <span v-else>Unknown</span>
                      </dd>
                    </div>
                  </dl>

                  <div class="orders-cancel">
                    <q-btn
                      outline
                      no-caps
                      color="negative"
                      :label="isCancelQueued(subscription) ? 'Cancellation queued' : 'Cancel subscription'"
                      :disable="!canCancel(subscription) || isCancelQueued(subscription)"
                      :aria-label="'Queue cancellation of the subscription to @' + subscription.to"
                      @click="cancelSubscription(subscription)"
                    />
                    <p class="orders-cancel__warning">
                      <q-icon name="warning" size="16px" aria-hidden="true" />
                      <span>
                        Direct Hive transfer: no escrow and no buyer protection.
                        Cancelling queues a zero-amount recurrent_transfer for
                        wallet review; nothing is broadcast from this page.
                      </span>
                    </p>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.orders-page {
  background: var(--c-bg);
}

.orders-shell {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.orders-head {
  max-width: 720px;
}

.orders-kicker {
  margin: 0 0 0.35rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.orders-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  line-height: 1.1;
}

.orders-note {
  margin: 0.6rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.88rem;
  line-height: 1.65;
}

.orders-state {
  padding: 2rem 1.25rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
  text-align: center;
}

.orders-state__icon {
  color: var(--c-text-muted);
}

.orders-state h2 {
  margin: 0.6rem 0 0;
  font-size: 1.1rem;
}

.orders-state p {
  max-width: 46ch;
  margin: 0.45rem auto 1rem;
  color: var(--c-text-muted);
  line-height: 1.6;
}

.orders-state--compact {
  padding: 1.4rem 1rem;
  text-align: left;
}

.orders-state--compact p {
  margin-left: 0;
  margin-right: 0;
}

.orders-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0 0.25rem;
  border-bottom: 1px solid var(--c-border-subtle);
}

.orders-tabs {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--c-text-muted);
}

.orders-tab__count {
  margin-left: 0.35rem;
}

.orders-refresh {
  flex: none;
  margin-left: auto;
  color: var(--c-text-muted);
}

.orders-panel:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 3px;
  border-radius: 8px;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.orders-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.orders-item__main {
  flex: 1;
  min-width: 0;
}

.orders-item__title {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.orders-item__title a {
  color: var(--c-text);
  text-decoration: none;
}

.orders-item__title a:hover {
  color: var(--c-link);
}

.orders-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.45rem;
  margin: 0.35rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.orders-item__meta a {
  color: var(--c-link);
}

.orders-item__ref {
  margin: 0.3rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}

.orders-item__amount {
  flex: none;
  text-align: right;
}

.orders-item__amount strong {
  display: block;
  color: var(--c-text);
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.orders-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem 1rem;
  margin: 0.7rem 0 0;
  padding: 0.6rem 0;
  border-top: 1px solid var(--c-border-subtle);
}

.orders-facts dt {
  color: var(--c-text-muted);
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.orders-facts dd {
  margin: 0.1rem 0 0;
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}

.orders-cancel {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem 0.9rem;
  margin-top: 0.7rem;
}

.orders-cancel__warning {
  display: flex;
  gap: 0.35rem;
  max-width: 52ch;
  margin: 0;
  color: var(--c-warning);
  font-size: 0.76rem;
  line-height: 1.5;
}

.orders-cancel__warning .q-icon {
  flex: none;
  margin-top: 0.1rem;
}

.orders-banner {
  margin: 0.9rem 0;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  color: var(--c-text);
  font-size: 0.84rem;
  line-height: 1.55;
}

.orders-banner--ok {
  border-color: var(--c-positive);
}

.orders-skeleton {
  padding: 0.9rem 1rem;
  border-color: var(--c-border);
  background: var(--c-surface);
}

@media (max-width: 599px) {
  .orders-shell {
    padding: 1.25rem 0.75rem 3rem;
  }

  .orders-item {
    flex-direction: column;
    gap: 0.4rem;
  }

  .orders-item__amount {
    text-align: left;
  }

  .orders-refresh {
    margin-left: 0;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { BLOG_APEX_URL } from 'src/config/blog'
import { fetchAccountHistory, fetchPostContent } from 'src/services/chainData'
import { normalizeProduct } from 'src/services/hiveMarket'
import {
  buildCancelOperation,
  collectOrders,
  formatOrderDate,
  formatRecurrence,
  productKey,
  productRefLabel,
  subscriptionFromRecurrent
} from 'src/services/shopOrders'

const HISTORY_LIMIT = 1000
const HISTORY_PAGES = 3
const TITLE_LOOKUPS = 40
const TITLE_CONCURRENCY = 4

export default {
  name: 'OrdersPage',
  data () {
    return {
      tab: 'purchases',
      loading: true,
      refreshing: false,
      loadedOnce: false,
      error: '',
      subscriptionsError: '',
      purchases: [],
      sales: [],
      subscriptions: [],
      productInfo: {},
      queuedSubscriptions: {},
      queuedNotice: '',
      cancelError: ''
    }
  },
  computed: {
    username () {
      return this.$hiveStore.user.username || ''
    },
    signedIn () {
      return Boolean(this.username)
    }
  },
  watch: {
    username (value) {
      if (value) this.load()
      else this.reset()
    }
  },
  created () {
    this.updateMeta()
    if (this.signedIn) this.load()
    else this.loading = false
  },
  methods: {
    async load ({ force = false } = {}) {
      if (!this.signedIn) {
        this.reset()
        return
      }
      const first = !this.loadedOnce
      if (first) this.loading = true
      else this.refreshing = true
      this.error = ''
      this.subscriptionsError = ''
      this.queuedNotice = ''
      this.cancelError = ''

      const [history, subscriptions] = await Promise.allSettled([
        this.fetchHistory(force),
        this.fetchSubscriptions()
      ])

      if (history.status === 'fulfilled') {
        const collected = collectOrders(history.value, this.username)
        this.purchases = collected.purchases
        this.sales = collected.sales
      } else {
        this.error = this.errorMessage(history.reason)
      }

      if (subscriptions.status === 'fulfilled') {
        this.subscriptions = subscriptions.value
      } else {
        this.subscriptions = []
        this.subscriptionsError = 'Recurring transfers could not be read from this node. Purchases and sales are still available.'
      }

      this.loading = false
      this.refreshing = false
      this.loadedOnce = true
      this.resolveTitles()
    },
    async fetchHistory (force) {
      const rows = []
      const seen = new Set()
      let from = -1
      for (let page = 0; page < HISTORY_PAGES; page += 1) {
        const batch = await fetchAccountHistory(this.username, {
          from,
          limit: HISTORY_LIMIT,
          force
        })
        if (!Array.isArray(batch) || batch.length === 0) break

        let added = 0
        for (const row of batch) {
          const index = Array.isArray(row) ? row[0] : null
          if (index === null || index === undefined || seen.has(index)) continue
          seen.add(index)
          rows.push(row)
          added += 1
        }

        if (batch.length < HISTORY_LIMIT || added === 0) break
        const oldest = Number(Array.isArray(batch[0]) ? batch[0][0] : NaN)
        if (!Number.isInteger(oldest) || oldest <= 0) break
        from = oldest - 1
      }
      return rows
    },
    async fetchSubscriptions () {
      const api = this.$hive && this.$hive.api
      if (!api || typeof api.callAsync !== 'function') {
        throw new Error('Hive API is unavailable')
      }
      const result = await api.callAsync('condenser_api.find_recurrent_transfers', [this.username])
      const rows = Array.isArray(result)
        ? result
        : (result && Array.isArray(result.transfers) ? result.transfers : [])
      const account = this.username.toLowerCase()
      return rows
        .map(subscriptionFromRecurrent)
        .filter(subscription => subscription && subscription.from === account)
    },
    reset () {
      this.loading = false
      this.refreshing = false
      this.loadedOnce = false
      this.error = ''
      this.subscriptionsError = ''
      this.purchases = []
      this.sales = []
      this.subscriptions = []
      this.productInfo = {}
      this.queuedSubscriptions = {}
      this.queuedNotice = ''
      this.cancelError = ''
      this.tab = 'purchases'
    },
    productRefs () {
      const refs = new Map()
      const add = value => {
        const key = productKey(value)
        if (!key) return
        refs.set(key, { author: value.author, permlink: value.permlink })
      }
      for (const order of this.purchases) add(order)
      for (const order of this.sales) add(order)
      for (const subscription of this.subscriptions) add(subscription.product)
      return [...refs.values()]
    },
    async resolveTitles () {
      const missing = []
      for (const ref of this.productRefs()) {
        const key = productKey(ref)
        if (!key || this.productInfo[key] !== undefined) continue
        if (missing.length >= TITLE_LOOKUPS) break
        missing.push({ key, ref })
      }
      if (!missing.length) return

      let cursor = 0
      const worker = async () => {
        while (cursor < missing.length) {
          const task = missing[cursor]
          cursor += 1
          let title = ''
          try {
            const product = normalizeProduct(await fetchPostContent(task.ref.author, task.ref.permlink))
            if (product) title = product.title
          } catch {
            title = ''
          }
          this.productInfo[task.key] = { title }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(TITLE_CONCURRENCY, missing.length) }, () => worker())
      )
    },
    productTitle (value) {
      const key = productKey(value)
      if (!key) return 'Product'
      const info = this.productInfo[key]
      return (info && info.title) || productRefLabel(value) || 'Product'
    },
    productRef (value) {
      return productRefLabel(value)
    },
    productUrl (value) {
      const label = productRefLabel(value)
      return label ? BLOG_APEX_URL + '/@' + label : BLOG_APEX_URL
    },
    accountUrl (name) {
      return BLOG_APEX_URL + '/@' + String(name || '').toLowerCase()
    },
    formatDate (value) {
      return formatOrderDate(value)
    },
    formatRecurrenceLabel (hours) {
      return formatRecurrence(hours) || 'unknown interval'
    },
    remainingLabel (subscription) {
      if (subscription.remainingExecutions === null) return 'Unknown'
      const count = subscription.remainingExecutions
      return count === 1 ? '1 payment' : count + ' payments'
    },
    canCancel (subscription) {
      return Boolean(buildCancelOperation(subscription, this.username))
    },
    isCancelQueued (subscription) {
      return Boolean(this.queuedSubscriptions[subscription.id])
    },
    cancelSubscription (subscription) {
      const operation = buildCancelOperation(subscription, this.username)
      if (!operation) {
        this.cancelError = 'This subscription cannot be cancelled from the signed-in account.'
        return
      }
      this.$hiveStore.addToQueue([this.username, 'active', operation])
      this.queuedSubscriptions = {
        ...this.queuedSubscriptions,
        [subscription.id]: true
      }
      this.cancelError = ''
      this.queuedNotice = 'Cancellation queued for wallet review. Open the signing queue in the top bar to review and sign — nothing has been broadcast from this page.'
    },
    errorMessage (error) {
      const message = error && error.message ? String(error.message) : ''
      return message || 'Your account history could not be loaded from this Hive node.'
    },
    updateMeta () {
      setPageMeta({
        title: 'Orders — banksia.io',
        description: 'Hive Open Market purchases, sales and subscriptions from public account history.',
        url: '/orders',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
