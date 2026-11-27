<template>
  <q-page class="checkout-page">
    <div class="checkout-shell">
      <h1 class="checkout-title">Checkout</h1>
      <q-banner rounded class="checkout-banner">
        <template #avatar><q-icon name="warning" /></template>
        This is a direct Hive transfer to each seller. There is no escrow or
        buyer protection.
      </q-banner>
      <p class="checkout-note">
        Checkout reviews every product from chain data and queues one payment
        per item for wallet approval.
      </p>
      <q-btn outline no-caps color="primary" label="Back to cart" to="/cart" />
    </div>
  </q-page>
</template>

<style scoped>
.checkout-page {
  background: var(--c-bg);
}

.checkout-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.checkout-title {
  margin: 0 0 0.75rem;
}

.checkout-banner {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-text);
}

.checkout-note {
  color: var(--c-text-muted);
  line-height: 1.6;
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'CheckoutPage',
  created () {
    setPageMeta({
      title: 'Checkout — banksia.io',
      description: 'Review Hive Open Market products and queue direct Hive payments.',
      url: '/checkout',
      type: 'website',
      noindex: true
    })
  }
}
</script>
