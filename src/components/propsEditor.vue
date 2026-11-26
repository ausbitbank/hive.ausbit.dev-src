<template>
    <div class="props-editor">
        <div v-if="type === 'postingMeta'" class="props-editor__media">
            <div class="props-editor__media-head">
                <div class="props-editor__media-title">Profile images</div>
                <div class="props-editor__media-hint">Uploaded through the same image host as post images.</div>
            </div>
            <div class="props-editor__media-grid">
                <div class="props-editor__media-card">
                    <div class="props-editor__preview props-editor__preview--avatar">
                        <q-img v-if="profileImagePreview" :src="profileImagePreview" :alt="'Profile image for @' + username" fit="cover" />
                        <q-icon v-else name="person" size="28px" aria-hidden="true" />
                    </div>
                    <div class="props-editor__media-body">
                        <div class="props-editor__media-label">Profile image</div>
                        <div class="props-editor__media-actions">
                            <image-upload-button
                                :username="username"
                                :max-files="1"
                                :round="false"
                                label="Upload"
                                title="Upload a profile image"
                                aria-label="Upload a profile image"
                                success-message="Profile image uploaded"
                                success-caption="Save the metadata to publish it."
                                @insert="setImageFromUpload('profile_image', $event)"
                            />
                            <q-btn v-if="profileImage" flat dense no-caps size="sm" icon="delete_outline" label="Remove" color="negative" @click="applyProfileField('profile_image', '')" />
                        </div>
                        <q-input v-model="profileImage" dense outlined clearable label="Image URL" class="props-editor__media-url" />
                    </div>
                </div>
                <div class="props-editor__media-card props-editor__media-card--cover">
                    <div class="props-editor__preview props-editor__preview--cover">
                        <q-img v-if="coverImagePreview" :src="coverImagePreview" :alt="'Cover image for @' + username" fit="cover" />
                        <q-icon v-else name="image" size="28px" aria-hidden="true" />
                    </div>
                    <div class="props-editor__media-body">
                        <div class="props-editor__media-label">Cover image</div>
                        <div class="props-editor__media-actions">
                            <image-upload-button
                                :username="username"
                                :max-files="1"
                                :round="false"
                                label="Upload"
                                title="Upload a cover image"
                                aria-label="Upload a cover image"
                                success-message="Cover image uploaded"
                                success-caption="Save the metadata to publish it."
                                @insert="setImageFromUpload('cover_image', $event)"
                            />
                            <q-btn v-if="coverImage" flat dense no-caps size="sm" icon="delete_outline" label="Remove" color="negative" @click="applyProfileField('cover_image', '')" />
                        </div>
                        <q-input v-model="coverImage" dense outlined clearable label="Image URL" class="props-editor__media-url" />
                    </div>
                </div>
            </div>
        </div>

        <q-input
            outlined
            class="props-editor__input"
            type="textarea"
            v-model="newjson"
            label="Edit your metadata directly here or use the helpers below"
            :error="!parsed.ok"
            :error-message="parsed.ok ? '' : parsed.error"
            @update:model-value="onDraftInput"
        />

        <div v-if="type === 'postingMeta'" class="props-editor__note props-editor__note--info">
            <q-icon name="info" size="15px" aria-hidden="true" />
            <span>Saved with your posting key. Apps read profile details and images from this metadata.</span>
        </div>
        <div v-else class="props-editor__note props-editor__note--info">
            <q-icon name="info" size="15px" aria-hidden="true" />
            <span>Legacy metadata needs your active key. Profile images belong in the Posting metadata card.</span>
        </div>

        <div class="props-editor__actions" v-if="dirty">
          <q-btn flat dense no-caps label="Discard" color="grey" icon="restart_alt" @click="discardChanges" />
          <q-btn no-caps dense unelevated label="Submit changes" color="primary" icon="save" @click="submitChanges" />
        </div>
        <div class="props-editor__note props-editor__note--ok" v-if="edited">
            <q-icon name="check_circle" size="15px" aria-hidden="true" />
            <span>Your {{ type === 'postingMeta' ? 'posting ' : '' }}JSON metadata has been edited. Refresh the page in a moment to see the changes.</span>
        </div>
        <div class="props-editor__note" :class="error ? 'props-editor__note--error' : 'props-editor__note--info'" v-if="log !== ''">
            <q-icon :name="error ? 'error_outline' : 'info'" size="15px" aria-hidden="true" />
            <span>{{ log }}</span>
        </div>
        <div class="props-editor__tags">
            <div class="props-editor__tags-title">Commonly supported props</div>
            <q-chip v-for="tag in commonTags" :key="tag" dense clickable :class="{'is-selected': doesKeyExist(tag)}" :removable="doesKeyExist(tag)" @remove="removeKey(tag)" @click="showKeyPrompt(tag)">{{ tag }}</q-chip>
        </div>
        <div class="props-editor__tags" v-if="type !== 'jsonMeta'">
            <div class="props-editor__tags-title">Extra props recognised by this site</div>
            <q-chip v-for="tag in myTags" :key="tag" dense clickable :class="{'is-selected': doesKeyExist(tag)}" :removable="doesKeyExist(tag)" @remove="removeKey(tag)" @click="showKeyPrompt(tag)">{{ tag }}</q-chip>
        </div>
        <json-viewer v-if="parsed.ok" class="props-editor__viewer" :data="parsed.value" />
        <q-dialog v-model="keyDialog" persistent>
        <q-card flat class="props-editor__dialog">
            <div class="props-editor__dialog-head">
              <div class="props-editor__dialog-eyebrow">Metadata</div>
              <h3 class="props-editor__dialog-title">Edit {{ keyDialogCurrentKey }}</h3>
            </div>
            <div class="props-editor__dialog-body">
              <q-input dense v-model="keyDialogCurrentData" outlined autofocus type="textarea" />
            </div>
            <div class="props-editor__dialog-actions">
              <q-btn flat dense no-caps label="Cancel" color="grey" v-close-popup />
              <q-btn unelevated dense no-caps label="Save" color="primary" @click="addKey(keyDialogCurrentKey, keyDialogCurrentData)" v-close-popup />
            </div>
        </q-card>
        </q-dialog>
    </div>
