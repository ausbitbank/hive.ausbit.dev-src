<template>
  <q-page class="theme-page">
    <div class="theme-shell">
      <header class="theme-head">
        <div class="theme-eyebrow">
          <q-icon name="palette" size="15px" aria-hidden="true" />
          Appearance
        </div>
        <h1 class="theme-title">Make the Hive yours</h1>
        <p class="theme-intro">
          Pick a site theme for this device. Themes change colour, type, depth and texture,
          never the layout. Profile skins are chosen by the person whose profile you are visiting.
        </p>
        <q-btn
          class="theme-wall-link"
          outline
          no-caps
          color="primary"
          icon="collections"
          label="Browse the theme wall"
          to="/themes"
        />
      </header>

      <section class="theme-section" aria-labelledby="theme-site-title">
        <div class="theme-section__head">
          <div>
            <h2 id="theme-site-title" class="theme-section__title">Site theme</h2>
            <p class="theme-section__hint">Applies to navigation, tools and every page you open.</p>
          </div>
          <q-btn
            flat
            no-caps
            dense
            icon="restart_alt"
            label="Reset to Hive Dark"
            @click="resetTheme"
          />
        </div>

        <div class="theme-grid" aria-label="Site themes">
          <button
            v-for="item in themes"
            :key="item.id"
            type="button"
            class="theme-card"
            :class="{ 'is-active': item.id === activeThemeId }"
            :aria-pressed="item.id === activeThemeId"
            :style="previewStyle(item)"
            @click="selectTheme(item.id)"
          >
            <span class="theme-card__preview" aria-hidden="true">
              <span class="theme-card__chrome">
                <span class="theme-card__dot"></span>
                <span class="theme-card__dot"></span>
                <span class="theme-card__dot"></span>
                <span class="theme-card__addr"></span>
              </span>
              <span class="theme-card__body">
                <span class="theme-card__line theme-card__line--title"></span>
                <span class="theme-card__line"></span>
                <span class="theme-card__line theme-card__line--short"></span>
                <span class="theme-card__chip"></span>
              </span>
            </span>
            <span class="theme-card__meta">
              <span class="theme-card__name">{{ item.name }}</span>
              <span class="theme-card__badges">
                <span class="theme-card__badge">{{ item.mode === 'light' ? 'Light' : 'Dark' }}</span>
                <span v-if="item.tags.includes('high-contrast')" class="theme-card__badge">High contrast</span>
              </span>
            </span>
            <span class="theme-card__mood">{{ item.mood }}</span>
            <span class="theme-card__swatches" aria-hidden="true">
              <span
                v-for="swatch in swatches(item)"
                :key="swatch"
                class="theme-card__swatch"
                :style="{ background: swatch }"
              ></span>
            </span>
            <span v-if="item.id === activeThemeId" class="theme-card__check">
              <q-icon name="check_circle" size="18px" aria-hidden="true" /> Active
            </span>
          </button>
        </div>
      </section>

      <section class="theme-section" aria-labelledby="theme-options-title">
        <div class="theme-section__head">
          <div>
            <h2 id="theme-options-title" class="theme-section__title">Comfort</h2>
            <p class="theme-section__hint">These choices always win over a profile skin.</p>
          </div>
        </div>

        <div class="theme-options">
          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Follow system appearance</div>
              <div class="theme-option__hint">Use Hive Light when your device is light, Hive Dark when it is dark.</div>
            </div>
            <q-toggle
              :model-value="$appearance.followSystem"
              color="primary"
              aria-label="Follow system appearance"
              @update:model-value="$appearance.setFollowSystem($event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Profile skins</div>
              <div class="theme-option__hint">Let authors style their profile, blog and posts.</div>
            </div>
            <q-select
              :model-value="$appearance.profileSkins"
              :options="skinOptions"
              dense
              outlined
              emit-value
              map-options
              class="theme-option__select"
              aria-label="Profile skin visibility"
              @update:model-value="$appearance.setProfileSkins($event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Motion</div>
              <div class="theme-option__hint">System respects your operating system setting.</div>
            </div>
            <q-select
              :model-value="$appearance.motion"
              :options="motionOptions"
              dense
              outlined
              emit-value
              map-options
              class="theme-option__select"
              aria-label="Motion preference"
              @update:model-value="$appearance.setMotion($event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">High contrast</div>
              <div class="theme-option__hint">Maximum text and border contrast. Author skins are muted.</div>
            </div>
            <q-toggle
              :model-value="$appearance.highContrast"
              color="primary"
              aria-label="High contrast"
              @update:model-value="$appearance.setHighContrast($event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Profile skin effects</div>
              <div class="theme-option__hint">Calm keeps the palette and static atmosphere but removes drift, grain and hover motion.</div>
            </div>
            <q-select
              :model-value="$appearance.skinEffects"
              :options="skinEffectOptions"
              dense
              outlined
              emit-value
              map-options
              class="theme-option__select"
              aria-label="Profile skin effects"
              @update:model-value="$appearance.setSkinEffects($event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Show status lines</div>
              <div class="theme-option__hint">Hide the static status line under an author's name.</div>
            </div>
            <q-toggle
              :model-value="$appearance.showSkinStatus"
              color="primary"
              aria-label="Show profile status lines"
              @update:model-value="$appearance.setShowSkinStatus($event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Show profile extras</div>
              <div class="theme-option__hint">Hide Hive Circle, badges and the latest post card while keeping the look.</div>
            </div>
            <q-toggle
              :model-value="$appearance.showSkinExtras"
              color="primary"
              aria-label="Show profile shelf extras"
              @update:model-value="$appearance.setShowSkinExtras($event)"
            />
          </div>
        </div>
      </section>

      <section id="skin-safety" class="theme-section" aria-labelledby="theme-safety-title">
        <div class="theme-section__head">
          <div>
            <h2 id="theme-safety-title" class="theme-section__title">Skin safety</h2>
            <p class="theme-section__hint">
              Custom skins never load from accounts you mute or accounts with negative reputation.
              If the check cannot run, the site keeps its own theme. You can override any single skin.
            </p>
          </div>
        </div>

        <div class="theme-options">
          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Muted accounts</div>
              <div class="theme-option__hint">Blocked by default. Use “Show this skin anyway” on a profile to allow one author.</div>
            </div>
            <q-icon name="shield" size="20px" color="primary" aria-hidden="true" />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Negative reputation</div>
              <div class="theme-option__hint">Blocked by default. A per-author override is available in the same notice.</div>
            </div>
            <q-icon name="shield" size="20px" color="primary" aria-hidden="true" />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Follows beat mute lists</div>
              <div class="theme-option__hint">Show a followed account's skin even when a mute list you subscribe to includes them.</div>
            </div>
            <q-toggle
              :model-value="moderation.skinSettings.followedMuteListOverride"
              color="primary"
              aria-label="Show skins from accounts I follow when a mute list includes them"
              @update:model-value="moderation.setSkinSetting('followedMuteListOverride', $event)"
            />
          </div>

          <div class="theme-option">
            <div class="theme-option__text">
              <div class="theme-option__label">Trust followed reputation</div>
              <div class="theme-option__hint">Also show skins from accounts you follow when their reputation is negative. Off by default.</div>
            </div>
            <q-toggle
              :model-value="moderation.skinSettings.followedReputationOverride"
              color="primary"
              aria-label="Show skins from followed accounts with negative reputation"
              @update:model-value="moderation.setSkinSetting('followedReputationOverride', $event)"
            />
          </div>
        </div>

        <p class="theme-section__hint" role="status">{{ moderationContextNote }}</p>

        <div v-if="shownSkinAuthors.length" class="theme-ignored">
          <p class="theme-section__hint">Skins you chose to show anyway:</p>
          <ul class="theme-ignored">
            <li v-for="author in shownSkinAuthors" :key="author" class="theme-ignored__row">
              <router-link :to="'/@' + author" class="theme-ignored__author">@{{ author }}</router-link>
              <q-btn
                flat
                dense
                no-caps
                icon="shield"
                label="Use default safety"
                :aria-label="'Use default skin safety for @' + author"
                @click="clearSkinOverride(author)"
              />
            </li>
          </ul>
        </div>
      </section>

      <section v-if="customThemeActive" class="theme-section" aria-labelledby="theme-adopted-title">
        <div class="theme-section__head">
          <div>
            <h2 id="theme-adopted-title" class="theme-section__title">Adopted palette</h2>
            <p class="theme-section__hint">Stored only on this device. The author's on-chain skin is unchanged.</p>
          </div>
          <q-btn flat dense no-caps icon="undo" label="Use Hive Dark" @click="clearAdopted" />
        </div>
        <div class="theme-adopted" :style="previewStyle($appearance.customTheme)">
          <span class="theme-adopted__swatches" aria-hidden="true">
            <span v-for="swatch in swatches($appearance.customTheme)" :key="swatch" :style="{ background: swatch }"></span>
          </span>
          <span>
            <strong>{{ $appearance.customTheme.name }}</strong>
            <span class="theme-adopted__mood">{{ $appearance.customTheme.mood }}</span>
          </span>
        </div>
      </section>

      <section
        v-if="ignoredSkinAuthors.length"
        class="theme-section"
        aria-labelledby="theme-ignored-title"
      >
        <div class="theme-section__head">
          <div>
            <h2 id="theme-ignored-title" class="theme-section__title">Ignored profile skins</h2>
            <p class="theme-section__hint">These authors' skins are hidden on their profile, blog and posts.</p>
          </div>
        </div>
        <ul class="theme-ignored">
          <li v-for="author in ignoredSkinAuthors" :key="author" class="theme-ignored__row">
            <router-link :to="'/@' + author" class="theme-ignored__author">@{{ author }}</router-link>
            <q-btn
              flat
              dense
              no-caps
              icon="undo"
              label="Show again"
              :aria-label="'Show skins by @' + author + ' again'"
              @click="restoreSkin(author)"
            />
          </li>
        </ul>
      </section>

      <section class="theme-section theme-section--profile" aria-labelledby="theme-profile-title">
        <div class="theme-section__head">
          <div>
            <h2 id="theme-profile-title" class="theme-section__title">Your profile skin</h2>
            <p class="theme-section__hint">
              Publish a palette, backdrop, avatar frame and nameplate to your Hive account.
              It is public metadata, like your profile picture.
            </p>
          </div>
          <q-btn
            v-if="loggedIn"
            unelevated
            no-caps
            color="primary"
            icon="brush"
            label="Open Skin Studio"
            to="/settings/skin"
          />
          <span v-else class="theme-signin-hint">
            <q-icon name="login" size="16px" aria-hidden="true" />
            Sign in from the top bar to publish a skin.
          </span>
        </div>
      </section>
    </div>
  </q-page>
