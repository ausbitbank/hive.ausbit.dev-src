<template>
  <q-page class="blog-settings">
    <div class="blog-settings__shell">
      <nav class="blog-settings__crumb" aria-label="Breadcrumb">
        <router-link to="/">Banksia</router-link>
        <span aria-hidden="true">/</span>
        <span>Blog settings</span>
      </nav>

      <header class="blog-settings__head">
        <h1 class="blog-settings__title">Your blog on banksia.io</h1>
        <p class="blog-settings__lede">
          Every Hive account has a clean reading page at
          <code>{{ hostLabel || 'yourname.banksia.io' }}</code>. Claiming is free:
          it writes a small blog object into your posting metadata, signed with
          your posting key. No server holds your keys.
        </p>
      </header>

      <q-card v-if="!accountName" flat bordered class="blog-settings__card">
        <q-card-section>
          <h2 class="blog-settings__section-title">Open a blog</h2>
          <p class="blog-settings__hint">Enter a Hive account to preview or manage its blog.</p>
          <div class="blog-settings__row">
            <q-input
              v-model="lookup"
              outlined
              dense
              label="Hive account"
              placeholder="alice"
              @keyup.enter="openAccount"
            />
            <q-btn unelevated no-caps color="primary" label="Open" @click="openAccount" />
          </div>
        </q-card-section>
      </q-card>

      <template v-else>
        <q-card v-if="loading" flat bordered class="blog-settings__card">
          <q-card-section>
            <q-skeleton type="rect" height="22px" width="40%" />
            <q-skeleton type="rect" height="14px" class="q-mt-md" />
            <q-skeleton type="rect" height="14px" width="70%" class="q-mt-sm" />
          </q-card-section>
        </q-card>

        <q-card v-else-if="error" flat bordered class="blog-settings__card">
          <q-card-section>
            <h2 class="blog-settings__section-title">Blog not available</h2>
            <p class="blog-settings__hint">{{ error }}</p>
            <q-btn outline no-caps color="primary" label="Try another account" @click="accountName = ''" />
          </q-card-section>
        </q-card>

        <template v-else-if="account">
          <q-card flat bordered class="blog-settings__card blog-settings__status">
            <q-card-section class="blog-settings__status-inner">
              <img :src="avatar" alt="" class="blog-settings__avatar" width="56" height="56" />
              <div class="blog-settings__status-copy">
                <h2 class="blog-settings__section-title">
                  @{{ account.name }}
                  <span class="blog-settings__badge" :class="{ 'blog-settings__badge--live': claimed }">
                    {{ claimed ? 'Claimed' : 'Preview' }}
                  </span>
                </h2>
                <p class="blog-settings__hint">
                  <a :href="publicUrl" target="_blank" rel="noopener noreferrer">{{ hostLabel }}</a>
                  <template v-if="!claimed"> · visible but not indexable until claimed</template>
                </p>
              </div>
              <q-btn
                outline
                no-caps
                color="primary"
                icon="open_in_new"
                label="Open blog"
                :href="publicUrl"
                target="_blank"
                rel="noopener noreferrer"
              />
            </q-card-section>
          </q-card>

          <q-banner v-if="!canEdit" rounded class="blog-settings__banner">
            <template #avatar><q-icon name="lock" /></template>
            Sign in as <strong>@{{ account.name }}</strong> to claim or edit this blog.
            The sign-in control is in the top bar. You can still preview the current settings.
          </q-banner>

          <q-banner v-if="queued" rounded class="blog-settings__banner blog-settings__banner--ok">
            <template #avatar><q-icon name="check_circle" /></template>
            {{ queuedMessage }} Approve it in the signing queue, then
            <button type="button" class="blog-settings__link-button" @click="reload">reload from chain</button>.
          </q-banner>

          <q-banner v-if="errors.length" rounded class="blog-settings__banner blog-settings__banner--error">
            <template #avatar><q-icon name="error_outline" /></template>
            <ul class="blog-settings__errors">
              <li v-for="message in errors" :key="message">{{ message }}</li>
            </ul>
          </q-banner>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Identity</h2>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.title"
                  outlined
                  dense
                  label="Blog title"
                  maxlength="80"
                  counter
                  :disable="!canEdit"
                  hint="Shown in the header, browser tab and link previews."
                />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.description"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  label="Description"
                  maxlength="240"
                  counter
                  :disable="!canEdit"
                  hint="A short introduction for the blog and its link previews."
                />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Look</h2>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.theme"
                  :options="themeOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Theme"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.mode"
                  :options="modeOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Default reading mode"
                  :disable="!canEdit"
                  hint="Readers can switch Light or Dark on their device."
                />
              </div>
              <div class="blog-settings__field blog-settings__accent">
                <label class="blog-settings__label" for="blog-accent">Accent</label>
                <input
                  id="blog-accent"
                  type="color"
                  class="blog-settings__color"
                  :value="form.accent || '#8a3b12'"
                  :disabled="!canEdit"
                  @input="form.accent = $event.target.value"
                />
                <q-input
                  v-model="form.accent"
                  outlined
                  dense
                  label="#rrggbb (optional)"
                  :disable="!canEdit"
                  class="blog-settings__accent-input"
                />
                <q-btn v-if="form.accent" flat dense no-caps label="Clear" @click="form.accent = ''" />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Branding</h2>
              <p class="blog-settings__hint">
                Use https image URLs. The profile avatar, cover and favicon are the defaults.
              </p>
              <div class="blog-settings__field">
                <q-input v-model="form.logo" outlined dense label="Logo / avatar URL" :disable="!canEdit" />
              </div>
              <div class="blog-settings__field">
                <q-input v-model="form.heroImage" outlined dense label="Hero image URL" :disable="!canEdit" />
              </div>
              <div class="blog-settings__field">
                <q-input v-model="form.favicon" outlined dense label="Favicon URL" :disable="!canEdit" />
              </div>
              <div v-if="form.logo || form.heroImage" class="blog-settings__brand-preview">
                <img v-if="form.logo" :src="form.logo" alt="Logo preview" class="blog-settings__logo-preview" />
                <img v-if="form.heroImage" :src="form.heroImage" alt="Hero preview" class="blog-settings__hero-preview" />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Layout</h2>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.layout"
                  :options="layoutOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Archive layout"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.width"
                  :options="widthOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Page width"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.typography"
                  :options="typographyOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Typography"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.hero"
                  :options="heroOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Hero"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.navText"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  label="Navigation links"
                  :disable="!canEdit"
                  hint="One per line: Label | /path or https://… (up to 6)."
                />
              </div>
              <div class="blog-settings__toggles">
                <q-toggle v-model="form.showTags" label="Show tags on cards" :disable="!canEdit" />
                <q-toggle v-model="form.showReadingTime" label="Show reading time" :disable="!canEdit" />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Page sections</h2>
              <p class="blog-settings__hint">
                Reorder or hide sections. Text sections let you add your own copy.
              </p>
              <div v-for="(block, index) in form.blocks" :key="index" class="blog-settings__block">
                <div class="blog-settings__block-head">
                  <strong>{{ blockLabel(block.type) }}</strong>
                  <div class="blog-settings__block-actions">
                    <q-btn
                      flat dense round icon="arrow_upward"
                      :aria-label="'Move ' + blockLabel(block.type) + ' up'"
                      :disable="!canEdit || index === 0"
                      @click="moveBlock(index, -1)"
                    />
                    <q-btn
                      flat dense round icon="arrow_downward"
                      :aria-label="'Move ' + blockLabel(block.type) + ' down'"
                      :disable="!canEdit || index === form.blocks.length - 1"
                      @click="moveBlock(index, 1)"
                    />
                    <q-toggle
                      :model-value="block.visible !== false"
                      :aria-label="'Show ' + blockLabel(block.type)"
                      :disable="!canEdit"
                      @update:model-value="block.visible = $event"
                    />
                    <q-btn
                      v-if="block.type === 'text'"
                      flat dense round icon="delete"
                      :aria-label="'Remove ' + blockLabel(block.type)"
                      :disable="!canEdit"
                      @click="removeBlock(index)"
                    />
                  </div>
                </div>
                <q-input
                  v-if="['text', 'about', 'contact'].includes(block.type)"
                  v-model="block.title"
                  outlined
                  dense
                  label="Section title"
                  :disable="!canEdit"
                  class="blog-settings__block-field"
                />
                <q-input
                  v-if="block.type === 'text'"
                  v-model="block.body"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  maxlength="1200"
                  counter
                  label="Text (Markdown)"
                  :disable="!canEdit"
                  class="blog-settings__block-field"
                />
                <q-select
                  v-if="['archive', 'pinned'].includes(block.type)"
                  v-model="block.layout"
                  :options="blockLayoutOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Section layout"
                  :disable="!canEdit"
                  class="blog-settings__block-field"
                />
              </div>
              <div class="blog-settings__block-actions q-mt-sm">
                <q-btn
                  outline
                  no-caps
                  label="Add text section"
                  :disable="!canEdit || form.blocks.length >= 10"
                  @click="addTextBlock"
                />
                <q-btn flat no-caps label="Reset sections" :disable="!canEdit" @click="resetBlocks" />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Custom CSS</h2>
              <q-banner rounded class="blog-settings__banner">
                <template #avatar><q-icon name="code" /></template>
                Only affects this blog subdomain. No JavaScript. Signing always happens on
                banksia.io. Imports, data: URLs and script-era expressions are removed.
              </q-banner>
              <q-input
                v-model="form.css"
                outlined
                dense
                type="textarea"
                autogrow
                maxlength="8000"
                counter
                label="Custom CSS"
                :disable="!canEdit"
                class="blog-settings__css"
              />
              <p class="blog-settings__hint">
                Keep the “Powered by Banksia” footer visible. Use https or /-relative image URLs.
                Prefix selectors with <code>.blog-shell</code> to override the built-in styles.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Portfolio</h2>
              <q-toggle
                v-model="form.portfolioEnabled"
                label="Enable the portfolio page"
                :disable="!canEdit"
              />
              <div class="blog-settings__field">
                <q-input v-model="form.portfolioTitle" outlined dense label="Portfolio title" :disable="!canEdit" />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.portfolioDescription"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  label="Portfolio description"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.portfolioLayout"
                  :options="portfolioLayoutOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Gallery layout"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.portfolioItemsText"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  label="Portfolio post permlinks"
                  hint="One permlink per line, up to 12. Only posts with images appear."
                  :disable="!canEdit"
                />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Shop</h2>
              <q-toggle v-model="form.shopEnabled" label="Enable the shop page" :disable="!canEdit" />
              <div class="blog-settings__field">
                <q-input v-model="form.shopTitle" outlined dense label="Shop title" :disable="!canEdit" />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.shopDescription"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  label="Shop description"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.shopSource"
                  :options="shopSourceOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Product source"
                  :disable="!canEdit"
                  hint="Your own products, or every product posted with one tag."
                />
              </div>
              <div v-if="form.shopSource === 'tag'" class="blog-settings__field">
                <q-input
                  v-model="form.shopTag"
                  outlined
                  dense
                  label="Hive tag"
                  placeholder="hosting"
                  maxlength="24"
                  :disable="!canEdit"
                  hint="Lowercase letters, digits and hyphens. Empty falls back to your own products."
                />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.shopFeaturedText"
                  outlined
                  dense
                  type="textarea"
                  autogrow
                  label="Featured products"
                  :disable="!canEdit"
                  hint="One author/permlink per line, up to 12. Featured products appear first."
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.shopLayout"
                  :options="shopLayoutOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Shop layout"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__field">
                <q-select
                  v-model="form.shopSort"
                  :options="shopSortOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Default sort"
                  :disable="!canEdit"
                />
              </div>
              <div class="blog-settings__toggles">
                <q-toggle v-model="form.shopShowSoldOut" label="Show sold-out and inactive products" :disable="!canEdit" />
              </div>
              <p class="blog-settings__hint">
                Products are normal Hive posts with Hive Open Market metadata:
                <code>content_type: "product"</code>, <code>currency: "HIVE:HBD"</code>
                or <code>"HIVE:HIVE"</code>, <code>price</code> and <code>status</code>.
                Checkout opens on banksia.io; there is no escrow or buyer protection.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Social card</h2>
              <p class="blog-settings__hint">
                The 1200×630 image used when the blog is shared. Generate one from
                the current title and theme, or upload your own.
              </p>
              <img :src="ogPreview" alt="Social card preview" class="blog-settings__og" />
              <div class="blog-settings__og-actions">
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  label="Generate social card"
                  :loading="ogGenerating"
                  :disable="!canEdit || ogGenerating"
                  @click="generateOgImage"
                />
                <image-upload-button
                  ref="ogUpload"
                  :username="accountName"
                  :max-files="1"
                  label="Upload custom"
                  success-message="Social card uploaded"
                  success-caption="Save the blog settings to publish it."
                  :disabled="!canEdit"
                  @insert="onOgUploaded"
                />
                <q-btn
                  v-if="form.ogImage"
                  flat
                  no-caps
                  label="Use theme fallback"
                  @click="form.ogImage = ''"
                />
              </div>
              <p v-if="ogMessage" class="blog-settings__hint q-mt-sm">{{ ogMessage }}</p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Content</h2>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.pinnedText"
                  outlined
                  dense
                  label="Pinned permlinks"
                  :disable="!canEdit"
                  hint="Comma-separated, up to 5. Pinned posts appear in a Start here section."
                />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.authorsText"
                  outlined
                  dense
                  label="Contributors"
                  :disable="!canEdit"
                  hint="Comma-separated Hive accounts for a team or project blog, up to 20."
                />
              </div>
              <div class="blog-settings__field">
                <q-input
                  v-model="form.community"
                  outlined
                  dense
                  label="Community feed (optional)"
                  placeholder="hive-123456"
                  :disable="!canEdit"
                  hint="Merge a Hive community's posts into this blog."
                />
              </div>
              <div class="blog-settings__toggles">
                <q-toggle v-model="form.showComments" label="Show a comments link" :disable="!canEdit" />
                <q-toggle v-model="form.showPayout" label="Show Hive payout on posts" :disable="!canEdit" />
                <q-toggle v-model="form.directory" label="List this blog in the public directory" :disable="!canEdit" />
              </div>
              <p class="blog-settings__hint q-mt-sm">
                Directory listings are checked against your on-chain settings. Save and sign,
                then use “Refresh directory listing” below.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="blog-settings__card">
            <q-card-section>
              <h2 class="blog-settings__section-title">Address</h2>
              <div class="blog-settings__field">
                <q-input :model-value="publicUrl" outlined dense readonly label="Free address" />
              </div>
              <div class="blog-settings__field">
                <q-input
                  :model-value="form.customDomain"
                  outlined
                  dense
                  readonly
                  label="Custom domain"
                  hint="Custom domains are on the roadmap. Until then, this field is read-only."
                />
              </div>
            </q-card-section>
          </q-card>

          <vault-settings
            v-if="account"
            v-model="form.vault"
            :account="account"
            :can-edit="canEdit"
            @save="submit"
            @queue="queueVaultOperation"
          />

          <div class="blog-settings__actions">
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="claimed ? 'Save changes' : 'Claim this blog'"
              :loading="saving"
              :disable="!canEdit || saving"
              @click="submit"
            />
            <q-btn
              flat
              no-caps
              label="Reload from chain"
              :disable="saving"
              @click="reload"
            />
            <q-btn
              flat
              no-caps
              label="Refresh directory listing"
              :loading="directorySyncing"
              :disable="!canEdit || !claimed || directorySyncing"
              @click="syncDirectory"
            />
            <span class="blog-settings__size">{{ metadataBytes }} / {{ maxBlogBytes }} bytes of blog settings</span>
          </div>

          <p v-if="directoryMessage" class="blog-settings__hint q-mt-sm">{{ directoryMessage }}</p>

          <p class="blog-settings__footnote">
            The blog is a reading surface, not a second account. Posts stay on Hive,
            and readers can open any post on Banksia to vote, comment or tip.
          </p>
        </template>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.blog-settings {
  background: var(--c-bg);
}

