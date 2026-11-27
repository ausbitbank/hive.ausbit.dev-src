<template>
  <q-page class="pay-page">
    <div class="pay-shell">
      <nav class="pay-crumb" aria-label="Breadcrumb">
        <router-link to="/">Banksia</router-link>
        <span aria-hidden="true">/</span>
        <span>Pay</span>
      </nav>

      <q-card v-if="loading" flat bordered class="pay-card">
        <q-card-section>
          <q-skeleton type="rect" height="24px" width="45%" />
          <q-skeleton type="rect" height="14px" class="q-mt-md" />
          <q-skeleton type="rect" height="14px" width="60%" class="q-mt-sm" />
        </q-card-section>
      </q-card>

      <q-card v-else-if="error" flat bordered class="pay-card">
        <q-card-section>
          <h1 class="pay-title">Payment unavailable</h1>
          <p class="pay-muted">{{ error }}</p>
          <q-btn outline no-caps color="primary" label="Back to blogs" to="/blogs" />
        </q-card-section>
      </q-card>

      <q-card v-else-if="product" flat bordered class="pay-card">
        <q-card-section class="pay-product">
          <img v-if="product.image" :src="product.image" alt="" class="pay-image" />
          <div class="pay-copy">
            <p class="pay-kicker">Hive Open Market</p>
            <h1 class="pay-title">{{ product.title }}</h1>
            <p class="pay-muted">
              Sold by <router-link :to="'/@' + product.author">@{{ product.author }}</router-link>
            </p>
            <p class="pay-price">{{ product.priceLabel }}</p>
            <p class="pay-status" :class="'pay-status--' + product.status">{{ product.statusLabel }}</p>
            <p v-if="product.subscription" class="pay-muted">
              Recurring every {{ product.recurrenceHours }} hours; this queues 12 payments.
            </p>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div v-if="!product.subscription" class="pay-quantity">
            <q-input
              v-model.number="quantity"
              type="number"
              min="1"
              max="99"
              outlined
              dense
              label="Quantity"
              class="pay-quantity__input"
            />
          </div>

          <div v-if="!membership" class="pay-total">
            <span>Total per payment</span>
            <strong>{{ totalLabel }}</strong>
          </div>

          <q-banner rounded class="pay-banner">
            <template #avatar><q-icon name="warning" /></template>
            This is a direct Hive transfer to the seller. There is no escrow or
            buyer protection. Review the amount and memo in your wallet before
            signing.
          </q-banner>

          <q-banner v-if="membership" rounded class="pay-banner">
            <template #avatar><q-icon name="lock" /></template>
            This is a Banksia Vault membership. Subscribe on the membership page
            so your reader key is attached to the payment memo; a plain transfer
            cannot unlock the content.
          </q-banner>

          <q-banner v-if="!loggedInUser" rounded class="pay-banner">
            <template #avatar><q-icon name="login" /></template>
            Sign in from the top bar to pay.
          </q-banner>

          <q-banner v-if="!canPurchase && !membership" rounded class="pay-banner pay-banner--warning">
            <template #avatar><q-icon name="block" /></template>
            {{ unavailableReason }}
          </q-banner>

          <q-banner v-if="queued" rounded class="pay-banner pay-banner--ok">
            <template #avatar><q-icon name="check_circle" /></template>
            Payment queued. Open the signing queue in the top bar to review and sign.
          </q-banner>

          <div class="pay-actions">
            <q-btn
              v-if="membership"
              unelevated
              no-caps
              color="primary"
              label="Open membership page"
              :to="membershipPath"
            />
            <q-btn
              v-else
              unelevated
              no-caps
              color="primary"
              :label="product.subscription ? 'Queue subscription' : 'Queue payment'"
              :disable="!canPurchase || queued"
              @click="pay"
            />
            <q-btn flat no-caps label="Read product post" :href="postUrl" />
          </div>

          <p v-if="!membership" class="pay-memo">
            <strong>Memo</strong>
            <code>{{ memo }}</code>
          </p>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped>
.pay-page {
  background: var(--c-bg);
}

.pay-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.pay-crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.pay-crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.pay-card {
  background: var(--c-surface);
  border-color: var(--c-border);
}

