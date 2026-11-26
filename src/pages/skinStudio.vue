<template>
  <q-page class="studio-page">
    <div class="studio-shell">
      <header class="studio-head">
        <div>
          <div class="studio-eyebrow">
            <q-icon name="brush" size="15px" aria-hidden="true" />
            Profile skin
          </div>
          <h1 class="studio-title">Skin Studio</h1>
          <p class="studio-intro">
            Design a look for your profile, blog and posts. It is published as public
            <code>posting_json_metadata</code> on Hive, signed with your posting key.
          </p>
        </div>
        <div class="studio-head__actions">
          <q-btn flat no-caps icon="arrow_back" label="Appearance" to="/appearance" />
          <q-btn outline no-caps icon="input" label="Import code" @click="openImport" />
          <q-btn outline no-caps icon="visibility" label="View my profile" :to="'/@' + username" />
        </div>
      </header>

      <q-card v-if="!username" flat bordered class="studio-empty">
        <q-icon name="login" size="2rem" color="primary" aria-hidden="true" />
        <h2>Sign in to design a skin</h2>
        <p>Your skin belongs to your Hive account. Sign in from the top bar, then come back here.</p>
        <q-btn unelevated no-caps color="primary" label="Back to appearance" to="/appearance" />
      </q-card>

      <div v-else-if="!account" class="studio-loading">
        <q-skeleton type="rect" height="120px" />
        <q-skeleton type="rect" height="420px" class="q-mt-md" />
      </div>

      <div v-else class="studio-grid">
        <div class="studio-controls">
          <section class="studio-section">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Start from</h2>
              <span class="studio-section__hint">Any built-in theme is a starting point, not a lock-in.</span>
            </div>
            <div class="studio-row">
              <q-select
                v-model="presetId"
                :options="presetOptions"
                dense
                outlined
                emit-value
                map-options
                label="Preset"
                class="studio-grow"
                @update:model-value="applyPreset"
              />
              <q-btn outline no-caps icon="auto_awesome" label="Palette from my avatar" :loading="busy" @click="paletteFromAvatar" />
            </div>
          </section>

          <section class="studio-section">
            <h2 class="studio-section__title">Identity</h2>
            <div class="studio-row">
              <q-input v-model="draft.name" dense outlined label="Skin name" maxlength="40" class="studio-grow" />
              <q-btn-toggle
                v-model="modePlan"
                :options="[{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }, { label: 'Both', value: 'both' }]"
                dense
                no-caps
                toggle-color="primary"
                color="grey-9"
                text-color="grey-3"
                aria-label="Skin mode or mode variants"
              />
            </div>
            <q-input v-model="draft.mood" dense outlined label="Mood" maxlength="80" class="q-mt-sm" />
            <div v-if="legacyNote" class="studio-legacy" role="note">{{ legacyNote }}</div>
            <div v-if="remixNote" class="studio-remix" role="note">
              {{ remixNote }}
              <q-btn v-if="remixOriginal" flat dense no-caps icon="undo" label="Reset to original" @click="resetRemix" />
            </div>
            <div class="studio-row q-mt-sm">
              <q-input v-model="draft.profile.status.text" dense outlined label="Status line (optional, plain text)" maxlength="80" class="studio-grow" />
              <q-select v-model="draft.profile.status.icon" :options="statusIconOptions" dense outlined emit-value map-options label="Status icon" class="studio-grow" />
            </div>
            <p class="studio-section__hint q-mt-xs">Shown as a static line. No marquee, links or HTML.</p>
          </section>

          <section class="studio-section">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Palette</h2>
              <span class="studio-section__hint">Every value is a hex colour; each variant is contrast checked independently.</span>
            </div>
            <div v-if="isBoth" class="studio-row q-mb-sm">
              <q-select
                v-model="variantTarget"
                :options="variantTargetOptions"
                dense
                outlined
                emit-value
                map-options
                label="Edit palette for"
                class="studio-grow"
              />
            </div>
            <div class="studio-palette">
              <label v-for="field in colorFields" :key="field.key" class="studio-color">
                <span class="studio-color__label">{{ field.label }}</span>
                <span class="studio-color__controls">
                  <input
                    type="color"
                    class="studio-color__input"
                    :value="activeTokens[field.key]"
                    :aria-label="field.label + ' colour'"
                    @input="setColor(field.key, $event.target.value)"
                  />
                  <input
                    type="text"
                    class="studio-color__hex"
                    :value="activeTokens[field.key]"
                    maxlength="7"
                    spellcheck="false"
                    :aria-label="field.label + ' hex value'"
                    @change="setColor(field.key, $event.target.value)"
                  />
                </span>
              </label>
            </div>
            <div class="studio-meter">
              <span class="studio-meter__item" :class="contrastClass(contrastText)">
                Text on surface {{ contrastText.toFixed(2) }}:1
              </span>
              <span class="studio-meter__item" :class="contrastClass(contrastMuted)">
                Muted {{ contrastMuted.toFixed(2) }}:1
              </span>
              <span class="studio-meter__item" :class="contrastClass(contrastPrimary)">
                Primary {{ contrastPrimary.toFixed(2) }}:1
              </span>
            </div>
            <div v-if="isBoth" class="studio-meter" aria-label="Variant contrast summary">
              <span v-for="variant in variantMeters" :key="variant.mode" class="studio-meter__item" :class="contrastClass(variant.ratio)">
                {{ variant.label }} {{ variant.ratio.toFixed(2) }}:1
              </span>
            </div>
          </section>

          <section class="studio-section">
            <h2 class="studio-section__title">Type and shape</h2>
            <div class="studio-row">
              <q-select v-model="draft.type.body" :options="typeBodyOptions" dense outlined label="Body type" class="studio-grow" />
              <q-select v-model="draft.type.display" :options="typeDisplayOptions" dense outlined label="Display type" class="studio-grow" />
            </div>
            <div class="studio-row q-mt-sm">
              <q-select v-model="draft.shape.radius" :options="radiusOptions" dense outlined label="Corners" class="studio-grow" />
              <q-select v-model="draft.shape.border" :options="borderOptions" dense outlined label="Borders" class="studio-grow" />
              <q-select v-model="draft.shape.shadow" :options="shadowOptions" dense outlined label="Depth" class="studio-grow" />
            </div>
          </section>

          <section class="studio-section">
            <h2 class="studio-section__title">Backdrop and personality</h2>
            <div class="studio-row">
              <q-select v-model="draft.profile.background" :options="backgroundOptions" dense outlined label="Backdrop" class="studio-grow" />
              <q-select v-model="draft.effects.texture" :options="textureOptions" dense outlined label="Page texture" class="studio-grow" />
            </div>
            <div class="studio-row q-mt-sm">
              <q-select v-model="draft.profile.avatarFrame" :options="avatarOptions" dense outlined label="Avatar frame" class="studio-grow" />
              <q-select v-model="draft.profile.nameplate" :options="nameplateOptions" dense outlined label="Nameplate" class="studio-grow" />
              <q-select v-model="draft.profile.card" :options="cardOptions" dense outlined label="Cards" class="studio-grow" />
            </div>
            <div class="studio-row q-mt-sm">
              <q-select v-model="draft.effects.motion" :options="motionOptions" dense outlined label="Motion" class="studio-grow" />
              <q-select v-model="draft.effects.ambient" :options="ambientOptions" dense outlined label="Ambient" class="studio-grow" />
            </div>
          </section>

          <section class="studio-section">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Atmosphere</h2>
              <span class="studio-section__hint">Your own cover or a three-image collage. The readability scrim is always applied.</span>
            </div>
            <div class="studio-row">
              <q-select v-model="draft.profile.atmosphere.source" :options="atmosphereSourceOptions" dense outlined emit-value map-options label="Source" class="studio-grow" />
              <q-select v-model="draft.profile.atmosphere.treatment" :options="atmosphereTreatmentOptions" dense outlined emit-value map-options label="Treatment" class="studio-grow" />
              <q-select v-model="draft.profile.atmosphere.intensity" :options="atmosphereIntensityOptions" dense outlined emit-value map-options label="Intensity" class="studio-grow" />
            </div>
            <p v-if="draft.profile.atmosphere.source === 'cover' && coverWarning" class="studio-warning-note" role="note">{{ coverWarning }}</p>
            <div v-if="draft.profile.atmosphere.source === 'collage'" class="studio-atmosphere">
              <div class="studio-atmosphere__head">
                <span>Choose up to 3 of your own images</span>
                <span>{{ selectedCollage.length }} / 3</span>
              </div>
              <div v-if="atmosphereImages.length" class="studio-atmosphere__grid">
                <button
                  v-for="image in atmosphereImages"
                  :key="image.url"
                  type="button"
                  class="studio-atmosphere__item"
                  :class="{ 'is-selected': selectedCollage.includes(image.url) }"
                  :aria-pressed="selectedCollage.includes(image.url)"
                  :aria-label="image.label"
                  @click="toggleCollageImage(image.url)"
                >
                  <img :src="image.url" alt="" loading="lazy" />
                  <span>{{ image.label }}</span>
                </button>
              </div>
              <p v-else class="studio-section__hint">No safe images found in your recent posts yet.</p>
            </div>
          </section>

          <section class="studio-section">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Visual language</h2>
              <span class="studio-section__hint">Closed enums only; the app owns all layout and geometry.</span>
            </div>
            <div class="studio-row">
              <q-select v-model="draft.profile.visual.link" :options="linkOptions" dense outlined label="Links" class="studio-grow" />
              <q-select v-model="draft.profile.visual.button" :options="buttonOptions" dense outlined label="Buttons" class="studio-grow" />
              <q-select v-model="draft.profile.visual.chip" :options="chipOptions" dense outlined label="Chips" class="studio-grow" />
            </div>
            <div class="studio-row q-mt-sm">
              <q-select v-model="draft.profile.visual.divider" :options="dividerOptions" dense outlined label="Dividers" class="studio-grow" />
              <q-select v-model="draft.profile.visual.image" :options="imageOptions" dense outlined label="Post images" class="studio-grow" />
              <q-select v-model="draft.profile.visual.gradient" :options="gradientOptions" dense outlined label="Gradient" class="studio-grow" />
            </div>
          </section>

          <section class="studio-section">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Profile Shelf</h2>
              <span class="studio-section__hint">Optional modules under your header. The layout stays fixed.</span>
            </div>
            <div class="studio-row">
              <q-select
                v-model="draft.profile.circle"
                :options="circleOptions"
                :disable="!followingNames.length"
                multiple
                use-input
                use-chips
                dense
                outlined
                label="Hive Circle (up to 6 accounts you follow)"
                class="studio-grow"
                @filter="filterCircle"
              />
            </div>
            <div class="studio-row q-mt-sm">
              <q-select v-model="draft.profile.post" :options="postOptions" dense outlined emit-value map-options label="Latest or pinned post" class="studio-grow" />
            </div>
            <p class="studio-section__hint q-mt-xs">
              Circle accounts come from your public following list.
            </p>
          </section>

          <section class="studio-section">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Badges</h2>
              <span class="studio-section__hint">Issued by PeakD or HiveBuzz. Verification is never self-claimed.</span>
            </div>
            <div class="studio-row">
              <q-select
                v-model="selectedBadgeKeys"
                :options="badgeOptions"
                multiple
                use-chips
                emit-value
                map-options
                dense
                outlined
                label="Show up to 6 earned badges"
                class="studio-grow"
                :loading="badgeLoading"
              />
            </div>
            <div class="studio-row q-mt-sm">
              <q-toggle
                :model-value="draft.profile.badges.showLevel"
                label="Show HiveBuzz level"
                color="primary"
                @update:model-value="draft.profile.badges.showLevel = $event"
              />
            </div>
            <p v-if="badgeSuggestionsEmpty" class="studio-section__hint q-mt-xs">
              No earned badges were returned. The shelf stays hidden until a badge resolves.
            </p>
          </section>

          <section class="studio-section studio-publish">
            <div class="studio-section__head">
              <h2 class="studio-section__title">Publish</h2>
              <span class="studio-section__hint">{{ size }} / 6000 bytes</span>
            </div>
            <div v-if="validation.errors.length" class="studio-errors" role="alert">
              <div v-for="error in validation.errors" :key="error">{{ error }}</div>
            </div>
            <div v-else-if="validation.warnings.length" class="studio-warnings">
              <div v-for="warning in validation.warnings" :key="warning">{{ warning }}</div>
            </div>
            <div class="studio-publish__actions">
              <q-btn outline no-caps icon="content_copy" label="Copy theme code" @click="copyThemeCode" />
              <q-btn outline no-caps icon="code" label="Copy JSON" @click="copyJson" />
              <q-btn outline no-caps icon="download" label="Download" @click="downloadJson" />
              <q-btn outline no-caps color="negative" icon="delete_outline" label="Unpublish" @click="openUnpublish" />
              <q-btn unelevated no-caps color="primary" icon="publish" label="Publish to Hive" :disable="!canPublish" @click="openPublish" />
            </div>
            <p class="studio-publish__note">
              Publishing queues an <code>account_update2</code> signed with your posting key.
              Your other profile fields are preserved.
            </p>
          </section>
        </div>

        <aside class="studio-preview" aria-label="Live skin preview">
          <div class="studio-preview__head">
            <span>Live preview</span>
            <span class="studio-preview__hint">Profile surfaces only</span>
          </div>
          <profile-skin :preview-theme="previewTheme" :author="username" :reputation="account && account.reputation" context="profile">
            <template #default="{ theme }">
            <div class="studio-mock">
              <div class="studio-mock__cover"></div>
              <div class="studio-mock__hero">
                <q-avatar size="72px" class="studio-mock__avatar">
                  <q-img :src="avatar" :alt="'Avatar of @' + username" />
                </q-avatar>
                <h2 class="account-header__name studio-mock__name">@{{ username }}</h2>
                <p class="studio-mock__bio">A corner of the Hive with a look of its own.</p>
                <div class="studio-mock__tabs">
                  <span class="is-active">Blog</span><span>Posts</span><span>Wallet</span>
                </div>
              </div>
              <profile-shelf v-if="theme" :theme="theme" :account="account" :preview-badges="previewBadges" preview />
              <div class="studio-mock__grid">
                <article class="studio-mock__card">
                  <div class="studio-mock__eyebrow">Latest post</div>
                  <h3>What I am building this week</h3>
                  <p>A short preview of a post, with the skin's links, borders and card material.</p>
                  <span class="studio-mock__link">Read the post →</span>
                </article>
                <article class="studio-mock__card">
                  <div class="studio-mock__eyebrow">About</div>
                  <p>This is how your bio and links can feel. The layout stays the same; only the language changes.</p>
                  <span class="studio-mock__chip">Hive</span>
                </article>
              </div>
            </div>
            </template>
          </profile-skin>
        </aside>
      </div>
    </div>

    <q-dialog v-model="publishOpen" persistent>
      <q-card class="studio-dialog">
        <q-card-section>
          <div class="studio-eyebrow">Confirm</div>
          <h2 class="studio-dialog__title">Publish this skin?</h2>
          <p class="studio-dialog__text">
            This queues one <code>account_update2</code> with posting authority. It updates only
            the <code>banksia.io</code> key inside your posting metadata.
          </p>
          <pre class="studio-diff">{{ publishDiff }}</pre>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn unelevated no-caps color="primary" icon="publish" label="Queue publish" @click="confirmPublish" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="unpublishOpen" persistent>
      <q-card class="studio-dialog">
        <q-card-section>
          <div class="studio-eyebrow">Confirm</div>
          <h2 class="studio-dialog__title">Remove your skin?</h2>
          <p class="studio-dialog__text">
            This queues an <code>account_update2</code> that removes the
            <code>banksia.io</code> key. Visitors will see your profile with their own theme again.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn unelevated no-caps color="negative" icon="delete_outline" label="Queue unpublish" @click="confirmUnpublish" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="importOpen">
      <q-card class="studio-dialog studio-import">
        <q-card-section>
          <div class="studio-eyebrow">Import</div>
          <h2 class="studio-dialog__title">Paste a theme code</h2>
          <p class="studio-dialog__text">Nothing is applied until you confirm the preview.</p>
          <q-input
            v-model="importCode"
            type="textarea"
            autogrow
            outlined
            label="hive-theme:1:…"
            class="q-mt-sm"
            spellcheck="false"
          />
          <div v-if="importError" class="studio-errors" role="alert">{{ importError }}</div>
          <div v-else-if="importWarnings.length" class="studio-warnings">
            <div v-for="warning in importWarnings" :key="warning">{{ warning }}</div>
          </div>
          <div v-if="importPreview" class="studio-import__preview">
            <profile-skin :preview-theme="importPreview" :author="importPreview.author || username" context="profile">
              <div class="studio-import__mock">
                <span class="studio-import__name">{{ importPreview.name }}</span>
                <span class="studio-import__mode">{{ importPreview.mode === 'light' ? 'Light' : 'Dark' }} · {{ importPreview.mood }}</span>
                <span class="studio-import__swatches">
                  <span v-for="swatch in importSwatches" :key="swatch" :style="{ background: swatch }"></span>
                </span>
              </div>
            </profile-skin>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn outline no-caps icon="translate" label="Check code" :loading="importBusy" @click="decodeImport" />
          <q-btn unelevated no-caps color="primary" icon="check" label="Use this theme" :disable="!importPreview" @click="applyImport" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.studio-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.studio-shell {
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.studio-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.studio-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.studio-title {
  margin: 0.3rem 0;
  font-size: clamp(1.7rem, 3.2vw, 2.2rem);
  font-weight: 650;
  letter-spacing: -0.025em;
}

.studio-intro {
  max-width: 72ch;
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.studio-head__actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.studio-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 0.72fr);
  gap: var(--space-4);
  align-items: start;
}

