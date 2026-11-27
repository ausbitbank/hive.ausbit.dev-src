<template>
  <article v-if="post" class="blog-post">
    <header class="blog-post__head">
      <p class="blog-post__kicker">
        <router-link to="/">← {{ blogTitle }}</router-link>
      </p>

      <h1 class="blog-post__title">{{ title }}</h1>

      <div class="blog-post__byline">
        <img :src="authorAvatar" alt="" class="blog-post__avatar" width="40" height="40" />
        <div class="blog-post__byline-text">
          <a :href="apexAuthorUrl" class="blog-post__author">@{{ post.author }}</a>
          <span class="blog-post__meta">
            <time :datetime="post.created">{{ dateLabel }}</time>
            <span aria-hidden="true"> · </span>
            {{ readingMinutes }} min read
          </span>
        </div>
      </div>

      <img v-if="cover" :src="cover" alt="" class="blog-post__cover" />
    </header>

    <render :input="post.body" class="postbody blog-post__body" />

    <footer class="blog-post__foot">
      <ul v-if="tags.length" class="blog-post__tags" aria-label="Tags">
        <li v-for="tag in tags" :key="tag">#{{ tag }}</li>
      </ul>

      <div class="blog-post__actions">
        <a :href="apexPostUrl" class="blog-post__action blog-post__action--primary">Read on Banksia</a>
        <a :href="apexTipUrl" class="blog-post__action">Tip with Lightning</a>
        <a :href="apexPostUrl + '#comments'" class="blog-post__action">Comment on Hive</a>
      </div>

      <p v-if="showPayout && payout" class="blog-post__payout">Hive payout: {{ payout }}</p>
    </footer>
  </article>

  <div v-else-if="loading" class="blog-post-state" role="status" aria-busy="true">
    <div class="blog-post-state__line blog-post-state__line--title"></div>
    <div class="blog-post-state__line"></div>
    <div class="blog-post-state__line blog-post-state__line--short"></div>
  </div>

  <div v-else class="blog-post-state" role="alert">
    <h1 class="blog-post-state__title">Post not found</h1>
    <p>This post is not part of @{{ accountName }}'s blog, or it is no longer available on Hive.</p>
    <router-link to="/" class="blog-post-state__link">Back to the blog</router-link>
  </div>
</template>

<style scoped>
.blog-post {
  max-width: 780px;
  margin: 0 auto;
}

.blog-post__head {
  margin-bottom: 1.75rem;
}

.blog-post__kicker {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.blog-post__kicker a {
  color: var(--c-text-muted);
  text-decoration: none;
}

.blog-post__kicker a:hover {
  color: var(--c-link);
}

.blog-post__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4.4vw, 2.7rem);
  line-height: 1.12;
  letter-spacing: -0.01em;
}

.blog-post__byline {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1.1rem;
}

.blog-post__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
}

.blog-post__byline-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.blog-post__author {
  color: var(--c-text);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.92rem;
}

.blog-post__meta {
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.blog-post__cover {
  display: block;
  width: 100%;
  max-height: 460px;
  object-fit: cover;
  margin-top: 1.5rem;
  border-radius: var(--skin-radius-card, 12px);
  border: 1px solid var(--c-border);
}

.blog-post__body {
  font-size: 1.06rem;
  line-height: 1.78;
  color: var(--c-text);
}

.blog-post__body :deep(p) {
  margin: 0 0 1.2em;
}

.blog-post__body :deep(h2),
.blog-post__body :deep(h3),
.blog-post__body :deep(h4) {
  font-family: var(--font-display);
  line-height: 1.25;
  margin: 1.8em 0 0.6em;
}

.blog-post__body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: calc(var(--skin-radius-card, 12px) - 2px);
}

.blog-post__body :deep(a) {
  color: var(--c-link);
}

.blog-post__body :deep(blockquote) {
  margin: 1.4em 0;
  padding: 0.2em 0 0.2em 1.1em;
  border-left: 3px solid var(--c-border-strong);
  color: var(--c-text-soft);
}

.blog-post__body :deep(pre) {
  overflow-x: auto;
  padding: 1rem;
  border: 1px solid var(--c-code-border);
  border-radius: 10px;
  background: var(--c-code-bg);
  color: var(--c-code-text);
  font-family: var(--font-mono);
  font-size: 0.86rem;
}

.blog-post__body :deep(code) {
  font-family: var(--font-mono);
}

.blog-post__body :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 1.2em 0;
}

.blog-post__body :deep(th),
.blog-post__body :deep(td) {
  border: 1px solid var(--c-border);
  padding: 0.45rem 0.6rem;
}

.blog-post__body :deep(iframe) {
  max-width: 100%;
  border: 0;
  border-radius: 10px;
}