.blog-settings__shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.blog-settings__crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.blog-settings__crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.blog-settings__head {
  margin-bottom: 1.25rem;
}

.blog-settings__title {
  margin: 0 0 0.4rem;
  font-size: clamp(1.6rem, 3.4vw, 2.2rem);
}

.blog-settings__lede {
  margin: 0;
  max-width: 70ch;
  color: var(--c-text-muted);
  line-height: 1.65;
}

.blog-settings__lede code {
  color: var(--c-text);
  background: var(--c-surface-2);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
}

.blog-settings__card {
  margin-bottom: 1rem;
  background: var(--c-surface);
  border-color: var(--c-border);
}

.blog-settings__section-title {
  margin: 0 0 0.65rem;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.blog-settings__hint {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
}

.blog-settings__hint a {
  color: var(--c-link);
}

.blog-settings__row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.blog-settings__row > :first-child {
  flex: 1;
}

.blog-settings__status-inner {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.blog-settings__status-copy {
  flex: 1;
  min-width: 12rem;
}

.blog-settings__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
}

.blog-settings__badge {
  padding: 0.08rem 0.45rem;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  color: var(--c-text-muted);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.blog-settings__badge--live {
  color: var(--c-positive);
  border-color: var(--c-positive);
}

.blog-settings__banner {
  margin-bottom: 1rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
}

.blog-settings__banner--ok {
  border-color: var(--c-positive);
}

.blog-settings__banner--error {
  border-color: var(--c-negative);
}

.blog-settings__errors {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.86rem;
}

.blog-settings__link-button {
  border: 0;
  background: none;
  color: var(--c-link);
  padding: 0;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.blog-settings__field {
  margin-bottom: 0.9rem;
}

.blog-settings__field:last-child {
  margin-bottom: 0;
}

.blog-settings__label {
  display: block;
  font-size: 0.8rem;
  color: var(--c-text-muted);
  margin-bottom: 0.3rem;
}

.blog-settings__accent {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.blog-settings__color {
  width: 42px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.blog-settings__accent-input {
  flex: 1;
  min-width: 11rem;
}

.blog-settings__toggles {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.blog-settings__og {
  display: block;
  width: 100%;
  max-width: 480px;
  aspect-ratio: 1200 / 630;
  object-fit: cover;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  margin: 0.75rem 0;
  background: var(--c-surface-2);
}

.blog-settings__og-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.blog-settings__brand-preview {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.blog-settings__logo-preview {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
}

.blog-settings__hero-preview {
  width: 180px;
  height: 95px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--c-border);
}

.blog-settings__block {
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-surface);
}

.blog-settings__block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.blog-settings__block-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.blog-settings__block-field {
  margin-top: 0.6rem;
}

.blog-settings__css :deep(textarea) {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.blog-settings__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.blog-settings__size {
  color: var(--c-text-faint);
  font-size: 0.78rem;
}

.blog-settings__footnote {
  margin: 1.25rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.6;
}

@media (max-width: 599px) {
  .blog-settings__row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { BLOG_MAX_BLOCKS, BLOG_MAX_BYTES } from 'src/config/blog'
import { fetchAccount } from 'src/services/chainData'
import { parseAccountMetadata } from 'src/services/accountMetadata'
import { claimBlog, defaultBlogBlocks, readBlogSettings, updateBlog, blogSettingsSize } from 'src/services/blogSettings'
import { defaultVaultSettings } from 'src/services/vaultSettings'
import { blogBaseUrl, encodeBlogLabel } from 'src/services/blogHost'
import { createBlogSocialCardFile } from 'src/services/blogSocialCard'
import { blogThemeOptions, blogOgImagePath } from 'src/themes/blogThemes'
import ImageUploadButton from 'components/ImageUploadButton.vue'
import VaultSettings from 'components/blog/VaultSettings.vue'

function splitList (value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

function parseNavLinks (value) {
  return String(value || '')
    .split('\n')
    .map(line => {
      const [label, ...rest] = line.split('|')
      return { label: String(label || '').trim(), href: rest.join('|').trim() }
    })
    .filter(item => item.label && item.href)
}

function parsePortfolioItems (value) {
  const seen = new Set()
  const items = []
  for (const raw of String(value || '').split(/[\n,]+/)) {
    const item = raw.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]{0,255}$/.test(item) || seen.has(item)) continue
    seen.add(item)
    items.push(item)
    if (items.length >= 12) break
  }
  return items
}

function parseFeaturedItems (value) {
  const seen = new Set()
  const items = []
  for (const raw of String(value || '').split(/[\n,]+/)) {
    const item = raw.trim().toLowerCase().replace(/^@/, '')
    if (!/^[a-z][a-z0-9.-]{2,15}\/[a-z0-9][a-z0-9._-]{0,255}$/.test(item) || seen.has(item)) continue
    seen.add(item)
    items.push(item)
    if (items.length >= 12) break
  }
  return items
}

export default {
  name: 'BlogSettings',
  components: { ImageUploadButton, VaultSettings },
  data () {
    return {
      lookup: '',
      accountName: '',
      account: null,
      settings: null,
      claimed: false,
      loading: false,
      saving: false,
      directorySyncing: false,
      directoryMessage: '',
      ogGenerating: false,
      ogMessage: '',
      error: '',
      errors: [],
      queued: false,
      queuedMessage: '',
      form: {
        title: '',
        description: '',
        theme: 'auto',
        accent: '',
        mode: 'auto',
        layout: 'grid',
        width: 'comfortable',
        typography: 'theme',
        hero: 'cover',
        showTags: true,
        showReadingTime: true,
        navText: '',
        blocks: defaultBlogBlocks(),
        css: '',
        logo: '',
        heroImage: '',
        favicon: '',
        portfolioEnabled: false,
        portfolioTitle: 'Portfolio',
        portfolioDescription: '',
        portfolioLayout: 'grid',
        portfolioItemsText: '',
        shopEnabled: false,
        shopTitle: 'Shop',
        shopDescription: '',
        shopSource: 'account',
        shopTag: '',
        shopFeaturedText: '',
        shopLayout: 'grid',
        shopSort: 'newest',
        shopShowSoldOut: true,
        vault: defaultVaultSettings(null),
        pinnedText: '',
        authorsText: '',
        community: '',
        showPayout: false,
        showComments: true,
        directory: false,
        ogImage: '',
        customDomain: ''
      }
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    canEdit () {
      return Boolean(this.accountName && this.loggedInUser === this.accountName)
    },
    hostLabel () {
      const label = encodeBlogLabel(this.accountName)
      return label ? label + '.banksia.io' : ''
    },
    publicUrl () {
      return blogBaseUrl(this.accountName)
    },
    avatar () {
      if (!this.account) return ''
      const profile = this.accountProfile
      const image = typeof profile.profile_image === 'string' ? profile.profile_image.trim() : ''
      return /^https:\/\//i.test(image)
        ? image
        : 'https://images.hive.blog/u/' + this.account.name + '/avatar'
    },
    accountProfile () {
      const posting = parseAccountMetadata(this.account && this.account.posting_json_metadata).value.profile
      const legacy = parseAccountMetadata(this.account && this.account.json_metadata).value.profile
      return {
        ...(legacy && typeof legacy === 'object' ? legacy : {}),
        ...(posting && typeof posting === 'object' ? posting : {})
      }
    },
    themeOptions () {
      return [
        { label: 'Match my profile skin', value: 'auto', caption: 'Use the theme published to your profile' },
        ...blogThemeOptions()
      ]
    },
    modeOptions () {
      return [
        { label: 'Follow the reader’s system', value: 'auto' },
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' }
      ]
    },
    layoutOptions () {
      return [
        { label: 'Grid cards', value: 'grid' },
        { label: 'List', value: 'list' },
        { label: 'Magazine', value: 'magazine' }
      ]
    },
    widthOptions () {
      return [
        { label: 'Narrow', value: 'narrow' },
        { label: 'Comfortable', value: 'comfortable' },
        { label: 'Wide', value: 'wide' }
      ]
    },
    typographyOptions () {
      return [
        { label: 'Match the theme', value: 'theme' },
        { label: 'Serif', value: 'serif' },
        { label: 'Sans', value: 'sans' },
        { label: 'Monospace', value: 'mono' }
      ]
    },
    heroOptions () {
      return [
        { label: 'Cover image', value: 'cover' },
        { label: 'Minimal', value: 'minimal' }
      ]
    },
    blockLayoutOptions () {
      return [
        { label: 'Use the page layout', value: '' },
        { label: 'Grid cards', value: 'grid' },
        { label: 'List', value: 'list' },
        { label: 'Magazine', value: 'magazine' }
      ]
    },
    portfolioLayoutOptions () {
      return [
        { label: 'Grid', value: 'grid' },
        { label: 'Masonry', value: 'masonry' }
      ]
    },
    shopSourceOptions () {
      return [
        { label: 'My products', value: 'account' },
        { label: 'Products with a Hive tag', value: 'tag' }
      ]
    },
    shopLayoutOptions () {
      return [
        { label: 'Grid', value: 'grid' },
        { label: 'List', value: 'list' }
      ]
    },
    shopSortOptions () {
      return [
        { label: 'Newest first', value: 'newest' },
        { label: 'Price: low to high', value: 'price-asc' },
        { label: 'Price: high to low', value: 'price-desc' }
      ]
    },
    metadataBytes () {
      return this.settings ? blogSettingsSize(this.formSettings()) : 0
    },
    maxBlogBytes () {
      return BLOG_MAX_BYTES
    },
    ogPreview () {
      if (this.form.ogImage) return this.form.ogImage
      return 'https://banksia.io' + blogOgImagePath(this.form.theme)
    }
  },
  watch: {
    '$route.query.account' () {
      this.syncFromRoute()
    },
    loggedInUser (value) {
      if (!this.accountName && value) {
        this.accountName = value
        this.load()
      }
    }
  },
  created () {
    this.syncFromRoute()
    this.updateMeta()
  },
  methods: {
    syncFromRoute () {
      const query = String(this.$route.query.account || '').trim().toLowerCase()
      const next = query || this.loggedInUser || ''
      if (next !== this.accountName) {
        this.accountName = next
        if (next) this.load()
      } else if (next && !this.account) {
        this.load()
      }
    },
    openAccount () {
      const name = String(this.lookup || '').trim().toLowerCase()
      if (!name) return
      this.$router.push({ path: '/settings/blog', query: { account: name } })
    },
    async load () {
      if (!this.accountName) return
      this.loading = true
      this.error = ''
      this.errors = []
      this.queued = false
      try {
        const account = await fetchAccount(this.accountName, { force: true })
        if (!account) {
          this.error = 'That Hive account could not be loaded.'
          this.account = null
          return
        }
        this.account = account
        const read = readBlogSettings(account)
        this.settings = read.settings
        this.claimed = read.claimed
        if (read.error) this.error = read.error
        this.populateForm(read.settings)
      } catch (error) {
        this.error = error && error.message ? error.message : 'The blog settings could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    populateForm (settings) {
      this.form = {
        title: settings.title || '',
        description: settings.description || '',
        theme: settings.theme || 'auto',
        accent: settings.accent || '',
        mode: settings.mode || 'auto',
        layout: settings.layout || 'grid',
        width: settings.width || 'comfortable',
        typography: settings.typography || 'theme',
        hero: settings.hero || 'cover',
        showTags: settings.showTags !== false,
        showReadingTime: settings.showReadingTime !== false,
        navText: (settings.nav || []).map(link => link.label + ' | ' + link.href).join('\n'),
        blocks: (settings.blocks || defaultBlogBlocks()).map(block => ({ ...block })),
        css: settings.css || '',
        logo: settings.logo || '',
        heroImage: settings.heroImage || '',
        favicon: settings.favicon || '',
        portfolioEnabled: settings.portfolio?.enabled === true,
        portfolioTitle: settings.portfolio?.title || 'Portfolio',
        portfolioDescription: settings.portfolio?.description || '',
        portfolioLayout: settings.portfolio?.layout || 'grid',
        portfolioItemsText: (settings.portfolio?.items || []).join('\n'),
        shopEnabled: settings.shop?.enabled === true,
        shopTitle: settings.shop?.title || 'Shop',
        shopDescription: settings.shop?.description || '',
        shopSource: settings.shop?.source || 'account',
        shopTag: settings.shop?.tag || '',
        shopFeaturedText: (settings.shop?.featured || []).join('\n'),
        shopLayout: settings.shop?.layout || 'grid',
        shopSort: settings.shop?.sort || 'newest',
        shopShowSoldOut: settings.shop?.showSoldOut !== false,
        vault: settings.vault ? { ...settings.vault, bulletin: { ...settings.vault.bulletin } } : defaultVaultSettings(this.account),
        pinnedText: (settings.pinned || []).join(', '),
        authorsText: (settings.authors || []).join(', '),
        community: settings.community || '',
        showPayout: settings.showPayout === true,
        showComments: settings.showComments !== false,
        directory: settings.directory === true,
        ogImage: settings.ogImage || '',
        customDomain: settings.customDomain || ''
      }
    },
    formSettings () {
      return {
        ...this.settings,
        title: this.form.title,
        description: this.form.description,
        theme: this.form.theme,
        accent: this.form.accent,
        mode: this.form.mode,
        layout: this.form.layout,
        width: this.form.width,
        typography: this.form.typography,
        hero: this.form.hero,
        showTags: this.form.showTags,
        showReadingTime: this.form.showReadingTime,
        nav: parseNavLinks(this.form.navText),
        blocks: this.form.blocks,
        css: this.form.css,
        logo: this.form.logo,
        heroImage: this.form.heroImage,
        favicon: this.form.favicon,
        portfolio: {
          enabled: this.form.portfolioEnabled,
          title: this.form.portfolioTitle,
          description: this.form.portfolioDescription,
          layout: this.form.portfolioLayout,
          items: parsePortfolioItems(this.form.portfolioItemsText)
        },
        shop: {
          enabled: this.form.shopEnabled,
          title: this.form.shopTitle,
          description: this.form.shopDescription,
          source: this.form.shopSource,
          tag: this.form.shopTag,
          featured: parseFeaturedItems(this.form.shopFeaturedText),
          layout: this.form.shopLayout,
          showSoldOut: this.form.shopShowSoldOut,
          sort: this.form.shopSort
        },
        pinned: splitList(this.form.pinnedText),
        authors: splitList(this.form.authorsText),
        community: this.form.community,
        showPayout: this.form.showPayout,
        showComments: this.form.showComments,
        directory: this.form.directory,
        ogImage: this.form.ogImage,
        customDomain: this.form.customDomain,
        vault: this.form.vault
      }
    },
    queueVaultOperation (operation) {
      if (!this.canEdit || !this.account || !operation) return
      this.queued = true
      this.queuedMessage = 'Vault operation queued with your posting key.'
      this.$hiveStore.addToQueue([this.accountName, 'posting', operation])
    },
    submit () {
      if (!this.canEdit || !this.account) return      this.errors = []
      this.queued = false
      this.saving = true
      try {
        const result = this.claimed
          ? updateBlog(this.account, this.formSettings())
          : claimBlog(this.account, this.formSettings())
        if (!result.ok || !result.operation) {
          this.errors = [result.error || 'The blog settings are not valid.']
          return
        }
        this.$hiveStore.addToQueue([this.accountName, 'posting', result.operation])
        this.queued = true
        this.queuedMessage = this.claimed
          ? 'Blog update queued with your posting key.'
          : 'Blog claim queued with your posting key.'
        this.settings = result.settings
        if (result.settings) {
          this.form.css = result.settings.css || ''
          this.form.blocks = (result.settings.blocks || []).map(block => ({ ...block }))
        }
        if (!this.claimed) this.claimed = true
      } finally {
        this.saving = false
      }
    },
    async reload () {
      this.queued = false
      await this.load()
    },
    async syncDirectory () {
      if (!this.accountName) return
      this.directorySyncing = true
      this.directoryMessage = ''
      try {
        const response = await fetch('/api/blogs/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account: this.accountName })
        })
        const body = await response.json().catch(() => ({}))
        this.directoryMessage = body.listed
          ? 'Listed in the public directory.'
          : (body.error || 'Not listed. Enable the directory toggle, save, sign, then try again.')
      } catch {
        this.directoryMessage = 'The directory could not be reached.'
      } finally {
        this.directorySyncing = false
      }
    },
    async generateOgImage () {
      if (!this.canEdit || !this.account) return
      this.ogGenerating = true
      this.ogMessage = ''
      try {
        const file = await createBlogSocialCardFile({
          title: this.form.title || this.account.name,
          account: this.account.name,
          description: this.form.description,
          theme: this.form.theme,
          accent: this.form.accent
        })
        const uploader = this.$refs.ogUpload
        if (!uploader) throw new Error('The image uploader is not ready.')
        const count = await uploader.uploadFiles([file])
        if (!count) this.ogMessage = 'The social card was not uploaded. Sign in and try again.'
      } catch (error) {
        this.ogMessage = error && error.message ? error.message : 'The social card could not be generated.'
      } finally {
        this.ogGenerating = false
      }
    },
    onOgUploaded (items) {
      const url = Array.isArray(items) && items[0] ? items[0].url : ''
      if (!url) return
      this.form.ogImage = url
      this.ogMessage = 'Social card uploaded. Save the blog settings to publish it.'
    },
    blockLabel (type) {
      return {
        hero: 'Hero',
        pinned: 'Pinned posts',
        archive: 'Post archive',
        about: 'About section',
        contact: 'Contact section',
        text: 'Text section'
      }[type] || type
    },
    moveBlock (index, delta) {
      const next = index + delta
      if (next < 0 || next >= this.form.blocks.length) return
      const blocks = [...this.form.blocks]
      const [item] = blocks.splice(index, 1)
      blocks.splice(next, 0, item)
      this.form.blocks = blocks
    },
    removeBlock (index) {
      if (!this.form.blocks[index] || this.form.blocks[index].type !== 'text') return
      this.form.blocks.splice(index, 1)
    },
    addTextBlock () {
      if (this.form.blocks.length >= BLOG_MAX_BLOCKS) return
      this.form.blocks.push({ type: 'text', visible: true, title: '', body: '', layout: '' })
    },
    resetBlocks () {
      this.form.blocks = defaultBlogBlocks()
    },
    updateMeta () {
      setPageMeta({
        title: 'Blog settings — banksia.io',
        description: 'Claim a free Hive blog at yourname.banksia.io and choose its theme, title and content.',
        url: '/settings/blog',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
