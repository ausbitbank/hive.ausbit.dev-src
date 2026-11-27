<template>
  <q-page class="directory-page">
    <div class="directory-shell">
      <header class="directory-head">
        <p class="directory-eyebrow">Opt-in directory</p>
        <h1 class="directory-title">Hive blogs on Banksia</h1>
        <p class="directory-lede">
          Community, project and personal blogs that chose to be listed here.
          Every one is a normal Hive account with a clean reading page at
          <code>username.banksia.io</code>.
        </p>
        <div class="directory-actions">
          <q-input
            v-model="query"
            outlined
            dense
            clearable
            label="Search blogs"
            placeholder="name, title or description"
            class="directory-search"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-btn unelevated no-caps color="primary" label="List your blog" to="/settings/blog" />
          <q-btn flat no-caps label="How it works" to="/blogs" />
        </div>
      </header>

      <div v-if="loading" class="directory-grid" aria-busy="true" aria-label="Loading directory">
        <div v-for="n in 4" :key="n" class="directory-skeleton">
          <div class="directory-skeleton__avatar"></div>
          <div class="directory-skeleton__line"></div>
          <div class="directory-skeleton__line directory-skeleton__line--short"></div>
        </div>
      </div>

      <div v-else-if="error" class="directory-state" role="alert">
        <h2>Directory unavailable</h2>
        <p>{{ error }}</p>
        <q-btn outline no-caps color="primary" label="Try again" @click="load" />
      </div>

      <div v-else-if="!blogs.length" class="directory-state">
        <h2>No blogs listed yet</h2>
        <p>
          The directory is opt-in. Claim your blog, turn on
          “List this blog in the public directory” in settings, and refresh the
          listing.
        </p>
        <div class="directory-state__actions">
          <q-btn unelevated no-caps color="primary" label="Claim your blog" to="/settings/blog" />
          <q-btn flat no-caps label="See how it works" to="/blogs" />
        </div>
      </div>

      <template v-else>
        <p class="directory-count">
          {{ filteredBlogs.length }} of {{ blogs.length }} {{ blogs.length === 1 ? 'blog' : 'blogs' }}
        </p>
        <div v-if="!filteredBlogs.length" class="directory-state">
          <h2>No match</h2>
          <p>No listed blog matches “{{ query }}”.</p>
          <q-btn flat no-caps label="Clear search" @click="query = ''" />
        </div>
        <div v-else class="directory-grid">
          <article v-for="blog in filteredBlogs" :key="blog.name" class="directory-card">
            <a :href="blog.url" target="_blank" rel="noopener noreferrer" class="directory-card__main">
              <img :src="blog.avatar" alt="" class="directory-card__avatar" width="56" height="56" loading="lazy" />
              <div class="directory-card__copy">
                <h2>{{ blog.title }}</h2>
                <p class="directory-card__handle">@{{ blog.name }}</p>
                <p v-if="blog.description" class="directory-card__description">{{ blog.description }}</p>
                <p class="directory-card__meta">
                  <span>{{ blog.themeLabel }}</span>
                  <template v-if="blog.pinned">
                    <span aria-hidden="true">·</span>
                    <span>{{ blog.pinned }} pinned</span>
                  </template>
                  <template v-if="blog.contributors">
                    <span aria-hidden="true">·</span>
                    <span>{{ blog.contributors }} contributors</span>
                  </template>
                </p>
              </div>
            </a>
            <a :href="blog.url" target="_blank" rel="noopener noreferrer" class="directory-card__open">
              Read blog <span aria-hidden="true">→</span>
            </a>
          </article>
        </div>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.directory-page {
  background: var(--c-bg);
}

.directory-shell {
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.5rem 1.1rem 4rem;
}

.directory-head {
  margin-bottom: 1.5rem;
}

.directory-eyebrow {
  margin: 0 0 0.5rem;
  color: var(--c-primary);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.directory-title {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  letter-spacing: -0.02em;
}

.directory-lede {
  margin: 0.65rem 0 0;
  max-width: 68ch;
  color: var(--c-text-muted);
  line-height: 1.6;
}

.directory-lede code {
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
}

.directory-actions {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.directory-search {
  flex: 1;
  min-width: 15rem;
}

.directory-count {
  margin: 0 0 0.75rem;
  color: var(--c-text-faint);
  font-size: 0.8rem;
}

.directory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.directory-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: var(--c-surface);
  overflow: hidden;
  transition: border-color 160ms ease, transform 160ms ease;
}

.directory-card:hover {
  border-color: var(--c-border-strong);
  transform: translateY(-1px);
}

.directory-card__main {
  display: flex;
  gap: 0.85rem;
  padding: 1rem 1rem 0.75rem;
  color: inherit;
  text-decoration: none;
  flex: 1;
}

.directory-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  flex: none;
}

