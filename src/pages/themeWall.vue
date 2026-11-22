<template>
  <q-page class="wall-page">
    <div class="wall-shell">
      <header class="wall-head">
        <div>
          <div class="wall-eyebrow">
            <q-icon name="collections" size="15px" aria-hidden="true" />
            Theme wall
          </div>
          <h1 class="wall-title">Looks from the Hive</h1>
          <p class="wall-intro">
            Built-in themes you can apply to this device, plus skins published by accounts
            you follow. Profile skins are public on-chain metadata.
          </p>
        </div>
        <q-btn flat no-caps icon="palette" label="Appearance" to="/appearance" />
      </header>

      <q-tabs
        v-model="tab"
        dense
        no-caps
        class="wall-tabs"
        active-color="primary"
        indicator-color="primary"
        align="left"
        aria-label="Theme wall sections"
      >
        <q-tab name="built-in" label="Built-in themes" icon="invert_colors" />
        <q-tab name="following" label="Following" icon="people" />
      </q-tabs>

      <q-tab-panels v-model="tab" animated class="wall-panels">
        <q-tab-panel name="built-in">
          <div class="wall-grid">
            <button
              v-for="theme in builtIn"
              :key="theme.id"
              type="button"
              class="wall-card"
              :class="{ 'is-active': theme.id === activeThemeId }"
              :aria-pressed="theme.id === activeThemeId"
              :style="styleFor(theme)"
              @click="applyTheme(theme.id)"
            >
              <span class="wall-card__swatches" aria-hidden="true">
                <span v-for="swatch in swatches(theme)" :key="swatch" :style="{ background: swatch }"></span>
              </span>
              <span class="wall-card__body">
                <span class="wall-card__name">{{ theme.name }}</span>
                <span class="wall-card__mode">{{ theme.mode === 'light' ? 'Light' : 'Dark' }} · {{ theme.mood }}</span>
                <span class="wall-card__mood">{{ theme.description }}</span>
              </span>
              <span class="wall-card__action">
                {{ theme.id === activeThemeId ? 'Active' : 'Use this theme' }}
                <q-icon :name="theme.id === activeThemeId ? 'check_circle' : 'arrow_forward'" size="15px" aria-hidden="true" />
              </span>
            </button>
          </div>
        </q-tab-panel>

        <q-tab-panel name="following">
          <div v-if="!loggedIn" class="wall-empty">
            <q-icon name="login" size="2rem" color="primary" aria-hidden="true" />
            <h2>Sign in to see skins from people you follow</h2>
            <p>The wall reads public profile metadata from the accounts you follow. No extra service is involved.</p>
          </div>

          <div v-else class="wall-following">
            <div class="wall-following__head">
              <p class="wall-following__hint">
                {{ loading ? 'Reading profile metadata…' : skins.length ? skins.length + ' published skins from people you follow.' : 'No published skins found in your following list yet.' }}
              </p>
              <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="loadFollowing(true)" />
            </div>

            <div v-if="error" class="wall-error" role="alert">{{ error }}</div>

            <div v-if="skins.length" class="wall-grid">
              <article v-for="item in skins" :key="item.account.name" class="wall-card wall-card--skin" :style="styleFor(item.theme)">
                <span class="wall-card__swatches" aria-hidden="true">
                  <span v-for="swatch in swatches(item.theme)" :key="swatch" :style="{ background: swatch }"></span>
                </span>
                <span class="wall-card__body">
                  <span class="wall-card__person">
                    <q-avatar size="24px">
                      <q-img :src="avatarFor(item.account.name)" :alt="'Avatar of @' + item.account.name" />
                    </q-avatar>
                    <span>@{{ item.account.name }}</span>
                  </span>
                  <span class="wall-card__name">{{ item.theme.name }}</span>
                  <span class="wall-card__mode">{{ item.theme.mode === 'light' ? 'Light' : 'Dark' }} · {{ item.theme.mood }}</span>
                  <span class="wall-card__mood">{{ item.theme.description }}</span>
                </span>
                <router-link class="wall-card__action" :to="'/@' + item.account.name">
                  Visit profile
                  <q-icon name="arrow_forward" size="15px" aria-hidden="true" />
                </router-link>
              </article>
            </div>

            <div v-else-if="!loading" class="wall-empty wall-empty--small">
              <q-icon name="palette" size="1.6rem" aria-hidden="true" />
              <h2>No skins here yet</h2>
              <p>When someone you follow publishes a skin, it will appear here. You can be first.</p>
              <q-btn unelevated no-caps color="primary" icon="brush" label="Open Skin Studio" to="/settings/skin" />
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </q-page>
</template>