.studio-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.studio-section {
  padding: 0.9rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface);
}

.studio-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.studio-section__title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.studio-section__hint {
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.studio-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.studio-grow {
  flex: 1 1 170px;
  min-width: 140px;
}

.studio-palette {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
  gap: 0.4rem;
}

.studio-color {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.studio-color__label {
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  text-transform: capitalize;
}

.studio-color__controls {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.studio-color__input {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--c-border-subtle);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.studio-color__hex {
  width: 64px;
  padding: 0.12rem 0.25rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: 4px;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
}

.studio-meter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.studio-meter__item {
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-pill);
  font-size: 0.66rem;
  font-weight: 600;
}

.studio-meter__item.is-good { color: var(--c-positive); border-color: color-mix(in srgb, var(--c-positive) 45%, transparent); }
.studio-meter__item.is-warn { color: var(--c-warning); border-color: color-mix(in srgb, var(--c-warning) 45%, transparent); }
.studio-meter__item.is-bad { color: var(--c-negative); border-color: color-mix(in srgb, var(--c-negative) 45%, transparent); }

.studio-remix {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-primary) 35%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
  color: var(--c-text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.studio-import {
  width: min(720px, 96vw);
}

.studio-import__preview {
  margin-top: 0.7rem;
  overflow: hidden;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
}

.studio-import__mock {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.2rem;
}

.studio-import__name {
  font-size: 1.05rem;
  font-weight: 650;
}

.studio-import__mode {
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.72rem;
}

.studio-import__swatches {
  display: flex;
  gap: 4px;
  margin-top: 0.35rem;
}

.studio-import__swatches span {
  width: 20px;
  height: 20px;
  border: 1px solid var(--c-border-subtle);
  border-radius: 50%;
}

.studio-legacy {
  margin-top: 0.55rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning);
  font-size: 0.72rem;
  line-height: 1.4;
}

.studio-warning-note {
  margin: 0.5rem 0 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning);
  font-size: 0.72rem;
  line-height: 1.4;
}

.studio-atmosphere {
  margin-top: 0.65rem;
}

.studio-atmosphere__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.studio-atmosphere__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 0.35rem;
}