.directory-card__copy {
  min-width: 0;
}

.directory-card__copy h2 {
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.3;
}

.directory-card__handle {
  margin: 0.15rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.directory-card__description {
  margin: 0.45rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.directory-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.5rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.directory-card__open {
  display: block;
  padding: 0.6rem 1rem 0.75rem;
  border-top: 1px solid var(--c-border-subtle);
  color: var(--c-link);
  font-size: 0.82rem;
  text-decoration: none;
}

.directory-card__open:hover {
  background: var(--c-surface-2);
}

.directory-state {
  padding: 1.5rem;
  border: 1px dashed var(--c-border);
  border-radius: 14px;
  color: var(--c-text-muted);
}

.directory-state h2 {
  margin: 0 0 0.35rem;
  color: var(--c-text);
  font-size: 1.15rem;
}

.directory-state p {
  margin: 0;
  max-width: 68ch;
  line-height: 1.6;
}

.directory-state__actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.directory-skeleton {
  padding: 1rem;
  border: 1px solid var(--c-border);
  border-radius: 14px;
  background: var(--c-surface);
}

.directory-skeleton__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--c-surface-2);
  animation: directory-pulse 1.4s ease-in-out infinite;
}

.directory-skeleton__line {
  height: 12px;
  margin-top: 0.8rem;
  border-radius: 6px;
  background: var(--c-surface-2);
  animation: directory-pulse 1.4s ease-in-out infinite;
}

.directory-skeleton__line--short {
  width: 55%;
}

@keyframes directory-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .directory-skeleton__avatar,
  .directory-skeleton__line {
    animation: none;
  }
}

@media (max-width: 760px) {
  .directory-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .directory-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccounts } from 'src/services/chainData'
import { parseAccountMetadata } from 'src/services/accountMetadata'
import { readBlogSettings } from 'src/services/blogSettings'
import { blogBaseUrl } from 'src/services/blogHost'
import { getBlogTheme } from 'src/themes/blogThemes'

function profileOf (account) {
  const posting = parseAccountMetadata(account && account.posting_json_metadata).value.profile
  const legacy = parseAccountMetadata(account && account.json_metadata).value.profile
  return {
    ...(legacy && typeof legacy === 'object' ? legacy : {}),
    ...(posting && typeof posting === 'object' ? posting : {})
  }
}

export default {
  name: 'BlogsDirectory',
  data () {
    return {
      blogs: [],
      loading: true,
      error: '',
      query: ''
    }
  },
  computed: {
    filteredBlogs () {
      const query = String(this.query || '').trim().toLowerCase()
      if (!query) return this.blogs
      return this.blogs.filter(blog =>
        (blog.name + ' ' + blog.title + ' ' + blog.description).toLowerCase().includes(query)
      )
    }
  },
  mounted () {
    this.updateMeta()
    this.load()
  },
  methods: {
    updateMeta () {
      setPageMeta({
        title: 'Blog directory — banksia.io',
        description: 'Opt-in Hive blogs on banksia.io. Browse community, project and personal blogs at username.banksia.io.',
        url: '/blogs/directory',
        type: 'website',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Hive blogs on Banksia',
          description: 'Opt-in Hive blogs at username.banksia.io.',
          url: 'https://banksia.io/blogs/directory'
        }
      })
    },
    async load () {
      this.loading = true
      this.error = ''
      try {
        const response = await fetch('/api/blogs', { headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const payload = await response.json()
        const names = Array.isArray(payload.accounts) ? payload.accounts.slice(0, 200) : []
        if (!names.length) {
          this.blogs = []
          return
        }
        const accounts = await fetchAccounts(names)
        const blogs = []
        for (const account of accounts) {
          if (!account || !account.name) continue
          const read = readBlogSettings(account)
          if (!read.claimed || read.settings.directory !== true) continue
          const profile = profileOf(account)
          const avatar = typeof profile.profile_image === 'string' && /^https:\/\//i.test(profile.profile_image)
            ? profile.profile_image
            : 'https://images.hive.blog/u/' + account.name + '/avatar'
          const theme = read.settings.theme || 'auto'
          blogs.push({
            name: account.name,
            title: read.settings.title || profile.name || account.name,
            description: read.settings.description || profile.about || '',
            avatar,
            themeLabel: theme === 'auto' ? 'Profile skin' : (getBlogTheme(theme)?.name || theme),
            pinned: Array.isArray(read.settings.pinned) ? read.settings.pinned.length : 0,
            contributors: Array.isArray(read.settings.authors) ? read.settings.authors.length : 0,
            url: blogBaseUrl(account.name)
          })
        }
        this.blogs = blogs.sort((left, right) => left.title.localeCompare(right.title))
      } catch (error) {
        this.error = error && error.message ? error.message : 'The directory could not be loaded.'
        this.blogs = []
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
