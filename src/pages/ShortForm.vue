<template>
  <q-page class="sfo">
    <div class="sfo-wrap">
      <header class="sfo-head">
        <div class="home-eyebrow">
          <q-icon name="bolt" size="14px" aria-hidden="true" />
          Hive microblogs
        </div>
        <h1 class="page-title">Short posts</h1>
        <p class="sfo-head__subtitle">
          Five microblog formats live on Hive, each with its own front end and storage. Pick one to read the
          latest, or see what people you follow are sharing.
        </p>
      </header>

      <nav class="sfo-formats" aria-label="Microblog formats">
        <router-link
          v-for="profile in formats"
          :key="profile.id"
          :to="{ name: 'short-form', params: { formatId: profile.id } }"
          class="sfo-card home-card"
          :style="{ '--card-accent': profile.color }"
        >
          <span class="sfo-card__head">
            <q-icon :name="profile.icon" size="22px" aria-hidden="true" />
            <span class="sfo-card__labels">
              <span class="sfo-card__title">{{ profile.label }}</span>
              <span class="sfo-card__app">{{ profile.app }}</span>
            </span>
            <q-icon name="arrow_forward" size="16px" class="sfo-card__arrow" aria-hidden="true" />
          </span>
          <span class="sfo-card__desc">{{ profile.description }}</span>
          <span class="sfo-card__preview" aria-hidden="true">
            <img
              v-if="previewImage(profile.id)"
              :src="previewImage(profile.id)"
              alt=""
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            />
            <span v-else class="sfo-card__placeholder">{{ profile.mode === 'container' ? 'comments on container posts' : 'top-level posts in #' + profile.tag }}</span>
          </span>
        </router-link>
      </nav>

      <section
        v-if="loggedInUser"
        class="sfo-liked home-card"
        aria-labelledby="sfo-liked-title"
      >
        <div class="home-panel__head">
          <div>
            <div class="home-eyebrow">Your activity</div>
            <h2 id="sfo-liked-title" class="home-panel__title">Short posts you reacted to</h2>
          </div>
          <router-link :to="{ name: 'account', params: { username: loggedInUser } }" class="sfo-liked__link">
            @{{ loggedInUser }}
          </router-link>
        </div>
        <div v-if="loadingLiked" class="sfo-liked__body">
          <q-spinner-dots color="primary" size="24px" aria-hidden="true" />
        </div>
        <p v-else-if="liked.length === 0" class="sfo-liked__body sfo-liked__body--empty">
          Nothing yet. Post or like a short post and it will show up here.
        </p>
        <ol v-else class="sfo-grid-list">
          <li v-for="item in liked" :key="item.author + '/' + item.permlink">
            <router-link
              :to="{ name: 'short-form-post', params: { formatId: item.format, author: item.author, permlink: item.permlink } }"
              class="sfo-mini"
            >
              <img
                v-if="miniImage(item)"
                :src="miniImage(item)"
                alt=""
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
              />
              <span class="sfo-mini__text">
                <span class="sfo-mini__author">@{{ item.author }}</span>
                <span class="sfo-mini__body">{{ miniText(item) }}</span>
              </span>
            </router-link>
          </li>
        </ol>
      </section>
    </div>
  </q-page>
</template>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchShortFormFeed, shortFormatList, shortMedia, shortPreview } from 'src/services/shortForm'
import { fetchLikedShortPosts } from 'src/services/shortFormLikes'
import { bridgeRequest } from 'src/services/api'

export default {
  name: 'ShortFormIndex',
  components: {},
  data () {
    return {
      formats: shortFormatList(),
      previews: {},
      liked: [],
      loadingLiked: false
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    }
  },
  watch: {
    loggedInUser: {
      immediate: true,
      handler (value) {
        if (value) this.loadLiked(value)
      }
    }
  },
  mounted () {
    setPageMeta({
      title: 'Short posts — Hive microblogs',
      description: 'Read and post the five Hive microblog formats: Snaps (PeakD), Waves (Ecency), Threads (InLeo), D.Buzz and Moments (Liketu).',
      url: '/shorts'
    })
    this.loadPreviews()
  },
  methods: {
    /** A representative image per format, so each card shows real content. */
    async loadPreviews () {
      const results = await Promise.allSettled(this.formats.map(async profile => {
        const items = await fetchShortFormFeed(profile.id, { limit: 4 })
        for (const item of items) {
          const media = shortMedia(item, { limit: 1 })
          if (media.length && media[0].kind === 'image') return [profile.id, media[0].url]
        }
        return [profile.id, '']
      }))
      const next = {}
      for (const result of results) {
        if (result.status === 'fulfilled') next[result.value[0]] = result.value[1]
      }
      this.previews = next
    },
    previewImage (formatId) {
      return this.previews[formatId] || ''
    },
    async loadLiked (account) {
      this.loadingLiked = true
      try {
        this.liked = await fetchLikedShortPosts(account, { limit: 8, request: bridgeRequest })
      } catch {
        this.liked = []
      } finally {
        this.loadingLiked = false
      }
    },
    miniImage (item) {
      const media = shortMedia(item, { limit: 1 })
      return media.length ? media[0].url : ''
    },
    miniText (item) {
      return shortPreview(item.body, 90)
    }
  }
}
</script>

<style scoped>
.sfo {
  padding-bottom: var(--space-6);
}

.sfo-wrap {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.sfo-head__subtitle {
  max-width: 74ch;
  margin: 0.35rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.9rem;
}

.sfo-formats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.sfo-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-top: 3px solid var(--card-accent, var(--c-link));
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.sfo-card:hover {
  border-color: var(--card-accent, var(--c-link));
  text-decoration: none;
  transform: translateY(-1px);
}

.sfo-card__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--card-accent, var(--c-link));
}

.sfo-card__labels {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.sfo-card__title {
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 700;
}

.sfo-card__app {
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.sfo-card__arrow {
  color: var(--c-text-faint);
}

.sfo-card__desc {
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.sfo-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 96px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-shadow) 28%, transparent);
}

.sfo-card__preview img {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.sfo-card__placeholder {
  padding: var(--space-2);
  color: var(--c-text-faint);
  font-size: 0.72rem;
  text-align: center;
}

.sfo-liked {
  margin-top: var(--space-4);
}

.sfo-liked__link {
  color: var(--c-link);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
}

.sfo-liked__body {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}

.sfo-liked__body--empty {
  color: var(--c-text-faint);
  font-size: 0.85rem;
}

.sfo-grid-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  list-style: none;
}

.sfo-mini {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  height: 100%;
  padding: var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: inherit;
  text-decoration: none;
}

.sfo-mini:hover {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  text-decoration: none;
}

.sfo-mini img {
  width: 100%;
  height: 96px;
  border-radius: 4px;
  object-fit: cover;
}

.sfo-mini__text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.sfo-mini__author {
  color: var(--c-link);
  font-size: 0.76rem;
  font-weight: 700;
}

.sfo-mini__body {
  display: -webkit-box;
  overflow: hidden;
  color: var(--c-text-soft);
  font-size: 0.78rem;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style>