</template>

<style scoped>
.theme-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.theme-shell {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.theme-head {
  margin-bottom: var(--space-5);
}

.theme-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.theme-title {
  margin: 0.35rem 0 0.4rem;
  font-size: clamp(1.7rem, 3.4vw, 2.3rem);
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.1;
}

.theme-intro {
  max-width: 70ch;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.94rem;
  line-height: 1.55;
}

.theme-wall-link {
  margin-top: 0.9rem;
}

.theme-section {
  margin-top: var(--space-5);
}

.theme-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.theme-section__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.theme-section__hint {
  max-width: 70ch;
  margin: 0.2rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.45;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-3);
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface);
  color: var(--c-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border-subtle));
  box-shadow: var(--shadow-card);
}

.theme-card.is-active {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-primary) 24%, transparent);
}

.theme-card__preview {
  display: block;
  overflow: hidden;
  border: 1px solid var(--preview-border);
  border-radius: calc(var(--radius-card) - 2px);
  background: var(--preview-bg);
}

.theme-card__chrome {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--preview-border);
  background: var(--preview-surface);
}

.theme-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--preview-accent);
  opacity: 0.7;
}

.theme-card__addr {
  flex: 1;
  height: 5px;
  margin-left: 4px;
  border-radius: 999px;
  background: var(--preview-border);
}

