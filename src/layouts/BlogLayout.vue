<template>
  <div
    class="blog-shell"
    :class="['blog-shell--' + mode, 'blog-shell--' + blog.width]"
    :style="themeStyle"
    :data-blog-motion="blog.motion"
  >
    <a class="blog-skip" href="#blog-main">Skip to content</a>

    <header class="blog-header">
      <div class="blog-header__inner">
        <router-link to="/" class="blog-brand" :aria-label="title + ' home'">
          <img v-if="avatar" :src="avatar" alt="" class="blog-brand__avatar" width="38" height="38" />
          <span class="blog-brand__text">
            <strong>{{ title }}</strong>
            <small>@{{ accountName }}</small>
          </span>
        </router-link>

        <nav class="blog-nav" aria-label="Blog">
          <router-link to="/" exact-active-class="is-active">Blog</router-link>
          <router-link to="/about" active-class="is-active">About</router-link>
          <router-link to="/contact" active-class="is-active">Contact</router-link>
          <template v-for="link in blog.navLinks" :key="link.href">
            <router-link v-if="!isExternal(link.href)" :to="link.href">{{ link.label }}</router-link>
            <a v-else :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
          </template>
          <a :href="rssUrl" type="application/rss+xml">RSS</a>
        </nav>

        <div class="blog-header__actions">
          <label v-if="blog.modeSwitchable" class="blog-mode">
            <span class="blog-mode__label">Reading mode</span>
            <select
              class="blog-mode__select"
              :value="blog.modePreference"
              @change="blog.setModePreference($event.target.value)"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <a v-if="canEdit" :href="settingsUrl" class="blog-action">Settings</a>
          <a :href="apexUrl" class="blog-action blog-action--quiet">Banksia</a>
        </div>
      </div>
    </header>

    <main id="blog-main" class="blog-main" :class="'blog-main--' + blog.width">
      <div v-if="blog.error" class="blog-state" role="alert">
        <h1 class="blog-state__title">Blog not available</h1>
        <p>{{ blog.error }}</p>
        <a :href="apexUrl" class="blog-state__link">Back to Banksia</a>
      </div>

      <div v-else-if="blog.loading && !blog.account" class="blog-state" role="status" aria-busy="true">
        <div class="blog-skeleton blog-skeleton--title"></div>
        <div class="blog-skeleton"></div>
        <div class="blog-skeleton blog-skeleton--short"></div>
      </div>

      <router-view v-else />
    </main>

    <footer class="blog-footer">
      <div class="blog-footer__inner">
        <p>
          <template v-if="blog.claimed">
            A Hive blog by <a :href="apexAccountUrl">@{{ accountName }}</a>.
          </template>
          <template v-else>
            Unclaimed preview for <a :href="apexAccountUrl">@{{ accountName }}</a>.
            <a :href="settingsUrl">Claim it</a>
          </template>
        </p>
        <p class="blog-footer__powered">
          <a :href="apexUrl">Powered by Banksia</a>
          <span aria-hidden="true"> · </span>
          content on the Hive blockchain
        </p>
      </div>
    </footer>
  </div>
</template>

<style>
/* The SPA body keeps its own background. A blog host owns the whole viewport,
   so paint the document background from the blog's theme to avoid a flash at
   the edges of the shell. */
html[data-blog] body {
  background: var(--c-bg);
}
</style>

<style scoped>
.blog-shell {
  min-height: 100vh;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font-body);
  line-height: 1.6;
}

.blog-shell--light { color-scheme: light; }
.blog-shell--dark { color-scheme: dark; }
.blog-shell--narrow { --blog-width: 720px; }
.blog-shell--comfortable { --blog-width: 1080px; }
.blog-shell--wide { --blog-width: 1320px; }

.blog-shell[data-blog-motion="reduced"] *,
.blog-shell[data-blog-motion="reduced"] *::before,
.blog-shell[data-blog-motion="reduced"] *::after {
  transition: none !important;
  animation: none !important;
  scroll-behavior: auto !important;
}

.blog-skip {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: 0.6rem 1rem;
  background: var(--c-surface);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: 0 0 8px 0;
}

.blog-skip:focus {
  left: 0;
}

.blog-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--c-border);
  background: color-mix(in srgb, var(--c-bg) 88%, transparent);
  backdrop-filter: blur(10px);
}

