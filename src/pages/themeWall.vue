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

      <div class="wall-filters">
        <q-input v-model="search" dense outlined clearable label="Search author or theme" class="wall-filters__search">
          <template #prepend><q-icon name="search" aria-hidden="true" /></template>
        </q-input>
        <q-select v-model="modeFilter" :options="modeOptions" dense outlined emit-value map-options label="Mode" class="wall-filters__select" />
        <q-select v-model="tagFilter" :options="tagOptions" dense outlined emit-value map-options label="Tag" class="wall-filters__select" />
        <q-select v-model="kindFilter" :options="kindOptions" dense outlined emit-value map-options label="Kind" class="wall-filters__select" />
      </div>

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
        <q-tab name="recent" label="Recent" icon="schedule" />
        <q-tab name="featured" label="Featured" icon="star" />
      </q-tabs>

      <q-tab-panels v-model="tab" animated class="wall-panels">
        <q-tab-panel name="built-in">
          <div v-if="filteredBuiltIn.length" class="wall-grid">
            <button
              v-for="theme in filteredBuiltIn"
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
          <div v-else class="wall-empty wall-empty--small">
            <q-icon name="filter_alt_off" size="1.6rem" aria-hidden="true" />
            <h2>No built-in themes match</h2>
            <p>Clear the filters to see all ten themes.</p>
          </div>
        </q-tab-panel>

        <q-tab-panel v-for="panel in ['following', 'recent', 'featured']" :key="panel" :name="panel">
          <div v-if="!loggedIn" class="wall-empty">
            <q-icon name="login" size="2rem" color="primary" aria-hidden="true" />
            <h2>Sign in to see skins from people you follow</h2>
            <p>The wall reads public profile metadata from the accounts you follow. No extra service is involved.</p>
          </div>

          <div v-else class="wall-following">
            <div class="wall-following__head">
              <p class="wall-following__hint">
                {{ loading ? 'Reading profile metadata…' : visibleSkins.length ? visibleSkins.length + ' published skins in this view.' : 'No published skins match this view yet.' }}
              </p>
              <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="loadFollowing(true)" />
            </div>

            <div v-if="error" class="wall-error" role="alert">{{ error }}</div>

            <div v-if="visibleSkins.length" class="wall-grid">
              <article v-for="item in visibleSkins" :key="item.account.name" class="wall-card wall-card--skin" :style="styleFor(item.theme)">
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
                  <span v-if="credentialLabel(item.theme)" class="wall-card__verified">
                    <q-icon name="verified" size="13px" aria-hidden="true" />
                    {{ credentialLabel(item.theme) }}
                  </span>
                </span>
                <span class="wall-card__actions">
                  <q-btn flat dense no-caps icon="tune" label="Remix" @click="remixSkin(item)" />
                  <q-btn flat dense no-caps icon="palette" label="Use palette" @click="openAdopt(item)" />
                  <router-link class="wall-card__action" :to="'/@' + item.account.name">
                    Visit
                    <q-icon name="arrow_forward" size="15px" aria-hidden="true" />
                  </router-link>
                </span>
              </article>
            </div>

            <div v-else-if="!loading" class="wall-empty wall-empty--small">
              <q-icon name="palette" size="1.6rem" aria-hidden="true" />
              <h2>No skins here yet</h2>
              <p>When someone you follow publishes a skin that matches this view, it will appear here.</p>
              <q-btn unelevated no-caps color="primary" icon="brush" label="Open Skin Studio" to="/settings/skin" />
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>

      <q-dialog v-model="adoptOpen">
        <q-card class="wall-dialog">
          <q-card-section>
            <div class="wall-eyebrow">Adopt palette</div>
            <h2 class="wall-dialog__title">Use this palette on this device?</h2>
            <p class="wall-dialog__text">
              This previews {{ adoptItem?.theme?.name }} as your site theme. The author's published skin is not changed.
            </p>
            <div v-if="adoptItem" class="wall-adopt-preview" :style="previewVars(adoptItem.theme)">
              <span class="wall-adopt-preview__swatches" aria-hidden="true">
                <span v-for="swatch in swatches(adoptItem.theme)" :key="swatch" :style="{ background: swatch }"></span>
              </span>
              <span>
                <strong>{{ adoptItem.theme.name }}</strong>
                <span class="wall-adopt-preview__meta">@{{ adoptItem.account.name }} · {{ adoptItem.theme.mode === 'light' ? 'Light' : 'Dark' }}</span>
              </span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancel" v-close-popup />
            <q-btn unelevated no-caps color="primary" icon="palette" label="Use this palette" @click="confirmAdopt" />
          </q-card-actions>
        </q-card>
      </q-dialog>
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