.studio-atmosphere__item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.2rem;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  color: var(--c-text-subtle);
  font: inherit;
  font-size: 0.6rem;
  text-align: left;
  cursor: pointer;
}

.studio-atmosphere__item img {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 3px;
  object-fit: cover;
}

.studio-atmosphere__item.is-selected {
  border-color: var(--c-primary);
  color: var(--c-text);
}

.studio-publish__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.studio-publish__note {
  margin: 0.55rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.4;
}

.studio-errors,
.studio-warnings {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  line-height: 1.4;
}

.studio-errors {
  border: 1px solid color-mix(in srgb, var(--c-negative) 40%, transparent);
  background: color-mix(in srgb, var(--c-negative) 8%, transparent);
  color: var(--c-negative);
}

.studio-warnings {
  border: 1px solid color-mix(in srgb, var(--c-warning) 40%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning);
}

.studio-preview {
  position: sticky;
  top: 82px;
  min-width: 0;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
  overflow: hidden;
}

.studio-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--c-border-subtle);
  color: var(--c-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.studio-preview__hint {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 400;
}

.studio-mock {
  min-height: 520px;
  background: var(--skin-bg, var(--c-bg));
  color: var(--skin-text, var(--c-text));
}

.studio-mock__cover {
  height: 110px;
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--skin-primary, var(--c-primary)) 35%, transparent), transparent 60%),
    linear-gradient(300deg, color-mix(in srgb, var(--skin-accent, var(--c-accent)) 28%, transparent), transparent 55%);
}

