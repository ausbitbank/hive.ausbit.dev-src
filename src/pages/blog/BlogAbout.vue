<template>
  <div class="blog-page">
    <header class="blog-page__head">
      <p class="blog-page__kicker"><router-link to="/">← {{ blogTitle }}</router-link></p>
      <h1 class="blog-page__title">About</h1>
    </header>

    <div class="blog-about">
      <img :src="avatar" alt="" class="blog-about__avatar" width="96" height="96" />
      <div class="blog-about__copy">
        <p class="blog-about__handle">
          <a :href="apexAccountUrl">@{{ accountName }}</a>
          <template v-if="joinedLabel">
            <span aria-hidden="true"> · </span>
            joined {{ joinedLabel }}
          </template>
        </p>
        <p v-if="about" class="blog-about__text">{{ about }}</p>
        <p v-else class="blog-about__text blog-about__text--muted">
          @{{ accountName }} has not written a profile description yet.
        </p>
        <dl v-if="location || website" class="blog-about__facts">
          <template v-if="location">
            <dt>Location</dt>
            <dd>{{ location }}</dd>
          </template>
          <template v-if="website">
            <dt>Website</dt>
            <dd><a :href="website" target="_blank" rel="noopener noreferrer">{{ website }}</a></dd>
          </template>
        </dl>
      </div>
    </div>

    <section class="blog-page__section">
      <h2>Find @{{ accountName }} on Hive</h2>
      <ul class="blog-page__links">
        <li><a :href="apexAccountUrl">Banksia account</a></li>
        <li><a :href="'https://peakd.com/@' + accountName" target="_blank" rel="noopener noreferrer">PeakD</a></li>
        <li><a :href="'https://ecency.com/@' + accountName" target="_blank" rel="noopener noreferrer">Ecency</a></li>
        <li><a :href="'https://hive.blog/@' + accountName" target="_blank" rel="noopener noreferrer">Hive.blog</a></li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.blog-page {
  max-width: 760px;
  margin: 0 auto;
}

.blog-page__head {
  margin-bottom: 1.75rem;
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

.blog-about {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.blog-about__avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  flex: none;
}

.blog-about__copy {
  min-width: 0;
}

.blog-about__handle {
  margin: 0 0 0.6rem;
  color: var(--c-text-muted);
  font-size: 0.9rem;
}

.blog-about__handle a {
  color: var(--c-link);
  text-decoration: none;
}

.blog-about__text {
  margin: 0;
  white-space: pre-line;
  font-size: 1.02rem;
  line-height: 1.7;
}

.blog-about__text--muted {
  color: var(--c-text-muted);
}

.blog-about__facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 0.9rem;
  margin: 1rem 0 0;
  font-size: 0.9rem;
}

.blog-about__facts dt {
  color: var(--c-text-muted);
}

.blog-about__facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.blog-about__facts a {
  color: var(--c-link);
}

.blog-page__section {
  margin-top: 2.25rem;
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
  font-size: 0.92rem;
}

.blog-page__links a {
  color: var(--c-link);
}

@media (max-width: 640px) {
  .blog-about {
    flex-direction: column;
  }

  .blog-about__avatar {
    width: 72px;
    height: 72px;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { useBlogStore } from 'src/stores/blog'
import { formatBlogDate } from 'src/services/blogPosts'

export default {
  name: 'BlogAbout',
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
    avatar () {
      return this.blog.avatar
    },
    about () {
      return this.blog.about
    },
    location () {
      return this.blog.location
    },
    website () {
      return this.blog.website
    },
    joinedLabel () {
      return formatBlogDate(this.blog.joined)
    },
    apexAccountUrl () {
      return this.blog.apexAccountUrl
    }
  },
  mounted () {
    this.updateMeta()
  },
  methods: {
    updateMeta () {
      if (typeof window === 'undefined') return
      const origin = window.location.origin
      setPageMeta({
        title: 'About — ' + this.blogTitle,
        description: this.about || ('About @' + this.accountName + ' on Hive.'),
        image: this.blog.ogImage || this.avatar,
        url: '/about',
        type: 'website',
        baseUrl: origin,
        siteName: this.blogTitle,
        noindex: !this.blog.claimed,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About ' + this.blogTitle,
          url: origin + '/about',
          mainEntity: {
            '@type': 'Person',
            name: '@' + this.accountName,
            description: this.about,
            image: this.blog.ogImage || this.avatar,
            url: 'https://banksia.io/@' + this.accountName
          }
        }
      })
    }
  }
}
</script>
