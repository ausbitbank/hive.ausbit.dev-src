<template>
  <main class="not-found-page">
    <div class="not-found-card">
      <div class="not-found-eyebrow">404 · Off the chain</div>
      <h1 class="not-found-title">That page is not here</h1>
      <p class="not-found-intro">
        The link may be wrong, or the account, post, block or transaction may not exist.
        Try a direct search, or jump back into the explorer.
      </p>

      <form class="not-found-search" @submit.prevent="search">
        <q-input
          v-model="query"
          dense
          outlined
          dark
          label="Search accounts, posts, tags, blocks or transactions"
          aria-label="Search for a Hive page"
          class="not-found-search__input"
        />
        <q-btn type="submit" no-caps unelevated color="primary" text-color="black" icon="search" label="Search" />
      </form>
      <p v-if="searchHint" class="not-found-hint" role="status">{{ searchHint }}</p>
      <p class="not-found-examples">
        Try <code>@ausbitbank</code>, <code>#hive</code>, <code>111744678</code>,
        <code>tx &lt;transaction-id&gt;</code> or <code>proposal 392</code>.
      </p>

      <nav class="not-found-links" aria-label="Explorer quick links">
        <router-link to="/">Home</router-link>
        <router-link to="/created">Browse posts</router-link>
        <router-link to="/blocks">Blocks</router-link>
        <router-link to="/witnesses">Witnesses</router-link>
        <router-link to="/proposals">Proposals</router-link>
        <router-link to="/markets">Markets</router-link>
        <router-link to="/health">Network health</router-link>
      </nav>
    </div>
  </main>
</template>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { parseSearchRoute } from 'src/services/search'

export default {
  name: 'Error404',
  data () {
    return {
      query: '',
      searchHint: ''
    }
  },
  mounted () {
    setPageMeta({
      title: 'Page not found (404) — hive.ausbit.dev',
      description: 'The requested page could not be found. Search accounts, posts, tags, blocks and transactions on hive.ausbit.dev.',
      noindex: true
    })
  },
  methods: {
    search () {
      const result = parseSearchRoute(this.query)
      if (result) {
        this.searchHint = ''
        this.$router.push(result.path).catch(() => {})
        return
      }
      this.searchHint = 'No direct route match. Try @account, #tag, a block number or a supported Hive URL.'
    }
  }
}
</script>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-5) var(--space-4);
  background: #0d1114;
}

.not-found-card {
  width: 100%;
  max-width: 620px;
  padding: var(--space-6);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.025);
  text-align: center;
}

.not-found-eyebrow {
  color: #78909c;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.not-found-title {
  margin: 0.3rem 0 0.45rem;
  font-size: clamp(1.6rem, 4vw, 2.15rem);
  font-weight: 600;
  line-height: 1.15;
}

.not-found-intro {
  margin: 0 auto 1rem;
  max-width: 52ch;
  color: #90a4ae;
  font-size: 0.88rem;
  line-height: 1.55;
}

.not-found-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.not-found-search__input {
  flex: 1;
  min-width: 0;
}

.not-found-hint {
  margin: 0.45rem 0 0;
  color: #ffb74d;
  font-size: 0.74rem;
}

.not-found-examples {
  margin: 0.5rem 0 0;
  color: #78909c;
  font-size: 0.72rem;
  line-height: 1.5;
}

.not-found-examples code {
  color: #b0bec5;
}

.not-found-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem 1rem;
  flex-wrap: wrap;
  margin-top: 1.1rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.not-found-links a {
  color: #4fc3f7;
  text-decoration: none;
}

.not-found-links a:hover {
  text-decoration: underline;
}

@media (max-width: 599px) {
  .not-found-card {
    padding: var(--space-4);
  }

  .not-found-search {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