.blog-post__foot {
  margin-top: 2.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--c-border);
}

.blog-post__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  color: var(--c-text-faint);
  font-size: 0.8rem;
}

.blog-post__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.blog-post__action {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  color: var(--c-text);
  text-decoration: none;
  font-size: 0.83rem;
}

.blog-post__action:hover {
  border-color: var(--c-primary);
  color: var(--c-link);
}

.blog-post__action--primary {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: var(--c-on-primary);
}

.blog-post__action--primary:hover {
  color: var(--c-on-primary);
  filter: brightness(1.06);
}

.blog-post__payout {
  margin: 1rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.blog-post-state {
  max-width: 640px;
  margin: 2rem auto;
  padding: 1.5rem;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
}

.blog-post-state__title {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
}

.blog-post-state__line {
  height: 14px;
  margin: 0.7rem 0;
  border-radius: 6px;
  background: var(--c-surface-2);
  animation: blog-pulse 1.4s ease-in-out infinite;
}

.blog-post-state__line--title {
  height: 30px;
  width: 66%;
}

.blog-post-state__line--short {
  width: 42%;
}

.blog-post-state__link {
  color: var(--c-link);
}

@keyframes blog-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .blog-post-state__line { animation: none; }
}

@media (max-width: 640px) {
  .blog-post__body {
    font-size: 1rem;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { useBlogStore } from 'src/stores/blog'
import {
  blogPostExcerpt,
  blogPostImage,
  blogPostPayout,
  blogPostPathFor,
  blogPostReadingMinutes,
  blogPostTags,
  blogPostTitle,
  formatBlogDate
} from 'src/services/blogPosts'
import Render from 'components/render.vue'

export default {
  name: 'BlogPost',
  components: { Render },
  data () {
    return {
      post: null,
      loading: true,
      notFound: false,
      requestId: 0
    }
  },
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
    title () {
      return this.post ? blogPostTitle(this.post) : ''
    },
    cover () {
      return this.post ? blogPostImage(this.post) : ''
    },
    tags () {
      return this.post ? blogPostTags(this.post, 5) : []
    },
    dateLabel () {
      return this.post ? formatBlogDate(this.post.created) : ''
    },
    readingMinutes () {
      return this.post ? blogPostReadingMinutes(this.post) : 0
    },
    payout () {
      return this.post ? blogPostPayout(this.post) : ''
    },
    showPayout () {
      return Boolean(this.blog.settings && this.blog.settings.showPayout)
    },
    authorAvatar () {
      return this.post ? 'https://images.hive.blog/u/' + this.post.author + '/avatar' : ''
    },
    apexAuthorUrl () {
      return this.post ? 'https://banksia.io/@' + this.post.author : 'https://banksia.io'
    },
    apexPostUrl () {
      return this.post ? 'https://banksia.io/@' + this.post.author + '/' + this.post.permlink : 'https://banksia.io'
    },
    apexTipUrl () {
      return this.post ? 'https://banksia.io/@' + this.post.author + '/tip' : 'https://banksia.io'
    }
  },
  watch: {
    '$route.params.permlink': 'load',
    '$route.params.author': 'load'
  },
  created () {
    this.load()
  },
  methods: {
    async load () {
      const permlink = String(this.$route.params.permlink || '').trim()
      const author = String(this.$route.params.author || this.blog.accountName || '').trim().toLowerCase()
      const requestId = ++this.requestId
      this.loading = true
      this.notFound = false
      this.post = null
      if (!permlink) {
        this.loading = false
        this.notFound = true
        return
      }
      const post = await this.blog.loadPost(permlink, { author })
      if (requestId !== this.requestId) return
      this.post = post
      this.notFound = !post
      this.loading = false
      if (post) this.updateMeta()
    },
    updateMeta () {
      if (!this.post || typeof window === 'undefined') return
      const origin = window.location.origin
      const description = blogPostExcerpt(this.post, 200)
      const path = blogPostPathFor(this.post, this.blog.accountName)
      setPageMeta({
        title: this.title + ' — ' + this.blogTitle,
        description,
        image: this.cover || this.authorAvatar,
        url: path,
        type: 'article',
        baseUrl: origin,
        siteName: this.blogTitle,
        noindex: !this.blog.claimed,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: this.title,
          description,
          image: [this.cover || this.authorAvatar],
          datePublished: this.post.created || undefined,
          dateModified: this.post.last_update || this.post.created || undefined,
          author: {
            '@type': 'Person',
            name: '@' + this.post.author,
            url: 'https://banksia.io/@' + this.post.author
          },
          publisher: {
            '@type': 'Organization',
            name: 'Banksia',
            url: 'https://banksia.io'
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': origin + path }
        }
      })
    }
  }
}
</script>