.wall-filters {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) repeat(3, minmax(120px, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.wall-filters__search,
.wall-filters__select {
  min-width: 0;
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

.wall-card__verified {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--c-positive);
  font-size: 0.68rem;
  font-weight: 650;
}

.wall-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
  margin-top: auto;
  padding-top: 0.3rem;
}

.wall-card__actions .q-btn {
  font-size: 0.72rem;
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

.wall-card__actions .wall-card__action {
  margin-top: 0;
  padding-top: 0;
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

.wall-dialog {
  width: min(520px, 94vw);
  background: var(--c-surface);
}

.wall-dialog__title {
  margin: 0.2rem 0 0.4rem;
  font-size: 1.05rem;
}

.wall-dialog__text {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.wall-adopt-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
  background: var(--wall-bg);
  color: var(--c-text);
}

.wall-adopt-preview__swatches {
  display: flex;
  gap: 3px;
}

.wall-adopt-preview__swatches span {
  width: 20px;
  height: 20px;
  border: 1px solid var(--c-border-subtle);
  border-radius: 50%;
}

.wall-adopt-preview__meta {
  display: block;
  color: var(--c-text-muted);
  font-size: 0.72rem;
}

@media (max-width: 599px) {
  .wall-filters {
    grid-template-columns: 1fr;
  }

  .wall-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>

<script>
import { fetchAccounts, fetchFollowingNames } from 'src/services/chainData'
import { isCredentialBadge } from 'src/data/badges/credentials'
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
      loadedFor: '',
      search: '',
      modeFilter: 'all',
      tagFilter: 'all',
      kindFilter: 'all',
      modeOptions: [
        { label: 'Any mode', value: 'all' },
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' }
      ],
      kindOptions: [
        { label: 'Any kind', value: 'all' },
        { label: 'Credential', value: 'credential' },
        { label: 'Achievement', value: 'achievement' },
        { label: 'Minimal', value: 'minimal' }
      ],
      adoptOpen: false,
      adoptItem: null
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
    },
    tagOptions () {
      const tags = new Set()
      for (const theme of [...this.builtIn, ...this.skins.map(item => item.theme)]) {
        for (const tag of Array.isArray(theme.tags) ? theme.tags : []) tags.add(tag)
      }
      return [{ label: 'Any tag', value: 'all' }, ...[...tags].sort().map(tag => ({ label: tag, value: tag }))]
    },
    filteredBuiltIn () {
      return this.builtIn.filter(theme => this.matchesFilters(theme, null))
    },
    filteredSkins () {
      return this.skins.filter(item => this.matchesFilters(item.theme, item.account))
    },
    visibleSkins () {
      const rows = this.filteredSkins
      if (this.tab === 'recent') {
        return [...rows].sort((a, b) => String(b.account.last_post || '').localeCompare(String(a.account.last_post || '')))
      }
      if (this.tab === 'featured') {
        return rows.filter(item => this.isFeatured(item.theme))
      }
      return rows
    }
  },
  watch: {
    tab (value) {
      if (value !== 'built-in' && this.loggedIn && this.loadedFor !== this.username) {
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
    previewVars (theme) {
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
    matchesFilters (theme, account) {
      const query = this.search.trim().toLowerCase()
      if (query) {
        const haystack = [theme.name, theme.mood, account?.name || ''].join(' ').toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (this.modeFilter !== 'all' && theme.mode !== this.modeFilter) return false
      if (this.tagFilter !== 'all' && !(theme.tags || []).includes(this.tagFilter)) return false
      if (this.kindFilter !== 'all' && this.kindFor(theme) !== this.kindFilter) return false
      return true
    },
    kindFor (theme) {
      const selected = Array.isArray(theme.profile?.badges?.selected) ? theme.profile.badges.selected : []
      if (selected.some(badge => isCredentialBadge(badge.source, badge.id))) return 'credential'
      if (selected.length) return 'achievement'
      const atmosphere = theme.profile?.atmosphere?.source
      const plain = theme.profile?.avatarFrame === 'none' &&
        theme.profile?.nameplate === 'plain' &&
        (!atmosphere || atmosphere === 'none') &&
        !selected.length
      return plain ? 'minimal' : 'achievement'
    },
    credentialLabel (theme) {
      const selected = Array.isArray(theme.profile?.badges?.selected) ? theme.profile.badges.selected : []
      const credential = selected.find(badge => isCredentialBadge(badge.source, badge.id))
      return credential ? 'Verified credential' : ''
    },
    isFeatured (theme) {
      if ((theme.tags || []).includes('featured')) return true
      const selected = Array.isArray(theme.profile?.badges?.selected) ? theme.profile.badges.selected : []
      return selected.some(badge => isCredentialBadge(badge.source, badge.id))
    },
    applyTheme (id) {
      this.$appearance.setTheme(id)
      this.$q.notify({ message: getTheme(id).name + ' applied.', color: 'primary', timeout: 1600 })
    },
    remixSkin (item) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('ausbit:theme:remix', JSON.stringify({
          theme: item.theme,
          author: item.account.name
        }))
      }
      this.$router.push('/settings/skin?remix=1')
    },
    openAdopt (item) {
      this.adoptItem = item
      this.adoptOpen = true
    },
    confirmAdopt () {
      if (!this.adoptItem) return
      const result = this.$appearance.adoptCustomTheme(this.adoptItem.theme, this.adoptItem.account.name)
      this.adoptOpen = false
      if (result.ok) {
        this.$q.notify({
          message: 'Palette adopted for this device.',
          caption: 'Adopted from @' + this.adoptItem.account.name + '. Their published skin is unchanged.',
          color: 'primary',
          timeout: 3200
        })
      } else {
        this.$q.notify({ type: 'negative', message: result.errors?.[0] || 'Could not adopt that palette.' })
      }
      this.adoptItem = null
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
