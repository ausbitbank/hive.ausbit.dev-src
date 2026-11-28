<template>
  <div class="blog-page">
    <header class="blog-page__head">
      <p class="blog-page__kicker"><router-link to="/">← {{ blogTitle }}</router-link></p>
      <h1 class="blog-page__title">Contact</h1>
    </header>

    <p class="blog-page__lede">
      The most reliable way to reach <a :href="apexAccountUrl">@{{ accountName }}</a> is on Hive.
      Comments, replies and transfers are public and portable.
    </p>

    <section class="blog-page__section">
      <h2>On Hive</h2>
      <ul class="blog-page__links">
        <li><a :href="apexAccountUrl">Profile and posts on Banksia</a></li>
        <li><a :href="'https://peakd.com/@' + accountName" target="_blank" rel="noopener noreferrer">PeakD</a></li>
        <li><a :href="'https://ecency.com/@' + accountName" target="_blank" rel="noopener noreferrer">Ecency</a></li>
      </ul>
    </section>

    <section v-if="website || tipUrl" class="blog-page__section">
      <h2>Elsewhere</h2>
      <ul class="blog-page__links">
        <li v-if="website"><a :href="website" target="_blank" rel="noopener noreferrer">Website</a></li>
        <li v-if="tipUrl"><a :href="tipUrl">Tip with Lightning or Hive</a></li>
      </ul>
    </section>

    <p class="blog-page__note">
      This blog is a reading surface. Replies and votes happen on Hive, where the
      content and its discussion actually live.
    </p>
  </div>
</template>

<style scoped>
.blog-page {
  max-width: 760px;
  margin: 0 auto;
}

.blog-page__head {
  margin-bottom: 1.5rem;
}

.blog-page__kicker {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.blog-page__kicker a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.blog-page__kicker a:hover {
  color: var(--c-link);
}

.blog-page__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  line-height: 1.1;
}

.blog-page__lede {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--c-text-soft);
}

.blog-page__lede a {
  color: var(--c-link);
}

.blog-page__section {
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--c-border);
}

.blog-page__section h2 {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--c-text-muted);
}

.blog-page__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.95rem;
}

.blog-page__links a {
  color: var(--c-link);
}

.blog-page__note {
  margin-top: 2rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface-2);
  color: var(--c-text-muted);
  font-size: 0.88rem;
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { useBlogStore } from 'src/stores/blog'

export default {
  name: 'BlogContact',
  computed: {
    blog () {
      return useBlogStore()
    },
    blogTitle () {
      return this.blog.title
    },
    accountName () {
      return this.blog.accountName
    },
    website () {
      return this.blog.website
    },
    apexAccountUrl () {
      return this.blog.apexAccountUrl
    },
    tipUrl () {
      return this.accountName ? 'https://banksia.io/@' + this.accountName + '/tip' : ''
    }
  },
  mounted () {
    this.updateMeta()
  },
  watch: {
    blogTitle () { this.updateMeta() },
    'blog.claimed' () { this.updateMeta() },
    'blog.settings' () { this.updateMeta() }
  },
  methods: {
    updateMeta () {
      if (typeof window === 'undefined') return
      const origin = window.location.origin
      setPageMeta({
        title: 'Contact — ' + this.blogTitle,
        description: 'Contact @' + this.accountName + ' on Hive.',
        image: this.blog.ogImage || this.blog.avatar,
        url: '/contact',
        type: 'website',
        baseUrl: origin,
        siteName: this.blogTitle,
        noindex: !this.blog.claimed
      })
    }
  }
}
</script>