.theme-card__body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 10px;
}

.theme-card__line {
  display: block;
  height: 5px;
  border-radius: 999px;
  background: var(--preview-muted);
  opacity: 0.45;
}

.theme-card__line--title {
  width: 62%;
  height: 8px;
  background: var(--preview-text);
  opacity: 0.82;
}

.theme-card__line--short {
  width: 44%;
}

.theme-card__chip {
  width: 34%;
  height: 10px;
  margin-top: 3px;
  border-radius: 999px;
  background: var(--preview-primary);
}

.theme-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.theme-card__name {
  font-size: 0.88rem;
  font-weight: 600;
}

.theme-card__badges {
  display: flex;
  gap: 0.25rem;
}

.theme-card__badge {
  padding: 0.08rem 0.34rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-faint);
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.theme-card__mood {
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  line-height: 1.35;
}

.theme-card__swatches {
  display: flex;
  gap: 4px;
  margin-top: auto;
  padding-top: 0.2rem;
}

.theme-card__swatch {
  width: 18px;
  height: 18px;
  border: 1px solid var(--c-border-subtle);
  border-radius: 50%;
}

.theme-card__check {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.12rem 0.4rem;
  border-radius: var(--radius-pill);
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-size: 0.62rem;
  font-weight: 700;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--space-3);
}

.theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface);
}

.theme-option__text {
  min-width: 0;
}

.theme-option__label {
  font-size: 0.84rem;
  font-weight: 600;
}

.theme-option__hint {
  margin-top: 0.1rem;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  line-height: 1.4;
}

.theme-option__select {
  flex: 0 0 170px;
  min-width: 150px;
}

.theme-ignored {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.theme-ignored__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
}

.theme-ignored__author {
  color: var(--c-link);
  font-weight: 600;
}

.theme-adopted {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--preview-border, var(--c-border-subtle));
  border-radius: var(--radius-card);
  background: var(--preview-bg, var(--c-surface));
  color: var(--preview-text, var(--c-text));
}

.theme-adopted__swatches {
  display: flex;
  gap: 3px;
}

.theme-adopted__swatches span {
  width: 20px;
  height: 20px;
  border: 1px solid var(--c-border-subtle);
  border-radius: 50%;
}