<style scoped>
.wall-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.wall-shell {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.wall-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.wall-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.wall-title {
  margin: 0.3rem 0;
  font-size: clamp(1.7rem, 3.2vw, 2.2rem);
  font-weight: 650;
  letter-spacing: -0.025em;
}

.wall-intro {
  max-width: 72ch;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.wall-tabs {
  border-bottom: 1px solid var(--c-border-subtle);
}

.wall-panels {
  background: transparent;
}

.wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: var(--space-3);
}

.wall-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
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

.wall-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border-subtle));
  box-shadow: var(--shadow-card);
}

.wall-card.is-active {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-primary) 24%, transparent);
}

.wall-card--skin {
  cursor: default;
}

.wall-card__swatches {
  display: flex;
  overflow: hidden;
  height: 54px;
  border-radius: calc(var(--radius-card) - 2px);
}

.wall-card__swatches span {
  flex: 1;
}

.wall-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.wall-card__person {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.15rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.wall-card__name {
  font-size: 0.9rem;
  font-weight: 650;
}

.wall-card__mode {
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.wall-card__mood {
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  line-height: 1.4;
}

.wall-card__action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: auto;
  padding-top: 0.3rem;
  color: var(--c-primary);
  font-size: 0.74rem;
  font-weight: 700;
  text-decoration: none;
}

.wall-card__action:hover {
  color: var(--c-link-hover);
  text-decoration: none;
}

.wall-following__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.wall-following__hint {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.wall-error {
  margin-bottom: var(--space-3);
  padding: 0.6rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--c-negative) 40%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-negative) 8%, transparent);
  color: var(--c-negative);
  font-size: 0.78rem;
}

.wall-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 2.4rem 1rem;
  text-align: center;
}

.wall-empty h2 {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
}

.wall-empty p {
  max-width: 56ch;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.wall-empty--small {
  padding: 1.6rem 1rem;
}

@media (max-width: 599px) {
  .wall-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>

<script>
import { fetchAccounts, fetchFollowingNames } from 'src/services/chainData'
import { readAccountTheme } from 'src/themes/account'
import { THEMES, getTheme } from 'src/themes/registry'
import { tokensFor } from 'src/themes/tokens'
import { hiveAvatarUrl } from 'src/utils/avatar'
import { setPageMeta } from 'src/utils/pageMeta'

export default {
  name: 'ThemeWall',
  mounted () {
    setPageMeta({
      title: 'Theme Wall — looks from the Hive',
      description: 'Built-in Hive themes and profile skins published by accounts you follow on hive.ausbit.dev.',
      url: '/themes'
    })
  },
  data () {
    return {
      tab: 'built-in',
      builtIn: THEMES,
      skins: [],
      loading: false,
      error: '',
      loadedFor: ''
    }
  },
  computed: {
    activeThemeId () {
      return this.$appearance.effectiveThemeId
    },
    loggedIn () {
      return Boolean(this.$hiveStore.user.username)
    },
    username () {
      return this.$hiveStore.user.username || ''
    }
  },
  watch: {
    tab (value) {
      if (value === 'following' && this.loggedIn && this.loadedFor !== this.username) {
        this.loadFollowing(false)
      }
    }
  },
  methods: {
    styleFor (theme) {
      const tokens = tokensFor(theme)
      return {
        '--wall-bg': tokens['--c-bg'],
        '--wall-surface': tokens['--c-surface'],
        '--wall-primary': tokens['--c-primary'],
        '--wall-accent': tokens['--c-accent']
      }
    },
    swatches (theme) {
      return [theme.tokens.bg, theme.tokens.surface, theme.tokens.primary, theme.tokens.secondary, theme.tokens.accent, theme.tokens.text]
    },
    applyTheme (id) {
      this.$appearance.setTheme(id)
      this.$q.notify({ message: getTheme(id).name + ' applied.', color: 'primary', timeout: 1600 })
    },
    avatarFor (account) {
      return hiveAvatarUrl(account, 'small')
    },
    async loadFollowing (force) {
      if (!this.username) return
      this.loading = true
      this.error = ''
      try {
        const names = await fetchFollowingNames(this.username, { force })
        const wanted = names.slice(0, 80)
        if (!wanted.length) {
          this.skins = []
          this.loadedFor = this.username
          return
        }
        const accounts = await fetchAccounts(wanted, { force })
        const rows = []
        for (const account of accounts || []) {
          const result = readAccountTheme(account)
          if (result.theme) rows.push({ account, theme: result.theme })
        }
        rows.sort((a, b) => a.account.name.localeCompare(b.account.name))
        this.skins = rows
        this.loadedFor = this.username
      } catch (error) {
        this.error = error?.message || 'Could not read the following list.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
