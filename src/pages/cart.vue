<template>
  <q-page class="cart-page">
    <div class="cart-shell">
      <h1 class="cart-title">Cart</h1>
      <p class="cart-note">
        Cart items are stored on this device. Checkout re-reads every product
        from Hive before it queues a payment.
      </p>
      <q-btn outline no-caps color="primary" label="Continue shopping" to="/blogs" />
    </div>
  </q-page>
</template>

<style scoped>
.cart-page {
  background: var(--c-bg);
}

.cart-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.cart-title {
  margin: 0 0 0.5rem;
}

.cart-note {
  color: var(--c-text-muted);
  line-height: 1.6;
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'CartPage',
  created () {
    setPageMeta({
      title: 'Cart — banksia.io',
      description: 'Review Hive Open Market products before checkout.',
      url: '/cart',
      type: 'website',
      noindex: true
    })
  }
}
</script>