.studio-mock__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin-top: -32px;
  padding: 0 1rem 0.7rem;
  text-align: center;
}

.studio-mock__avatar {
  border: 3px solid var(--skin-primary, var(--c-primary));
  box-shadow: 0 6px 24px color-mix(in srgb, var(--skin-primary, var(--c-primary)) 28%, transparent);
}

.studio-mock__name {
  margin: 0.2rem 0 0;
  font-size: 1.25rem;
}

.studio-mock__bio {
  margin: 0;
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.76rem;
}

.studio-mock__tabs {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.45rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--skin-border, var(--c-border));
  border-radius: var(--radius-pill);
  font-size: 0.7rem;
}

.studio-mock__tabs .is-active {
  color: var(--skin-primary, var(--c-primary));
  font-weight: 700;
}

.studio-mock__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.6rem;
  padding: 0.7rem;
}

.studio-mock__card {
  padding: 0.7rem;
  border: 1px solid var(--skin-border, var(--c-border));
  border-radius: var(--radius-card);
  background: var(--skin-surface, var(--c-surface));
}

.studio-mock__eyebrow {
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.studio-mock__card h3 {
  margin: 0.2rem 0 0.3rem;
  font-size: 0.95rem;
}

.studio-mock__card p {
  margin: 0;
  color: var(--skin-muted, var(--c-text-muted));
  font-size: 0.74rem;
  line-height: 1.45;
}

.studio-mock__link {
  display: inline-block;
  margin-top: 0.4rem;
  color: var(--skin-primary, var(--c-primary));
  font-size: 0.72rem;
  font-weight: 700;
}

.studio-mock__chip {
  display: inline-block;
  margin-top: 0.4rem;
  padding: 0.12rem 0.4rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--skin-primary, var(--c-primary)) 18%, transparent);
  color: var(--skin-primary, var(--c-primary));
  font-size: 0.66rem;
  font-weight: 700;
}

.studio-empty,
.studio-loading {
  padding: 2rem;
  text-align: center;
}

.studio-empty h2 {
  margin: 0.6rem 0 0.3rem;
}

.studio-empty p {
  max-width: 52ch;
  margin: 0 auto 1rem;
  color: var(--c-text-muted);
}

.studio-dialog {
  width: min(620px, 94vw);
  background: var(--c-surface);
}

.studio-dialog__title {
  margin: 0.2rem 0 0.4rem;
  font-size: 1.1rem;
}

.studio-dialog__text {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.studio-diff {
  max-height: 260px;
  margin: 0.7rem 0 0;
  padding: 0.6rem;
  overflow: auto;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--radius-sm);
  background: var(--c-code-bg);
  color: var(--c-code-text);
  font-size: 0.68rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 1023px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }

  .studio-preview {
    position: static;
  }
}

@media (max-width: 599px) {
  .studio-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>

<script>
import ProfileSkin from 'components/theme/ProfileSkin.vue'
import ProfileShelf from 'components/theme/ProfileShelf.vue'
import { fetchAccount, fetchAccountPosts, fetchFollowingNames } from 'src/services/chainData'
import { fetchBadgeSuggestions } from 'src/services/badges'
import { readUploadHistory } from 'src/services/imageHost'
import { postMetadata } from 'src/services/posts'
import { hiveAvatarUrl } from 'src/utils/avatar'
import { buildThemeOperation, mergeThemeMetadata, readAccountTheme, removeThemeMetadata, THEME_NAMESPACE } from 'src/themes/account'
import { getTheme, THEMES } from 'src/themes/registry'
import { isSafeImageUrl, validateTheme, THEME_SCHEMA } from 'src/themes/schema'
import { BRAND } from 'src/config/brand'
import { decodeThemeCode, encodeThemeCode } from 'src/themes/shareCode'
import { setPageMeta } from 'src/utils/pageMeta'
import { safeJsonParse } from 'src/utils/safeHtml'
import { contrast, ensureContrast, hslToHex, hueFor, mix, rgbToHsl } from 'src/themes/color'

function clone (value) {
  return JSON.parse(JSON.stringify(value))
}

function baseDraft (username) {
  const base = getTheme('neon-tide')
  return {
    schema: THEME_SCHEMA,
    scope: 'profile',
    id: String(username || 'my').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40),
    name: 'My Hive skin',
    mood: 'My corner of the Hive',
    description: '',
    author: username,
    remixedFrom: null,
    tags: ['dark', 'custom'],
    mode: 'dark',
    tokens: clone(base.tokens),
    type: clone(base.type),
    shape: clone(base.shape),
    effects: clone(base.effects),
    profile: {
      background: 'mesh',
      avatarFrame: 'ring',
      nameplate: 'gradient',
      card: 'glass',
      status: { text: '', icon: 'none' },
      circle: [],
      badges: { selected: [], showLevel: true },
      post: 'none',
      atmosphere: { source: 'none', treatment: 'duotone', intensity: 'medium' },
      visual: { link: 'underline', button: 'solid', chip: 'pill', divider: 'hairline', image: 'none', gradient: 'none' },
      banner: null
    }
  }
}

