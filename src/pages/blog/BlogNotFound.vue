<template>
  <div class="blog-not-found">
    <p class="blog-not-found__code">404</p>
    <h1 class="blog-not-found__title">Page not found</h1>
    <p class="blog-not-found__text">
      That address is not part of @{{ accountName }}'s blog.
    </p>
    <router-link to="/" class="blog-not-found__link">Back to the blog</router-link>
  </div>
</template>

<style scoped>
.blog-not-found {
  max-width: 560px;
  margin: 3rem auto;
  text-align: center;
}

.blog-not-found__code {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.3em;
  color: var(--c-text-faint);
}

.blog-not-found__title {
  margin: 0.5rem 0 0.75rem;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.4rem);
}

.blog-not-found__text {
  margin: 0;
  color: var(--c-text-muted);
}

.blog-not-found__link {
  display: inline-block;
  margin-top: 1.5rem;
  color: var(--c-link);
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { useBlogStore } from 'src/stores/blog'

export default {
  name: 'BlogNotFound',
  computed: {
    accountName () {
      return useBlogStore().accountName
    }
  },
  mounted () {
    if (typeof window === 'undefined') return
    setPageMeta({
      title: 'Page not found — ' + useBlogStore().title,
      description: 'The requested page could not be found.',
      url: window.location.pathname,
      baseUrl: window.location.origin,
      noindex: true
    })
  }
}
</script>
