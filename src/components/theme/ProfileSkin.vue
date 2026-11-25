<template>
  <div
    v-if="visible"
    class="skin-scope"
    :class="{ 'skin-scope--preview': preview }"
    :data-skin-background="theme.profile.background"
    :data-avatar-frame="theme.profile.avatarFrame"
    :data-nameplate="theme.profile.nameplate"
    :data-card="theme.profile.card"
    :data-skin-link="theme.profile.visual.link"
    :data-skin-button="theme.profile.visual.button"
    :data-skin-chip="theme.profile.visual.chip"
    :data-skin-divider="theme.profile.visual.divider"
    :data-skin-image="theme.profile.visual.image"
    :data-skin-gradient="theme.profile.visual.gradient"
    :data-skin-motion="motion"
    :data-skin-effects="calm ? 'calm' : 'full'"
    :style="skinStyle"
  >
    <atmosphere :theme="theme" :account="account" :calm="calm" />

    <div class="skin-badge" aria-label="Profile skin">
      <span v-if="preview" class="skin-badge__label">
        <q-icon name="visibility" size="14px" aria-hidden="true" />
        Previewing your skin
      </span>
      <span v-else class="skin-badge__label">
        <q-icon name="palette" size="14px" aria-hidden="true" />
        Skin by
        <router-link v-if="authorLabel" :to="'/@' + authorLabel">@{{ authorLabel }}</router-link>
        <span v-else>an unknown account</span>
      </span>
      <span v-if="theme.remixedFrom" class="skin-badge__note">
        remixed from <router-link :to="'/@' + theme.remixedFrom">@{{ theme.remixedFrom }}</router-link>
      </span>
      <span v-if="authorMismatch" class="skin-badge__note skin-badge__note--warning">
        Theme credits @{{ themeAuthor }}, but the metadata belongs to @{{ authorKey }}.
      </span>
      <span v-if="skinDecision.conflict" class="skin-badge__note">
        On @{{ skinDecision.conflict.owners.join(', @') }}'s mute list; shown because you follow @{{ authorKey }}.
      </span>
      <span v-if="skinDecision.code === 'viewer-show'" class="skin-badge__note">
        Shown by your local override.
      </span>
      <template v-if="!preview">
        <button type="button" class="skin-badge__action" @click="ignoreSkin">Ignore this skin</button>
        <button type="button" class="skin-badge__action" @click="hideSkins">Hide all skins</button>
        <button
          v-if="skinDecision.code === 'viewer-show'"
          type="button"
          class="skin-badge__action"
          @click="clearOverride"
        >
          Use default safety
        </button>
      </template>
    </div>

    <slot :theme="theme" :calm="calm" :visible="visible" />
  </div>
  <template v-else>
    <skin-safety-notice
      v-if="blocked"
      :decision="skinDecision"
      :preview="preview"
      :has-moderation="Boolean(moderation)"
      :can-follow-override="canFollowOverride"
      @preview="previewAnyway"
      @show="showAnyway"
      @enable-followed="enableFollowedOverride"
    />
    <slot :theme="null" :calm="false" :visible="false" />
  </template>
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

.skin-badge__note--warning {
  color: var(--c-warning);
}

.skin-badge__action {
  margin-left: 0.1rem;
}

.skin-badge__action + .skin-badge__action {
  margin-left: 0.6rem;
}

.skin-scope--preview {
  border: 1px dashed var(--c-border-strong);
  border-radius: var(--radius-card);
  overflow: hidden;
}

</style>

<script>
import { defineAsyncComponent, h } from 'vue'
import Atmosphere from 'components/theme/Atmosphere.vue'
import { readAccountTheme } from 'src/themes/account'
import { loadModerationStore } from 'src/services/moderationStoreLoader'
import { quasarVarsFor, tokensFor } from 'src/themes/tokens'