.blog-header__inner {
  max-width: var(--blog-width, 1080px);
  margin: 0 auto;
  padding: 0.8rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.blog-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: inherit;
  text-decoration: none;
  min-width: 0;
}

.blog-brand__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  flex: none;
}

.blog-brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.blog-brand__text strong {
  font-family: var(--font-display);
  font-size: 1.05rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-brand__text small {
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.blog-nav {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.blog-nav a,
.blog-action {
  color: var(--c-text-muted);
  text-decoration: none;
  font-size: 0.88rem;
  padding: 0.2rem 0;
  border-bottom: 2px solid transparent;
}

.blog-nav a:hover,
.blog-nav a.is-active,
.blog-action:hover {
  color: var(--c-text);
  border-bottom-color: var(--c-primary);
}

.blog-header__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.blog-mode {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-muted);
  font-size: 0.74rem;
}

.blog-mode__select {
  padding: 0.16rem 0.3rem;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: var(--c-surface-2);
  color: var(--c-text);
  font: inherit;
  cursor: pointer;
}

.blog-action--quiet {
  color: var(--c-text-muted);
}

.blog-main {
  max-width: var(--blog-width, 1080px);
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

.blog-main--narrow { max-width: 720px; }
.blog-main--comfortable { max-width: 1080px; }
.blog-main--wide { max-width: 1320px; }

.blog-state {
  max-width: 640px;
  margin: 3rem auto;
  padding: 1.5rem;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
}

.blog-state__title {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.35rem;
}

.blog-state__link {
  color: var(--c-link);
}

.blog-skeleton {
  height: 14px;
  margin: 0.65rem 0;
  border-radius: 6px;
  background: var(--c-surface-2);
  animation: blog-pulse 1.4s ease-in-out infinite;
}

.blog-skeleton--title { height: 30px; width: 62%; }
.blog-skeleton--short { width: 38%; }

@keyframes blog-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

.blog-footer {
  border-top: 1px solid var(--c-border);
  margin-top: 2rem;
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.blog-footer__inner {
  max-width: var(--blog-width, 1080px);
  margin: 0 auto;
  padding: 1.5rem 1.25rem;
  display: flex;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
  flex-wrap: wrap;
}

.blog-footer p {
  margin: 0;
}

.blog-footer a {
  color: var(--c-link);
}

.blog-footer__powered {
  opacity: 0.85;
}

@media (prefers-reduced-motion: reduce) {
  .blog-skeleton { animation: none; }
}

@media (max-width: 640px) {
  .blog-header__inner {
    padding: 0.7rem 0.9rem;
  }

  .blog-brand__text strong {
    max-width: 42vw;
  }

  .blog-nav {
    order: 3;
    width: 100%;
    gap: 0.75rem;
    padding-top: 0.15rem;
    border-top: 1px solid var(--c-border-subtle);
  }

  .blog-main {
    padding: 1.25rem 0.9rem 3rem;
  }
}
</style>

<script>
import { useBlogStore } from 'src/stores/blog'

export default {
  name: 'BlogLayout',
  data () {
    return {
      themeWatcher: null
    }
  },
  computed: {
    blog () {
      return useBlogStore()
    },
    accountName () {
      return this.blog.accountName
    },
    title () {
      return this.blog.title
    },
    avatar () {
      return this.blog.avatar
    },
    rssUrl () {
      return this.blog.rssUrl
    },
    apexUrl () {
      return this.blog.apexUrl
    },
    apexAccountUrl () {
      return this.blog.apexAccountUrl
    },
    settingsUrl () {
      return this.blog.settingsUrl
    },
    canEdit () {
      return this.blog.canEdit
    },
    mode () {
      return this.blog.mode
    },
    themeStyle () {
      return this.blog.themeStyle
    }
  },
  watch: {
    mode: {
      immediate: true,
      handler (value) {
        if (typeof document === 'undefined') return
        document.documentElement.dataset.blog = 'true'
        document.documentElement.style.setProperty('color-scheme', value === 'light' ? 'light' : 'dark')
      }
    }
  },
  methods: {
    isExternal (href) {
      return /^https?:\/\//i.test(String(href || ''))
    }
  },
  created () {
    if (typeof window !== 'undefined') {
      this.blog.init(window.location.hostname)
    }
  },
  beforeUnmount () {
    if (typeof document === 'undefined') return
    delete document.documentElement.dataset.blog
    document.documentElement.style.removeProperty('color-scheme')
  }
}
</script>