</template>
<script>
import { defineAsyncComponent } from 'vue'
import ImageUploadButton from 'components/ImageUploadButton.vue'
import { safeExternalUrl } from 'src/utils/safeUrl'
import {
  MAX_ACCOUNT_METADATA_BYTES,
  accountMetadataSize,
  buildLegacyMetadataOperation,
  buildPostingMetadataOperation,
  canonicalAccountMetadata,
  formatAccountMetadata,
  hasProfileField,
  parseAccountMetadata,
  profileFromMetadata,
  removeProfileField,
  setProfileField
} from 'src/services/accountMetadata'

const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))

function initialEditorState (raw) {
  const parsed = parseAccountMetadata(raw)
  return {
    newjson: parsed.ok ? formatAccountMetadata(parsed.value) : String(raw || ''),
    baselineValue: parsed.ok ? parsed.value : {},
    baselineCanonical: parsed.ok ? canonicalAccountMetadata(parsed.value) : '',
    baselineValid: parsed.ok
  }
}

export default {
  name: 'propsEditor',
  props: {
    json: {
      type: String,
      required: false,
      default: function () { return '{}' }
    },
    username: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    account: {
      type: Object,
      required: true
    }
  },
  components: { jsonViewer, ImageUploadButton },
  data () {
    const initial = initialEditorState(this.json)
    return {
      ...initial,
      edited: false,
      error: false,
      keyDialog: false,
      keyDialogCurrentKey: '',
      keyDialogCurrentData: '',
      log: '',
      myTags: ['twitter', 'twitch', 'github', 'discord', 'telegram', 'email', 'protonmail', 'bitcoin', 'lightning', 'litecoin', 'ethereum', 'dogecoin', 'ipfs', 'psn', 'steam', 'xbox', 'flickr', 'facebook', 'tumblr', 'linkedin', 'instagram', 'reddit', 'tiktok', 'soundcloud', 'vimeo', 'spotify', 'youtube', 'bandcamp', 'medium', 'keybase', 'vimm', 'threespeak', 'mastodon', 'gab', 'dbuzz', 'wordpress', 'nftshowroom', 'palnet', 'leofinance', 'pgp', 'nostr'],
      commonTags: ['name', 'about', 'location', 'profile_image', 'cover_image', 'website', 'witness_description', 'dtube_pub', 'pinned', 'portfolio', 'trail', 'default_page', 'default_view', 'witness_owner']
    }
  },
  computed: {
    parsed () {
      return parseAccountMetadata(this.newjson)
    },
    profile () {
      return profileFromMetadata(this.parsed.ok ? this.parsed.value : {})
    },
    dirty () {
      if (!this.parsed.ok) return true
      return canonicalAccountMetadata(this.parsed.value) !== this.baselineCanonical
    },
    profileImage: {
      get () { return this.profile.profile_image || '' },
      set (value) { this.applyProfileField('profile_image', value) }
    },
    coverImage: {
      get () { return this.profile.cover_image || '' },
      set (value) { this.applyProfileField('cover_image', value) }
    },
    profileImagePreview () {
      return safeExternalUrl(this.profileImage)
    },
    coverImagePreview () {
      return safeExternalUrl(this.coverImage)
    }
  },
  methods: {
    applyProfileField (key, value) {
      if (!this.parsed.ok) {
        this.setLog('Fix the JSON error before using the metadata helpers.', true)
        return
      }
      const text = value === null || value === undefined ? '' : String(value).trim()
      const next = text
        ? setProfileField(this.parsed.value, key, text)
        : removeProfileField(this.parsed.value, key)
      this.newjson = formatAccountMetadata(next)
      this.edited = false
      this.setLog('', false)
    },
    setImageFromUpload (key, images) {
      const image = Array.isArray(images) ? images[0] : null
      if (!image || !image.url) return
      this.applyProfileField(key, image.url)
    },
    setLog (message, isError) {
      this.log = message
      this.error = isError
    },
    onDraftInput () {
      if (this.edited) this.edited = false
      if (this.log) this.setLog('', false)
    },
    submitChanges () {
      if (!this.parsed.ok) {
        this.setLog(this.parsed.error, true)
        return
      }
      if (accountMetadataSize(this.parsed.value) > MAX_ACCOUNT_METADATA_BYTES) {
        this.setLog('Metadata is larger than 16 KB. Remove some fields or shorten the values.', true)
        return
      }

      const jsonMetadata = JSON.stringify(this.parsed.value)
      try {
        if (this.type === 'postingMeta') {
          this.$hiveStore.addToQueue([
            this.username,
            'posting',
            buildPostingMetadataOperation(this.username, jsonMetadata)
          ])
        } else if (this.type === 'jsonMeta') {
          const operation = buildLegacyMetadataOperation(this.account, jsonMetadata)
          if (!operation) {
            this.setLog('The account is missing its posting authority or memo key, so legacy metadata cannot be updated safely.', true)
            return
          }
          this.$hiveStore.addToQueue([this.username, 'active', operation])
        } else {
          this.setLog('Unknown metadata type.', true)
          return
        }
      } catch (error) {
        this.setLog(error?.message || 'Could not queue the metadata update.', true)
        return
      }

      this.baselineValue = this.parsed.value
      this.baselineCanonical = canonicalAccountMetadata(this.parsed.value)
      this.baselineValid = true
      this.newjson = formatAccountMetadata(this.parsed.value)
      this.edited = true
      this.setLog('', false)
      this.$emit('editedProps')
    },
    discardChanges () {
      if (!this.baselineValid) {
        this.baselineValue = {}
        this.baselineCanonical = canonicalAccountMetadata({})
        this.baselineValid = true
      }
      this.newjson = formatAccountMetadata(this.baselineValue)
      this.edited = false
      this.setLog('', false)
    },
    doesKeyExist (key) {
      return hasProfileField(this.parsed.ok ? this.parsed.value : {}, key)
    },
    removeKey (key) {
      if (!this.parsed.ok) {
        this.setLog('Fix the JSON error before removing a prop.', true)
        return
      }
      this.newjson = formatAccountMetadata(removeProfileField(this.parsed.value, key))
      this.edited = false
    },
    addKey (key, data) {
      if (key === undefined || data === undefined || String(data).trim() === '') {
        this.setLog('Not adding empty key', true)
        return
      }
      this.applyProfileField(key, data)
    },
    showKeyPrompt (key) {
      const value = this.profile[key]
      this.keyDialogCurrentKey = key
      this.keyDialogCurrentData = typeof value === 'string'
        ? value
        : (value === null || value === undefined ? '' : JSON.stringify(value))
      this.keyDialog = true
    }
  }
}
</script>