function normalizeAuthor (value) {
  return String(value ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .slice(0, 16)
}

const EMPTY_DECISION = {
  allowed: true,
  code: 'allowed',
  label: '',
  detail: '',
  owners: [],
  overrides: []
}

const LOADING_DECISION = {
  allowed: false,
  code: 'context-unavailable',
  label: '',
  detail: '',
  owners: [],
  overrides: []
}

const UNAVAILABLE_DECISION = {
  allowed: false,
  code: 'context-unavailable',
  label: 'Skin hidden: the safety check could not load',
  detail: 'The built-in theme stays in place. Reload the page to try again.',
  owners: [],
  overrides: []
}

// A lazy chunk can fail to load when the device is offline or a tab is still
// open from an older deploy. The skin stays hidden either way, so explain that
// instead of letting the rejection blank the whole view via the error boundary.
const SkinSafetyNoticeFallback = {
  name: 'SkinSafetyNoticeFallback',
  render () {
    return h('section', {
      class: 'skin-blocked',
      role: 'status',
      'aria-label': 'Profile skin hidden',
      style: 'margin:1rem 0;padding:1rem;border:1px solid var(--c-border);border-radius:var(--radius-card);background:var(--c-surface-2);color:var(--c-text)'
    }, [
      h('p', { style: 'margin:0;font-weight:600' }, 'Profile skin hidden'),
      h('p', { style: 'margin:.25rem 0 0;color:var(--c-text-muted)' }, 'The safety notice could not load. The skin stays hidden; reload when you are back online.')
    ])
  }
}

export default {
  name: 'ProfileSkin',
  components: {
    Atmosphere,
    SkinSafetyNotice: defineAsyncComponent(() =>
      import('components/theme/SkinSafetyNotice.vue').catch(() => SkinSafetyNoticeFallback)
    )
  },
  props: {
    account: { type: Object, default: null },
    author: { type: String, default: '' },
    context: { type: String, default: 'profile' },
    previewTheme: { type: Object, default: null },
    enabled: { type: Boolean, default: true },
    reputation: { type: [Number, String], default: null }
  },
  data () {
    return {
      previewOverride: false,
      moderation: null,
      moderationError: false
    }
  },
  computed: {
    preview () {
      return Boolean(this.previewTheme)
    },
    loggedInUser () {
      return this.$hiveStore?.user?.username || ''
    },
    theme () {
      if (this.previewTheme) return this.previewTheme
      return readAccountTheme(this.account).theme
    },
    authorKey () {
      const owner = this.author || (this.account && this.account.name)
      if (owner) return normalizeAuthor(owner)
      // Never use a self-declared theme author for a safety decision. It is
      // only a display fallback in an explicit Studio preview.
      return this.preview ? normalizeAuthor(this.theme?.author) : ''
    },
    themeAuthor () {
      return normalizeAuthor(this.theme?.author)
    },
    authorLabel () {
      return this.authorKey || this.themeAuthor
    },
    authorMismatch () {
      return Boolean(this.themeAuthor && this.authorKey && this.themeAuthor !== this.authorKey)
    },
    skinDecision () {
      if (!this.theme) return EMPTY_DECISION
      if (!this.moderation) return this.moderationError ? UNAVAILABLE_DECISION : LOADING_DECISION
      const owner = this.preview
        ? (this.author || (this.account && this.account.name) || this.theme?.author)
        : (this.author || (this.account && this.account.name))
      return this.moderation.decisionForSkin({
        author: owner,
        account: this.account,
        reputation: this.reputation
      })
    },
    userHidden () {
      if (this.preview) return false
      const appearance = this.$appearance
      if (!appearance) return false
      if (appearance.highContrast) return true
      if (this.authorKey && appearance.ignoredSkinAuthors.includes(this.authorKey)) return true
      if (appearance.profileSkins === 'off') return true
      if (appearance.profileSkins === 'profile' && this.context === 'post') return true
      return false
    },
    visible () {
      if (!this.enabled || !this.theme) return false
      if (this.userHidden) return false
      const allowed = Boolean(this.skinDecision && this.skinDecision.allowed)
      if (this.preview) return this.previewOverride || allowed
      return allowed
    },
    contextPending () {
      if (!this.moderation) return !this.moderationError
      const status = this.moderation.context?.status
      return status === 'idle' || status === 'loading'
    },
    blocked () {
      if (!this.enabled || !this.theme || this.userHidden || this.visible) return false
      if (this.previewOverride) return false
      // While the first check is in flight, keep the built-in theme without
      // claiming the skin is blocked. A failure (status `error`) does show the
      // explanation, because the check will not resolve on its own.
      if (this.contextPending) return false
      return Boolean(this.skinDecision && !this.skinDecision.allowed)
    },
    canFollowOverride () {
      if (!this.moderation || !this.authorKey) return false
      const overrides = this.skinDecision?.overrides || []
      return overrides.includes('followed-override') && this.moderation.isFollowing(this.authorKey)
    },
    calm () {
      return Boolean(this.$appearance.skinCalm)
    },
    viewerMode () {
      return this.$appearance.isDark ? 'dark' : 'light'
    },
    motion () {
      if (this.calm) return 'none'
      return this.theme.profile.background === 'solid' ? 'none' : (this.theme.effects.ambient === 'none' ? 'none' : this.theme.effects.ambient)
    },
    skinStyle () {
      if (!this.theme) return {}
      const tokens = tokensFor(this.theme, { mode: this.viewerMode })
      const quasar = quasarVarsFor(this.theme, { mode: this.viewerMode })
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
    }
  },
  mounted () {
    if (this.theme) this.attachModeration()
  },
  watch: {
    theme (value) {
      if (value) this.attachModeration()
    },
    previewTheme () {
      this.previewOverride = false
    },
    author () {
      this.previewOverride = false
    },
    loggedInUser () {
      this.attachModeration()
    }
  },
  methods: {
    attachModeration () {
      const username = this.loggedInUser
      loadModerationStore()
        .then(store => {
          this.moderation = store
          this.moderationError = false
          store.setScope(username || 'guest')
          store.ensureContext()
        })
        .catch(() => {
          this.moderation = null
          this.moderationError = true
        })
    },
    previewAnyway () {
      this.previewOverride = true
    },
    showAnyway () {
      if (!this.authorKey || !this.moderation) return
      this.moderation.showSkinAuthor(this.authorKey)
      this.$q.notify({
        message: 'Skin shown. You can change this in Appearance.',
        color: 'primary',
        timeout: 3000
      })
    },
    enableFollowedOverride () {
      if (!this.moderation) return
      this.moderation.setFollowedOverrides(true)
      this.$q.notify({
        message: 'Skins from accounts you follow will now be shown.',
        color: 'primary',
        timeout: 3000
      })
    },
    clearOverride () {
      if (!this.authorKey || !this.moderation) return
      this.moderation.clearSkinOverride(this.authorKey)
      this.$q.notify({
        message: 'Default skin safety restored for @' + this.authorKey + '.',
        color: 'primary',
        timeout: 3000
      })
    },
    ignoreSkin () {
      if (!this.authorKey) return
      this.$appearance.ignoreSkinAuthor(this.authorKey)
      this.$q.notify({
        message: 'Skin hidden. You can restore it from Appearance.',
        color: 'primary',
        timeout: 3000
      })
    },
    hideSkins () {
      this.$appearance.setProfileSkins('off')
      this.$q.notify({
        message: 'Profile skins are off. You can turn them back on in Appearance.',
        color: 'primary',
        timeout: 3000
      })
    }
  }
}
</script>
