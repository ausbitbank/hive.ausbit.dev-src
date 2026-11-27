<template>
  <div class="product-page">
    <p class="product-kicker"><router-link to="/shop">← {{ blog.shop.title || 'Shop' }}</router-link></p>
    <h1 class="product-title">Product</h1>
    <p class="product-note">This product page is loading its contract data.</p>
  </div>
</template>

<style scoped>
.product-page {
  max-width: 820px;
}

.product-kicker a {
  color: var(--c-text-muted);
  font-size: 0.82rem;
  text-decoration: none;
}

.product-title {
  font-family: var(--font-display);
}

.product-note {
  color: var(--c-text-muted);
}
</style>

<script>
import { useBlogStore } from 'src/stores/blog'

export default {
  name: 'BlogProduct',
  computed: {
    blog () {
      return useBlogStore()
    }
  }
}
</script>