<style scoped>
.props-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.props-editor__input :deep(textarea) {
  min-height: 140px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
}

.props-editor__media {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.props-editor__media-head {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.props-editor__media-title {
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.props-editor__media-hint {
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.props-editor__media-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.45rem;
}

.props-editor__media-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: start;
  gap: 0.5rem;
}

.props-editor__media-card--cover {
  grid-template-columns: minmax(0, 1fr);
}

.props-editor__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-shadow) 20%, transparent);
  color: var(--c-text-faint);
}

.props-editor__preview :deep(.q-img) {
  width: 100%;
  height: 100%;
}

.props-editor__preview--avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.props-editor__preview--cover {
  width: 100%;
  height: 88px;
}

.props-editor__media-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.props-editor__media-label {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  font-weight: 500;
}

.props-editor__media-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.15rem;
}

.props-editor__media-url :deep(input) {
  font-size: 0.72rem;
}

.props-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
}

.props-editor__note {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.props-editor__note .q-icon {
  flex: none;
  margin-top: 1px;
}

.props-editor__note--ok {
  border-color: color-mix(in srgb, var(--c-positive) 32%, transparent);
  background: color-mix(in srgb, var(--c-positive) 6%, transparent);
  color: var(--c-positive);
}

.props-editor__note--info {
  color: var(--c-link-hover);
}

.props-editor__note--error {
  border-color: color-mix(in srgb, var(--c-negative) 32%, transparent);
  background: color-mix(in srgb, var(--c-negative) 6%, transparent);
  color: var(--c-negative);
}

.props-editor__tags-title {
  margin-bottom: 0.2rem;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.props-editor__tags .q-chip {
  margin: 0 0.25rem 0.25rem 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-muted);
  font-size: 0.7rem;
}

.props-editor__tags .q-chip.is-selected {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 12%, transparent);
  color: var(--c-link-soft);
}

.props-editor__viewer {
  overflow: auto;
  max-height: 240px;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-shadow) 20%, transparent);
  font-size: 0.72rem;
}

.props-editor__dialog {
  width: min(420px, 94vw);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
  box-shadow: var(--shadow-pop);
}

.props-editor__dialog-head {
  padding: var(--space-3) var(--space-3) 0;
}

.props-editor__dialog-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.props-editor__dialog-title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.props-editor__dialog-body {
  padding: var(--space-3);
}

.props-editor__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: 0 var(--space-3) var(--space-3);
}
</style>
