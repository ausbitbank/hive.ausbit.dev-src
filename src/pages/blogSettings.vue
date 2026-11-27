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
            <span class="blog-settings__size">{{ metadataBytes }} / 4000 bytes of blog settings</span>
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
import { fetchAccount } from 'src/services/chainData'
import { parseAccountMetadata } from 'src/services/accountMetadata'
import { claimBlog, readBlogSettings, updateBlog, blogSettingsSize } from 'src/services/blogSettings'
import { blogBaseUrl, encodeBlogLabel } from 'src/services/blogHost'
import { createBlogSocialCardFile } from 'src/services/blogSocialCard'
import { blogThemeOptions, blogOgImagePath } from 'src/themes/blogThemes'
import ImageUploadButton from 'components/ImageUploadButton.vue'

function splitList (value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

export default {
  name: 'BlogSettings',
  components: { ImageUploadButton },
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
    metadataBytes () {
      return this.settings ? blogSettingsSize(this.settings) : 0
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
        pinned: splitList(this.form.pinnedText),
        authors: splitList(this.form.authorsText),
        community: this.form.community,
        showPayout: this.form.showPayout,
        showComments: this.form.showComments,
        directory: this.form.directory,
        ogImage: this.form.ogImage,
        customDomain: this.form.customDomain
      }
    },
    submit () {
      if (!this.canEdit || !this.account) return
      this.errors = []
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