function paletteFor (average, username, mode) {
  const hsl = average ? rgbToHsl(average) : { h: hueFor(username), s: 58, l: 50 }
  const hue = hsl.s < 12 ? hueFor(username) : hsl.h
  const sat = Math.max(38, Math.min(78, hsl.s || 58))
  const dark = mode === 'dark'
  const primary = hslToHex(hue, sat, dark ? 64 : 38)
  const secondary = hslToHex((hue + 48) % 360, sat, dark ? 62 : 36)
  const accent = hslToHex((hue + 300) % 360, sat, dark ? 70 : 42)
  return {
    bg: dark ? hslToHex(hue, 34, 6) : hslToHex(hue, 36, 95),
    surface: dark ? hslToHex(hue, 30, 11) : hslToHex(hue, 40, 98),
    surfaceAlt: dark ? hslToHex(hue, 28, 15) : hslToHex(hue, 34, 92),
    text: dark ? hslToHex(hue, 22, 92) : hslToHex(hue, 30, 12),
    muted: dark ? hslToHex(hue, 18, 66) : hslToHex(hue, 16, 38),
    border: dark ? hslToHex(hue, 24, 26) : hslToHex(hue, 20, 76),
    primary,
    secondary,
    accent,
    positive: dark ? '#81c784' : '#19753a',
    negative: dark ? '#e57373' : '#b42318',
    warning: dark ? '#ffb74d' : '#9a5b00',
    info: dark ? '#81d4fa' : '#0b6f8a'
  }
}

function variantFor (tokens, mode) {
  const dark = mode === 'dark'
  const surface = dark ? mix(tokens.primary, '#000000', 0.84) : '#ffffff'
  const bg = dark ? mix(tokens.primary, '#000000', 0.9) : mix(tokens.primary, '#ffffff', 0.94)
  const text = dark ? mix(tokens.primary, '#ffffff', 0.9) : mix(tokens.primary, '#000000', 0.86)
  return {
    bg,
    surface,
    surfaceAlt: dark ? mix(tokens.primary, '#000000', 0.78) : mix(tokens.primary, '#ffffff', 0.88),
    text: ensureContrast(text, surface, 4.5),
    muted: ensureContrast(dark ? mix(tokens.primary, '#ffffff', 0.6) : mix(tokens.primary, '#000000', 0.55), surface, 4.5),
    border: dark ? mix(tokens.primary, '#000000', 0.62) : mix(tokens.primary, '#ffffff', 0.62),
    primary: ensureContrast(tokens.primary, surface, 3),
    secondary: ensureContrast(tokens.secondary, surface, 3),
    accent: ensureContrast(tokens.accent, surface, 3),
    positive: ensureContrast(tokens.positive, surface, 4.5),
    negative: ensureContrast(tokens.negative, surface, 4.5),
    warning: ensureContrast(tokens.warning, surface, 4.5),
    info: ensureContrast(tokens.info, surface, 4.5)
  }
}

async function averageImageColor (url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0, size, size)
        const data = context.getImageData(0, 0, size, size).data
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3]
          if (alpha < 128) continue
          const red = data[index]
          const green = data[index + 1]
          const blue = data[index + 2]
          const max = Math.max(red, green, blue)
          const min = Math.min(red, green, blue)
          if (max < 24 || min > 238 || max - min < 8) continue
          r += red
          g += green
          b += blue
          count += 1
        }
        if (!count) return resolve(null)
        const rgb = { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) }
        resolve('#' + [rgb.r, rgb.g, rgb.b].map(value => value.toString(16).padStart(2, '0')).join(''))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('Could not read the avatar'))
    image.src = url
  })
}