.pay-product {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.pay-image {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  flex: none;
}

.pay-copy {
  min-width: 0;
}

.pay-kicker {
  margin: 0 0 0.3rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pay-title {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  line-height: 1.2;
}

.pay-muted {
  margin: 0.35rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
}

.pay-muted a {
  color: var(--c-link);
}

.pay-price {
  margin: 0.6rem 0 0;
  color: var(--c-text);
  font-size: 1.15rem;
  font-weight: 700;
}

.pay-status {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
}

.pay-status--1 { color: var(--c-positive); }
.pay-status--2 { color: var(--c-text-muted); }
.pay-status--3 { color: var(--c-warning); }

.pay-quantity {
  margin-bottom: 0.9rem;
}

.pay-quantity__input {
  max-width: 10rem;
}

.pay-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--c-border-subtle);
  border-bottom: 1px solid var(--c-border-subtle);
  color: var(--c-text-muted);
  font-size: 0.88rem;
}

.pay-total strong {
  color: var(--c-text);
  font-size: 1.1rem;
}

.pay-banner {
  margin-top: 0.9rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.pay-banner--warning {
  border-color: var(--c-warning);
}

.pay-banner--ok {
  border-color: var(--c-positive);
}

.pay-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.pay-memo {
  margin: 1rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.pay-memo code {
  margin-left: 0.35rem;
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
}

@media (max-width: 599px) {
  .pay-product {
    flex-direction: column;
  }

  .pay-image {
    width: 100%;
    height: 180px;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchPostContent } from 'src/services/chainData'
import { blogBaseUrl, isValidHiveAccountName } from 'src/services/blogHost'
import {
  isPurchasable,
  isSupportedProduct,
  parseProductMetadata
} from 'src/services/blogShop'
import { buildPaymentOperation } from 'src/services/shopCart'
import { membershipFromProduct, membershipSubscribeUrl } from 'src/services/shopMembership'

export default {
  name: 'PayPage',
  data () {
    return {
      product: null,
      loading: true,
      error: '',
      quantity: 1,
      queued: false
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    totalLabel () {
      return this.operation ? this.operation[1].amount : ''
    },
    memo () {
      return this.operation ? this.operation[1].memo : ''
    },
    operation () {
      if (!this.product || this.membership) return null
      return buildPaymentOperation(this.product, this.quantity, this.loggedInUser, { executions: 12 })
    },
    membership () {
      return membershipFromProduct(this.product)
    },
    membershipPath () {
      return membershipSubscribeUrl(this.product)
    },
    canPurchase () {
      return Boolean(
        !this.membership &&
        this.loggedInUser &&
        this.product &&
        isPurchasable(this.product) &&
        Number(this.quantity) >= 1 &&
        Number(this.quantity) <= 99
      )
    },
    unavailableReason () {
      if (!this.product) return ''
      if (this.membership) return 'This is a Banksia Vault membership. Use the membership page to subscribe with your reader key.'
      if (!isSupportedProduct(this.product)) return 'This product uses a currency Banksia does not support yet.'
      if (this.product.status !== 1) return 'This product is ' + this.product.statusLabel.toLowerCase() + '.'
      if (Number(this.quantity) < 1 || Number(this.quantity) > 99) return 'Quantity must be between 1 and 99.'
      return ''
    },
    postUrl () {
      if (!this.product) return ''
      return blogBaseUrl(this.product.author) + '/@' + this.product.author + '/' + this.product.permlink
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
      const reference = String(this.$route.query.product || '')
      const [author, permlink] = reference.split('/')
      if (!isValidHiveAccountName(author) || !/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(permlink || '')) {
        this.error = 'The product reference is missing or invalid.'
        this.loading = false
        return
      }
      const quantity = Number(this.$route.query.quantity)
      this.quantity = Number.isFinite(quantity) && quantity >= 1 && quantity <= 99 ? Math.floor(quantity) : 1

      try {
        const post = await fetchPostContent(author, permlink)
        const product = parseProductMetadata(post)
        if (!product) {
          this.error = 'That post is not a Hive Open Market product.'
          return
        }
        this.product = product
        if (product.subscription) this.quantity = 1
      } catch (error) {
        this.error = error && error.message ? error.message : 'The product could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    pay () {
      if (!this.canPurchase || this.membership) return
      const user = this.loggedInUser
      const operation = buildPaymentOperation(this.product, this.quantity, user, { executions: 12 })
      if (!operation) return
      this.$hiveStore.addToQueue([user, 'active', operation])
      this.queued = true
    },
    updateMeta () {
      setPageMeta({
        title: 'Pay for a Hive product — banksia.io',
        description: 'Review a Hive Open Market product and queue a direct Hive payment.',
        url: '/pay',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
