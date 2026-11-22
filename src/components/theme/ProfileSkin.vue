<template>
  <div
    v-if="visible"
    class="skin-scope"
    :class="{ 'skin-scope--preview': preview }"
    :data-skin-background="theme.profile.background"
    :data-avatar-frame="theme.profile.avatarFrame"
    :data-nameplate="theme.profile.nameplate"
    :data-card="theme.profile.card"
    :data-skin-motion="motion"
    :style="skinStyle"
  >
    <div class="skin-badge" aria-label="Profile skin">
      <span v-if="preview" class="skin-badge__label">
        <q-icon name="visibility" size="14px" aria-hidden="true" />
        Previewing your skin
      </span>
      <span v-else class="skin-badge__label">
        <q-icon name="palette" size="14px" aria-hidden="true" />
        Skin by
        <router-link :to="'/@' + (author || theme.author)">@{{ author || theme.author }}</router-link>
      </span>
      <span v-if="theme.remixedFrom" class="skin-badge__note">
        remixed from <router-link :to="'/@' + theme.remixedFrom">@{{ theme.remixedFrom }}</router-link>
      </span>
      <button v-if="!preview" type="button" class="skin-badge__action" @click="hideSkins">Hide skins</button>
      <a
        v-if="!preview"
        class="skin-badge__action"
        :href="reportUrl"
        target="_blank"
        rel="noopener noreferrer"
      >Report</a>
    </div>

    <div v-if="theme.profile.banner && theme.profile.banner.images.length" class="skin-banner" aria-hidden="true">
      <img
        v-for="(image, index) in theme.profile.banner.images"
        :key="image"
        :src="image"
        alt=""
        loading="lazy"
        :class="'skin-banner__image skin-banner__image--' + (index + 1)"
      />
    </div>

    <div v-if="theme.profile.ticker" class="skin-ticker">
      <span class="skin-ticker__track">{{ theme.profile.ticker }}</span>
    </div>

    <div v-if="theme.profile.stickers.length" class="skin-sticker-tray" aria-hidden="true">
      <span v-for="sticker in theme.profile.stickers" :key="sticker" class="skin-sticker">{{ stickerIcon(sticker) }}</span>
    </div>

    <slot />
  </div>
  <slot v-else />
</template>

<style scoped>
.skin-badge__label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--c-text-muted);
}

.skin-badge__note {
  color: var(--c-text-faint);
}

.skin-badge__action {
  margin-left: 0.1rem;
}

.skin-badge__action + .skin-badge__action {
  margin-left: 0.6rem;
}

.skin-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  height: clamp(90px, 14vw, 170px);
  overflow: hidden;
  border-bottom: 1px solid var(--c-border-subtle);
}

.skin-banner__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.82;
}

.skin-banner__image--1:only-child {
  grid-column: 1 / -1;
}

.skin-banner__image--2 {
  grid-column: span 2;
}

.skin-scope--preview {
  border: 1px dashed var(--c-border-strong);
  border-radius: var(--radius-card);
  overflow: hidden;
}

@media (max-width: 599px) {
  .skin-banner {
    height: 96px;
  }
}
</style>

<script>
import { readAccountTheme } from 'src/themes/account'
import { quasarVarsFor, tokensFor } from 'src/themes/tokens'

const STICKER_ICONS = {
  hex: '⬡',
  bee: '🐝',
  star: '✦',
  spark: '✨',
  cassette: '📼',
  'pixel-heart': '♥',
  coffee: '☕',
  rocket: '🚀',
  flower: '✿',
  lightning: '⚡'
}

export default {
  name: 'ProfileSkin',
  props: {
    account: { type: Object, default: null },
    author: { type: String, default: '' },
    context: { type: String, default: 'profile' },
    previewTheme: { type: Object, default: null },
    enabled: { type: Boolean, default: true }
  },
  computed: {
    preview () {
      return Boolean(this.previewTheme)
    },
    theme () {
      if (this.previewTheme) return this.previewTheme
      return readAccountTheme(this.account).theme
    },
    visible () {
      if (!this.enabled || !this.theme) return false
      if (this.preview) return true
      if (this.$appearance.highContrast) return false
      if (this.$appearance.profileSkins === 'off') return false
      if (this.$appearance.profileSkins === 'profile' && this.context === 'post') return false
      return true
    },
    motion () {
      if (this.$appearance.effectiveMotion === 'reduced') return 'none'
      return this.theme.profile.background === 'solid' ? 'none' : (this.theme.effects.ambient === 'none' ? 'none' : this.theme.effects.ambient)
    },
    skinStyle () {
      if (!this.theme) return {}
      const tokens = tokensFor(this.theme)
      const quasar = quasarVarsFor(this.theme)
      return {
        ...tokens,
        ...quasar,
        '--skin-bg': tokens['--c-bg'],
        '--skin-surface': tokens['--c-surface'],
        '--skin-text': tokens['--c-text'],
        '--skin-muted': tokens['--c-text-muted'],
        '--skin-primary': tokens['--c-primary'],
        '--skin-secondary': tokens['--c-secondary'],
        '--skin-accent': tokens['--c-accent'],
        '--skin-info': tokens['--c-info'],
        '--skin-border': tokens['--c-border'],
        '--skin-avatar-radius': this.theme.profile.avatarFrame === 'none' ? '50%' : ''
      }
    },
    reportUrl () {
      const title = encodeURIComponent('Report a profile skin: @' + (this.author || this.theme?.author))
      return 'https://github.com/ausbitbank/hive.ausbit.dev-src/issues/new?title=' + title
    }
  },
  methods: {
    hideSkins () {
      this.$appearance.setProfileSkins('off')
      this.$q.notify({
        message: 'Profile skins are off. You can turn them back on in Appearance.',
        color: 'primary',
        timeout: 3000
      })
    },
    stickerIcon (id) {
      return STICKER_ICONS[id] || '✦'
    }
  }
}
</script>