export default {
  name: 'SkinStudio',
  components: { ProfileSkin, ProfileShelf },
  data () {
    return {
      username: this.$hiveStore.user.username || '',
      account: null,
      draft: baseDraft(this.$hiveStore.user.username || ''),
      presetId: 'neon-tide',
      loadedRaw: '',
      busy: false,
      publishOpen: false,
      unpublishOpen: false,
      pendingOperation: null,
      pendingMerged: '',
      pendingUnpublish: null,
      legacyNote: '',
      remixOriginal: null,
      importOpen: false,
      importCode: '',
      importPreview: null,
      importError: '',
      importWarnings: [],
      importBusy: false,
      followingNames: [],
      circleFilter: '',
      circleLoading: false,
      badgeLoading: false,
      badgeSuggestions: { peakd: [], hivebuzz: [], level: null },
      variantTarget: 'base',
      variantTargetOptions: [
        { label: 'Base fallback', value: 'base' },
        { label: 'Dark variant', value: 'dark' },
        { label: 'Light variant', value: 'light' }
      ],
      atmosphereImages: [],
      coverUrl: '',
      coverMeta: { width: 0, height: 0 },
      atmosphereSourceOptions: [
        { label: 'None', value: 'none' },
        { label: 'Profile cover', value: 'cover' },
        { label: 'Image collage', value: 'collage' }
      ],
      atmosphereTreatmentOptions: [
        { label: 'None', value: 'none' },
        { label: 'Duotone', value: 'duotone' },
        { label: 'Gradient', value: 'gradient' },
        { label: 'Grain', value: 'grain' },
        { label: 'Halftone', value: 'halftone' }
      ],
      atmosphereIntensityOptions: [
        { label: 'Subtle', value: 'subtle' },
        { label: 'Medium', value: 'medium' },
        { label: 'Strong', value: 'strong' }
      ],
      linkOptions: ['underline', 'glow', 'highlighter', 'bracket'],
      buttonOptions: ['solid', 'outline', 'pill', 'square', 'ticket'],
      chipOptions: ['pill', 'square', 'stamp', 'ticket'],
      dividerOptions: ['hairline', 'dots', 'wave', 'hex'],
      imageOptions: ['none', 'rounded', 'polaroid', 'stamp', 'duotone'],
      gradientOptions: ['none', 'to-right', 'to-bottom', 'diagonal', 'radial'],
      statusIconOptions: [
        { label: 'No icon', value: 'none' },
        { label: 'Spark', value: 'spark' },
        { label: 'Hammer', value: 'hammer' },
        { label: 'Coffee', value: 'coffee' },
        { label: 'Moon', value: 'moon' },
        { label: 'Leaf', value: 'leaf' },
        { label: 'Antenna', value: 'antenna' },
        { label: 'Heart', value: 'heart' }
      ],
      postOptions: [
        { label: 'No post card', value: 'none' },
        { label: 'Latest post', value: 'latest' },
        { label: 'Pinned post', value: 'pinned' }
      ],
      colorFields: [
        { key: 'bg', label: 'Background' },
        { key: 'surface', label: 'Surface' },
        { key: 'surfaceAlt', label: 'Surface alt' },
        { key: 'text', label: 'Text' },
        { key: 'muted', label: 'Muted' },
        { key: 'border', label: 'Border' },
        { key: 'primary', label: 'Primary' },
        { key: 'secondary', label: 'Secondary' },
        { key: 'accent', label: 'Accent' },
        { key: 'positive', label: 'Positive' },
        { key: 'negative', label: 'Negative' },
        { key: 'warning', label: 'Warning' },
        { key: 'info', label: 'Info' }
      ],
      typeBodyOptions: ['sans', 'serif', 'mono', 'rounded'],
      typeDisplayOptions: ['sans', 'serif', 'grotesk', 'mono'],
      radiusOptions: ['sharp', 'soft', 'round', 'pill'],
      borderOptions: ['none', 'hairline', '2px', 'double'],
      shadowOptions: ['none', 'soft', 'crisp', 'glow'],
      backgroundOptions: ['solid', 'mesh', 'aurora', 'horizon', 'starfield', 'hex', 'grid', 'scanlines', 'grain', 'paper', 'leaves'],
      textureOptions: ['none', 'hex', 'grid', 'scanlines', 'grain', 'paper', 'leaves', 'aurora', 'stars'],
      avatarOptions: ['none', 'ring', 'hex', 'halo', 'orbit', 'pixel', 'ticket'],
      nameplateOptions: ['plain', 'gradient', 'neon', 'emboss', 'stamp'],
      cardOptions: ['flat', 'glass', 'paper', 'terminal', 'ticket'],
      motionOptions: ['none', 'subtle', 'lively'],
      ambientOptions: ['none', 'drift', 'shimmer', 'pulse']
    }
  },
  computed: {
    circleOptions () {
      const selected = Array.isArray(this.draft.profile.circle) ? this.draft.profile.circle : []
      const query = this.circleFilter.trim().toLowerCase()
      return [...new Set([...selected, ...this.followingNames])]
        .filter(name => !query || name.includes(query))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 60)
    },
    earnedBadges () {
      return [
        ...this.badgeSuggestions.peakd,
        ...this.badgeSuggestions.hivebuzz.filter(badge => badge.earned)
      ]
    },
    badgeOptions () {
      const options = this.earnedBadges.map(badge => ({
        label: badge.title + ' · ' + badge.issuer + (badge.verified ? ' · Verified' : ''),
        value: badge.source + ':' + badge.id,
        caption: badge.source === 'peakd' ? 'PeakD' : 'HiveBuzz'
      }))
      const known = new Set(options.map(option => option.value))
      for (const item of this.draft.profile.badges?.selected || []) {
        const value = item.source + ':' + item.id
        if (!known.has(value)) options.push({ label: item.id, value, caption: item.source })
      }
      return options
    },
    selectedBadgeKeys: {
      get () {
        return (this.draft.profile.badges?.selected || []).map(item => item.source + ':' + item.id)
      },
      set (keys) {
        const selected = []
        for (const key of Array.isArray(keys) ? keys.slice(0, 6) : []) {
          const index = String(key).indexOf(':')
          if (index < 1) continue
          const source = key.slice(0, index)
          const id = key.slice(index + 1)
          if (!['peakd', 'hivebuzz'].includes(source) || !id) continue
          selected.push({ source, id })
        }
        this.draft.profile.badges.selected = selected
      }
    },
    badgeSuggestionsEmpty () {
      return !this.badgeLoading && this.earnedBadges.length === 0
    },
    remixNote () {
      if (!this.draft.remixedFrom) return ''
      return 'Remix of @' + this.draft.remixedFrom + ' — not yet published.'
    },
    importSwatches () {
      if (!this.importPreview) return []
      const tokens = this.importPreview.tokens
      return [tokens.bg, tokens.surface, tokens.primary, tokens.secondary, tokens.accent, tokens.text]
    },
    previewBadges () {
      const byKey = new Map(this.earnedBadges.map(badge => [badge.source + ':' + badge.id, badge]))
      const badges = []
      if (this.draft.profile.badges?.showLevel && this.badgeSuggestions.level) {
        badges.push(this.badgeSuggestions.level)
      }
      for (const item of this.draft.profile.badges?.selected || []) {
        const badge = byKey.get(item.source + ':' + item.id)
        if (badge) badges.push(badge)
      }
      return badges.slice(0, 7)
    },
    modePlan: {
      get () {
        return this.draft.variants && (this.draft.variants.dark || this.draft.variants.light)
          ? 'both'
          : (this.draft.mode === 'light' ? 'light' : 'dark')
      },
      set (value) {
        if (value === 'both') this.enableBothVariants()
        else {
          this.draft.mode = value === 'light' ? 'light' : 'dark'
          delete this.draft.variants
          this.variantTarget = 'base'
        }
      }
    },
    isBoth () {
      return Boolean(this.draft.variants && (this.draft.variants.dark || this.draft.variants.light))
    },
    activeTokens () {
      if (this.isBoth && this.variantTarget !== 'base') {
        return this.draft.variants[this.variantTarget]?.tokens || this.draft.tokens
      }
      return this.draft.tokens
    },
    variantMeters () {
      if (!this.isBoth) return []
      const rows = []
      for (const mode of ['dark', 'light']) {
        const tokens = this.draft.variants?.[mode]?.tokens
        if (tokens) rows.push({ mode, label: mode === 'dark' ? 'Dark' : 'Light', ratio: contrast(tokens.text, tokens.surface) })
      }
      return rows
    },
    selectedCollage () {
      return Array.isArray(this.draft.profile.banner?.images) ? this.draft.profile.banner.images : []
    },
    coverWarning () {
      if (!this.coverUrl) return 'No profile cover was found. The existing backdrop stays in place.'
      const { width, height } = this.coverMeta
      if (width && width < 1200) return 'This cover is small (' + width + 'px wide); it may look soft behind a page.'
      if (width && height && height > width) return 'This cover is portrait-shaped; the atmosphere crops it to a wide strip.'
      return ''
    },
    presetOptions () {
      return THEMES.map(theme => ({ label: theme.name, value: theme.id, caption: theme.mood }))
    },
    avatar () {
      return hiveAvatarUrl(this.username, 'large')
    },
    validation () {
      return validateTheme(this.draft, { requireProfile: true })
    },
    previewTheme () {
      return this.validation.theme || this.draft
    },
    size () {
      try {
        return JSON.stringify(this.validation.theme || this.draft).length
      } catch {
        return 0
      }
    },
    canPublish () {
      return Boolean(this.username && this.validation.ok && !this.busy)
    },
    contrastText () {
      return contrast(this.activeTokens.text, this.activeTokens.surface)
    },
    contrastMuted () {
      return contrast(this.activeTokens.muted, this.activeTokens.surface)
    },
    contrastPrimary () {
      return contrast(this.activeTokens.primary, this.activeTokens.bg)
    },
    publishDiff () {
      if (!this.pendingMerged) return ''
      try {
        const parsed = JSON.parse(this.pendingMerged)
        return JSON.stringify({ [THEME_NAMESPACE]: parsed[THEME_NAMESPACE] }, null, 2)
      } catch {
        return ''
      }
    }
  },
  watch: {
    'draft.profile.circle' (value) {
      if (Array.isArray(value) && value.length > 6) {
        this.draft.profile.circle = value.slice(0, 6)
        this.$q.notify({ message: 'Hive Circle supports up to 6 accounts.', color: 'primary', timeout: 2200 })
      }
    },
    'draft.profile.atmosphere.source' (value) {
      if (value === 'collage' && !this.draft.profile.banner) {
        this.draft.profile.banner = { layout: 'mosaic', images: [] }
      }
    },
    'draft.profile.badges.selected' (value) {
      if (Array.isArray(value) && value.length > 6) {
        this.draft.profile.badges.selected = value.slice(0, 6)
        this.$q.notify({ message: 'The badge shelf supports up to 6 selected badges.', color: 'primary', timeout: 2200 })
      }
    },
    '$hiveStore.user.username' (value) {
      this.username = value || ''
      this.followingNames = []
      this.loadAccount()
    }
  },
  mounted () {
    setPageMeta({
      title: 'Skin Studio — design your Hive profile skin',
      description: 'Design a palette, backdrop, type, avatar frame, status line and profile shelf for your Hive profile, then publish it with posting authority.',
      url: '/settings/skin'
    })
    this.loadAccount()
  },
  methods: {
    async loadAccount () {
      if (!this.username) return
      this.busy = true
      try {
        let account = this.$hiveStore.accounts[this.username]
        if (!account) {
          account = await fetchAccount(this.username, { force: false })
          if (account) this.$hiveStore.updateAccountData(account)
        }
        this.account = account || null
        if (!account) return
        this.loadedRaw = account.posting_json_metadata || ''
        const stored = readAccountTheme(account)
        const existing = stored.theme
        if (existing) {
          this.draft = clone(existing)
          this.draft.author = this.username
          this.draft.scope = 'profile'
          this.ensureDraftShape()
          this.legacyNote = stored.legacy?.stickers
            ? 'Legacy stickers are no longer displayed; use the Profile Shelf instead.'
            : ''
        } else {
          this.draft = baseDraft(this.username)
          this.legacyNote = ''
        }
        this.consumeRemix()
        this.loadFollowing()
        this.loadBadges()
        this.loadAtmosphereImages()
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error?.message || 'Could not load your account' })
      } finally {
        this.busy = false
      }
    },
    consumeRemix () {
      if (typeof sessionStorage === 'undefined') return
      let payload
      try {
        payload = JSON.parse(sessionStorage.getItem('ausbit:theme:remix') || 'null')
      } catch {
        payload = null
      }
      sessionStorage.removeItem('ausbit:theme:remix')
      if (!payload?.theme) return
      const result = validateTheme(payload.theme, { requireProfile: true })
      if (!result.ok) return
      this.draft = clone(result.theme)
      this.draft.author = this.username
      this.draft.scope = 'profile'
      if (payload.author && payload.author !== this.username) this.draft.remixedFrom = payload.author
      this.ensureDraftShape()
      this.remixOriginal = clone(this.draft)
      this.legacyNote = ''
    },
    resetRemix () {
      if (!this.remixOriginal) return
      this.draft = clone(this.remixOriginal)
      this.ensureDraftShape()
    },
    openImport () {
      this.importOpen = true
      this.importCode = ''
      this.importPreview = null
      this.importError = ''
      this.importWarnings = []
    },
    async decodeImport () {
      this.importBusy = true
      this.importPreview = null
      this.importError = ''
      this.importWarnings = []
      try {
        const result = await decodeThemeCode(this.importCode)
        if (!result.ok) {
          this.importError = result.errors.join(' ')
          return
        }
        this.importPreview = result.theme
        this.importWarnings = result.warnings
      } catch (error) {
        this.importError = error?.message || 'Could not read that code.'
      } finally {
        this.importBusy = false
      }
    },
    applyImport () {
      if (!this.importPreview) return
      const sourceAuthor = this.importPreview.author
      this.draft = clone(this.importPreview)
      this.draft.author = this.username
      this.draft.scope = 'profile'
      if (sourceAuthor && sourceAuthor !== this.username) this.draft.remixedFrom = sourceAuthor
      this.ensureDraftShape()
      this.remixOriginal = clone(this.draft)
      this.importOpen = false
      this.$q.notify({ message: 'Theme imported into the Studio. Review it before publishing.', color: 'primary', timeout: 3200 })
    },
    async copyThemeCode () {
      if (!this.validation.theme) return
      try {
        const code = await encodeThemeCode(this.validation.theme)
        await navigator.clipboard.writeText(code)
        this.$q.notify({ message: 'Theme code copied.', color: 'primary', timeout: 1800 })
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not create a theme code.' })
      }
    },
    ensureDraftShape () {
      const profile = this.draft.profile || (this.draft.profile = {})
      if (!profile.status || typeof profile.status !== 'object') profile.status = { text: '', icon: 'none' }
      if (typeof profile.status.text !== 'string') profile.status.text = ''
      if (!Array.isArray(profile.circle)) profile.circle = []
      if (!profile.badges || typeof profile.badges !== 'object') profile.badges = { selected: [], showLevel: true }
      if (!Array.isArray(profile.badges.selected)) profile.badges.selected = []
      if (typeof profile.badges.showLevel !== 'boolean') profile.badges.showLevel = true
      if (!['latest', 'pinned', 'none'].includes(profile.post)) profile.post = 'none'
      if (!profile.atmosphere || typeof profile.atmosphere !== 'object') {
        profile.atmosphere = { source: 'none', treatment: 'duotone', intensity: 'medium' }
      }
      if (!profile.visual || typeof profile.visual !== 'object') {
        profile.visual = { link: 'underline', button: 'solid', chip: 'pill', divider: 'hairline', image: 'none', gradient: 'none' }
      }
    },
    async loadFollowing () {
      if (!this.username || this.followingNames.length) return
      this.circleLoading = true
      try {
        this.followingNames = await fetchFollowingNames(this.username)
      } catch {
        this.followingNames = []
      } finally {
        this.circleLoading = false
      }
    },
    filterCircle (value, update) {
      this.circleFilter = value || ''
      update()
    },
    async loadBadges (force = false) {
      if (!this.username) return
      this.badgeLoading = true
      try {
        this.badgeSuggestions = await fetchBadgeSuggestions(this.username, { force })
      } catch {
        this.badgeSuggestions = { peakd: [], hivebuzz: [], level: null }
      } finally {
        this.badgeLoading = false
      }
    },
    async loadAtmosphereImages () {
      const rows = new Map()
      const profile = this.account?.profile && typeof this.account.profile === 'object'
        ? this.account.profile
        : safeJsonParse(this.account?.posting_json_metadata, {}).profile || {}
      this.coverUrl = isSafeImageUrl(profile.cover_image) ? profile.cover_image : ''
      if (this.coverUrl) {
        rows.set(this.coverUrl, 'Profile cover')
        const image = new Image()
        image.onload = () => { this.coverMeta = { width: image.naturalWidth, height: image.naturalHeight } }
        image.src = this.coverUrl
      } else {
        this.coverMeta = { width: 0, height: 0 }
      }
      try {
        const uploads = readUploadHistory(typeof localStorage !== 'undefined' ? localStorage : null, this.username)
        for (const entry of uploads) {
          if (isSafeImageUrl(entry.url) && !rows.has(entry.url)) rows.set(entry.url, 'Recent upload')
        }
      } catch {
        // Upload history is optional.
      }
      try {
        const posts = await fetchAccountPosts({ account: this.username, sort: 'blog', limit: 12 }, {})
        for (const post of Array.isArray(posts) ? posts : []) {
          const metadata = postMetadata(post)
          const images = Array.isArray(metadata.image) ? metadata.image : [metadata.image]
          for (const url of images) {
            if (isSafeImageUrl(url) && !rows.has(url)) rows.set(url, 'From a recent post')
          }
        }
      } catch {
        // Recent posts are optional.
      }
      this.atmosphereImages = [...rows.entries()].slice(0, 30).map(([url, label]) => ({ url, label }))
    },
    toggleCollageImage (url) {
      const current = this.selectedCollage
      let next
      if (current.includes(url)) next = current.filter(item => item !== url)
      else if (current.length < 3) next = [...current, url]
      else {
        this.$q.notify({ message: 'Choose up to 3 collage images.', color: 'primary', timeout: 2200 })
        return
      }
      this.draft.profile.banner = { layout: 'mosaic', images: next }
    },
    applyPreset (id) {
      const preset = getTheme(id)
      if (!preset) return
      this.draft.tokens = clone(preset.tokens)
      this.draft.type = clone(preset.type)
      this.draft.shape = clone(preset.shape)
      this.draft.effects = clone(preset.effects)
      this.draft.mode = preset.mode
      delete this.draft.variants
      this.variantTarget = 'base'
      this.draft.tags = [...new Set([preset.mode, 'custom', ...preset.tags])].slice(0, 8)
      this.draft.remixedFrom = preset.author && preset.author !== BRAND.appId ? preset.author : null
      this.draft.profile.background = preset.effects.texture === 'none' ? 'mesh' : preset.effects.texture
    },
    async paletteFromAvatar () {
      if (!this.username) return
      this.busy = true
      try {
        let average = null
        try {
          average = await averageImageColor(this.avatar)
        } catch {
          average = null
        }
        const mode = this.isBoth && this.variantTarget === 'light'
          ? 'light'
          : (this.isBoth && this.variantTarget === 'dark' ? 'dark' : this.draft.mode)
        this.applyPalette(paletteFor(average, this.username, mode))
        this.$q.notify({
          message: average ? 'Palette generated from your avatar.' : 'Palette generated from your account name.',
          color: 'primary',
          timeout: 2200
        })
      } finally {
        this.busy = false
      }
    },
    setColor (key, value) {
      const next = String(value || '').trim().toLowerCase()
      this.activeTokens[key] = next.startsWith('#') ? next : '#' + next
    },
    applyPalette (tokens) {
      if (this.isBoth && this.variantTarget !== 'base') {
        this.draft.variants[this.variantTarget].tokens = tokens
      } else {
        this.draft.tokens = tokens
      }
    },
    enableBothVariants () {
      const base = clone(this.draft.tokens)
      if (this.draft.mode === 'light') {
        this.draft.variants = {
          light: { tokens: base },
          dark: { tokens: variantFor(base, 'dark') }
        }
        this.variantTarget = 'dark'
      } else {
        this.draft.variants = {
          dark: { tokens: base },
          light: { tokens: variantFor(base, 'light') }
        }
        this.variantTarget = 'light'
      }
    },
    contrastClass (value) {
      if (value >= 4.5) return 'is-good'
      if (value >= 3) return 'is-warn'
      return 'is-bad'
    },
    async freshAccount () {
      this.busy = true
      try {
        const fresh = await fetchAccount(this.username, { force: true })
        if (fresh) this.$hiveStore.updateAccountData(fresh)
        return fresh
      } finally {
        this.busy = false
      }
    },
    async openPublish () {
      if (!this.canPublish) return
      const fresh = await this.freshAccount()
      if (!fresh) {
        this.$q.notify({ type: 'negative', message: 'Could not refresh your account before publishing.' })
        return
      }
      if ((fresh.posting_json_metadata || '') !== this.loadedRaw) {
        this.$q.notify({
          type: 'warning',
          message: 'Your profile metadata changed on chain. Reload the studio before publishing.',
          timeout: 6000
        })
        return
      }
      const merged = mergeThemeMetadata(fresh.posting_json_metadata, this.validation.theme)
      if (!merged.ok) {
        this.$q.notify({ type: 'negative', message: merged.error || 'Could not merge the theme.' })
        return
      }
      this.pendingOperation = buildThemeOperation(fresh, merged.text)
      this.pendingMerged = merged.text
      this.publishOpen = true
    },
    confirmPublish () {
      if (!this.pendingOperation) return
      this.$hiveStore.addToQueue([this.username, 'posting', this.pendingOperation])
      this.publishOpen = false
      // Treat the queued document as the expected base. A second publish
      // before the broadcast confirms will then stop with the on-chain
      // conflict message instead of queueing a duplicate update.
      this.loadedRaw = this.pendingMerged
      this.$q.notify({
        type: 'positive',
        message: 'Skin queued for broadcast.',
        caption: 'It will be visible after your signer confirms the transaction.'
      })
      this.pendingOperation = null
      this.pendingMerged = ''
    },
    async openUnpublish () {
      const fresh = await this.freshAccount()
      if (!fresh) return
      const removed = removeThemeMetadata(fresh.posting_json_metadata)
      if (!removed.ok) {
        this.$q.notify({ type: 'negative', message: removed.error || 'Could not read your profile metadata.' })
        return
      }
      this.pendingUnpublish = buildThemeOperation(fresh, removed.text)
      this.unpublishOpen = true
    },
    confirmUnpublish () {
      if (!this.pendingUnpublish) return
      this.$hiveStore.addToQueue([this.username, 'posting', this.pendingUnpublish])
      this.unpublishOpen = false
      this.loadedRaw = this.pendingUnpublish[1].posting_json_metadata
      this.$q.notify({
        type: 'positive',
        message: 'Unpublish queued.',
        caption: 'Your profile will use visitors’ themes after the transaction confirms.'
      })
      this.pendingUnpublish = null
    },
    async copyJson () {
      if (!this.validation.theme) return
      try {
        await navigator.clipboard.writeText(JSON.stringify(this.validation.theme, null, 2))
        this.$q.notify({ message: 'Theme JSON copied.', color: 'primary', timeout: 1800 })
      } catch {
        this.$q.notify({ type: 'negative', message: 'Could not copy to the clipboard.' })
      }
    },
    downloadJson () {
      if (!this.validation.theme) return
      const blob = new Blob([JSON.stringify(this.validation.theme, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = (this.validation.theme.id || 'hive-skin') + '.json'
      anchor.click()
      URL.revokeObjectURL(url)
    }
  }
}
</script>