.theme-adopted__mood {
  display: block;
  color: var(--preview-muted, var(--c-text-muted));
  font-size: 0.72rem;
}

.theme-signin-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.theme-section--profile {
  padding: 1rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--c-primary) 8%, transparent), transparent 55%),
    var(--c-surface);
}

@media (max-width: 599px) {
  .theme-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .theme-option {
    align-items: flex-start;
    flex-direction: column;
  }

  .theme-option__select {
    flex: 0 0 auto;
    width: 100%;
  }
}
</style>

<script>
import { THEMES, DEFAULT_THEME_ID } from 'src/themes/registry'
import { setPageMeta } from 'src/utils/pageMeta'
import { useModerationStore } from 'src/stores/moderation'

export default {
  name: 'AppearancePage',
  mounted () {
    setPageMeta({
      title: 'Appearance — themes and profile skins — banksia.io',
      description: 'Choose a site theme, follow your system appearance, and control profile skins, motion and contrast on banksia.io.',
      url: '/appearance'
    })
    this.syncModeration()
  },
  data () {
    return {
      themes: THEMES,
      skinOptions: [
        { label: 'Show on profiles, blogs and posts', value: 'on' },
        { label: 'Only on profile and blog pages', value: 'profile' },
        { label: 'Never show profile skins', value: 'off' }
      ],
      motionOptions: [
        { label: 'Follow system', value: 'system' },
        { label: 'Reduce motion', value: 'reduced' },
        { label: 'Allow full motion', value: 'full' }
      ],
      skinEffectOptions: [
        { label: 'Full effects', value: 'full' },
        { label: 'Calm effects', value: 'calm' }
      ]
    }
  },
  computed: {
    activeThemeId () {
      return this.$appearance.effectiveThemeId
    },
    loggedIn () {
      return Boolean(this.$hiveStore.user.username)
    },
    moderation () {
      return useModerationStore()
    },
    ignoredSkinAuthors () {
      return this.$appearance.ignoredSkinAuthors
    },
    customThemeActive () {
      return this.$appearance.customThemeActive
    },
    shownSkinAuthors () {
      return this.moderation.skinShowAuthors || []
    },
    moderationContextNote () {
      const moderation = this.moderation
      if (!moderation) return ''
      if (!this.loggedIn) {
        return 'Sign in to apply your Hive mute list. Reputation checks still apply while signed out.'
      }
      if (moderation.context.status === 'loading' || moderation.context.status === 'idle') {
        return 'Checking your Hive mute list…'
      }
      if (moderation.context.status === 'error') {
        return 'Your mute list could not be loaded, so custom skins stay on the built-in theme until it can be checked.'
      }
      const muted = moderation.context.muted.length
      const lists = moderation.context.followedMuteOwners.length
      const base = 'Checked ' + muted + ' muted account' + (muted === 1 ? '' : 's') +
        ' and ' + lists + ' followed mute list' + (lists === 1 ? '' : 's') + '.'
      const errors = Number(moderation.context.listErrors) || 0
      if (errors > 0) {
        return base + ' ' + errors + ' followed list' + (errors === 1 ? '' : 's') +
          ' could not be read, so some authors may stay on the built-in theme.'
      }
      return base
    }
  },
  watch: {
    '$hiveStore.user.username' () {
      this.syncModeration()
    }
  },
  methods: {
    selectTheme (id) {
      this.$appearance.setTheme(id)
    },
    clearAdopted () {
      this.$appearance.clearCustomTheme()
      this.$q.notify({ message: 'Adopted palette removed.', color: 'primary', timeout: 1800 })
    },
    resetTheme () {
      this.$appearance.setTheme(DEFAULT_THEME_ID)
      this.$q.notify({ message: 'Back to Hive Dark.', color: 'primary', timeout: 1600 })
    },
    restoreSkin (author) {
      this.$appearance.unignoreSkinAuthor(author)
    },
    syncModeration () {
      this.moderation.setScope(this.$hiveStore.user.username || 'guest')
      this.moderation.ensureContext()
    },
    clearSkinOverride (author) {
      this.moderation.clearSkinOverride(author)
      this.$q.notify({
        message: 'Default skin safety restored for @' + author + '.',
        color: 'primary',
        timeout: 2200
      })
    },
    previewStyle (theme) {
      const t = theme.tokens
      return {
        '--preview-bg': t.bg,
        '--preview-surface': t.surface,
        '--preview-text': t.text,
        '--preview-muted': t.muted,
        '--preview-primary': t.primary,
        '--preview-accent': t.accent,
        '--preview-border': t.border
      }
    },
    swatches (theme) {
      return [theme.tokens.bg, theme.tokens.surface, theme.tokens.primary, theme.tokens.accent, theme.tokens.text]
    }
  }
}
</script>
