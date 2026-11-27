<template>
  <q-page class="orders-page">
    <div class="orders-shell">
      <h1 class="orders-title">Orders</h1>
      <p class="orders-note">
        Purchases and sales are read from your public Hive account history.
        Nothing is stored on a server.
      </p>
      <q-btn outline no-caps color="primary" label="Browse products" to="/blogs" />
    </div>
  </q-page>
</template>

<style scoped>
.orders-page {
  background: var(--c-bg);
}

.orders-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.orders-title {
  margin: 0 0 0.5rem;
}

.orders-note {
  color: var(--c-text-muted);
  line-height: 1.6;
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'OrdersPage',
  created () {
    setPageMeta({
      title: 'Orders — banksia.io',
      description: 'Hive Open Market purchases and sales from public account history.',
      url: '/orders',
      type: 'website',
      noindex: true
    })
  }
}
</script>
