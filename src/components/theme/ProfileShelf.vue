<template>
  <div v-if="hasContent" class="profile-shelf">
    <status-line v-if="showStatus && status" :status="status" />

    <div v-if="showExtras" class="profile-shelf__modules">
      <hive-circle v-if="circle.length" :names="circle" :accounts="circleAccounts" />
      <badge-shelf v-if="displayBadges.length" :badges="displayBadges" />

      <article v-if="post" class="skin-post" aria-labelledby="skin-post-title">
        <h2 id="skin-post-title" class="skin-shelf__label">{{ postMode === 'pinned' ? 'Pinned post' : 'Latest post' }}</h2>
        <router-link :to="post.link" class="skin-post__link">
          <img v-if="post.cover" :src="post.cover" alt="" class="skin-post__cover" loading="lazy" />
          <span class="skin-post__body">
            <span class="skin-post__title">{{ post.title }}</span>
            <span v-if="post.excerpt" class="skin-post__excerpt">{{ post.excerpt }}</span>
          </span>
        </router-link>
      </article>
    </div>
  </div>
</template>

<style scoped>
.profile-shelf {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.65rem 1rem 0.85rem;
  border-bottom: 1px solid color-mix(in srgb, var(--skin-border, var(--c-border)) 45%, transparent);
  background: color-mix(in srgb, var(--skin-surface, var(--c-surface)) 42%, transparent);
}

.profile-shelf__modules {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
}

.skin-shelf__label {
  margin: 0 0 0.3rem;
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.skin-post {
  width: min(100%, 520px);
}

.skin-post__link {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--skin-border, var(--c-border)) 70%, transparent);
  border-radius: var(--radius-card);
  background: var(--skin-surface, var(--c-surface));
  color: var(--skin-text, var(--c-text));
  text-decoration: none;
}

.skin-post__link:hover,
.skin-post__link:focus-visible {
  border-color: var(--skin-primary, var(--c-primary));
  text-decoration: none;
}

.skin-post__cover {
  flex: 0 0 96px;
  width: 96px;
  object-fit: cover;
}

.skin-post__body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
}

.skin-post__title {
  font-size: 0.84rem;
  font-weight: 650;
  line-height: 1.3;
}

.skin-post__excerpt {
  overflow: hidden;
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.72rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

@media (max-width: 599px) {
  .profile-shelf {
    padding: 0.55rem 0.5rem 0.75rem;
  }

  .skin-post__cover {
    flex-basis: 72px;
    width: 72px;
  }
}
</style>

<script>
import StatusLine from 'components/theme/StatusLine.vue'
import HiveCircle from 'components/theme/HiveCircle.vue'
import BadgeShelf from 'components/theme/BadgeShelf.vue'
import { resolveProfileBadges } from 'src/services/badges'
import { fetchAccountPosts, fetchAccounts } from 'src/services/chainData'
import { postDisplayTitle, postMetadata } from 'src/services/posts'
import { stripHtml, safeJsonParse } from 'src/utils/safeHtml'
import { isSafeImageUrl } from 'src/themes/schema'

function pause () {
  if (typeof window === 'undefined') return Promise.resolve()
  return new Promise(resolve => {
    const idle = window.requestIdleCallback || window.requestAnimationFrame || (callback => setTimeout(callback, 0))
    idle(() => resolve(), { timeout: 900 })
  })
}

function firstImage (post) {
  const metadata = postMetadata(post)
  const images = Array.isArray(metadata.image) ? metadata.image : [metadata.image]
  return images.find(image => isSafeImageUrl(image)) || ''
}

export default {
  name: 'ProfileShelf',
  components: { StatusLine, HiveCircle, BadgeShelf },
  props: {
    theme: { type: Object, default: null },
    account: { type: Object, default: null },
    preview: { type: Boolean, default: false },
    previewBadges: { type: Array, default: () => [] }
  },
  data () {
    return {
      circleAccounts: [],
      badges: [],
      post: null,
      controller: null
    }
  },
  computed: {
    status () {
      return this.theme?.profile?.status || null
    },
    circle () {
      return Array.isArray(this.theme?.profile?.circle) ? this.theme.profile.circle.slice(0, 6) : []
    },
    postMode () {
      return ['latest', 'pinned'].includes(this.theme?.profile?.post) ? this.theme.profile.post : 'none'
    },
    showStatus () {
      return this.$appearance.showSkinStatus !== false
    },
    showExtras () {
      return this.$appearance.showSkinExtras !== false
    },
    displayBadges () {
      return this.preview ? this.previewBadges : this.badges
    },
    hasContent () {
      if (this.showStatus && this.status) return true
      if (!this.showExtras) return false
      return Boolean(this.circle.length || this.displayBadges.length || this.post)
    },
    author () {
      return this.account?.name || ''
    },
    pinnedPermlink () {
      const profile = this.account?.profile && typeof this.account.profile === 'object'
        ? this.account.profile
        : safeJsonParse(this.account?.posting_json_metadata, {}).profile || {}
      return typeof profile.pinned === 'string' ? profile.pinned : ''
    }
  },
  watch: {
    author () {
      this.load()
    },
    circle () {
      this.loadCircle()
    },
    postMode () {
      this.loadPost()
    },
    'theme.profile.badges' () {
      this.loadBadges()
    }
  },
  mounted () {
    if (this.preview) return
    this.load()
  },
  beforeUnmount () {
    this.controller?.abort()
  },
  methods: {
    async load () {
      await pause()
      if (this.preview || !this.author) return
      this.controller?.abort()
      this.controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      await Promise.allSettled([this.loadCircle(), this.loadPost(), this.loadBadges()])
    },
    async loadBadges () {
      this.badges = []
      if (this.preview || !this.author || !this.theme) return
      const selected = Array.isArray(this.theme.profile?.badges?.selected) ? this.theme.profile.badges.selected : []
      const showLevel = this.theme.profile?.badges?.showLevel !== false
      if (!selected.length && !showLevel) return
      try {
        const badges = await resolveProfileBadges(this.theme, this.author, { signal: this.controller?.signal })
        if (!this.controller?.signal.aborted) this.badges = badges
      } catch {
        this.badges = []
      }
    },
    async loadCircle () {
      if (!this.circle.length) {
        this.circleAccounts = []
        return
      }
      if (this.preview) return
      try {
        const accounts = await fetchAccounts(this.circle)
        if (!this.controller?.signal.aborted) this.circleAccounts = accounts
      } catch {
        this.circleAccounts = []
      }
    },
    async loadPost () {
      this.post = null
      if (this.preview || !this.author || this.postMode === 'none') return
      try {
        const limit = this.postMode === 'pinned' ? 20 : 1
        const posts = await fetchAccountPosts({ account: this.author, sort: 'blog', limit }, {})
        if (this.controller?.signal.aborted) return
        const rows = Array.isArray(posts) ? posts : []
        const chosen = this.postMode === 'pinned' && this.pinnedPermlink
          ? rows.find(row => row?.permlink === this.pinnedPermlink)
          : rows[0]
        if (!chosen) return
        this.post = {
          link: '/@' + chosen.author + '/' + chosen.permlink,
          title: postDisplayTitle(chosen),
          excerpt: stripHtml(chosen.body).slice(0, 180),
          cover: firstImage(chosen)
        }
      } catch {
        this.post = null
      }
    }
  }
}
</script>
