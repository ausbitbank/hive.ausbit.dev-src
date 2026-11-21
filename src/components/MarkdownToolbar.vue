<template>
  <div class="md-toolbar" role="toolbar" aria-label="Markdown formatting">
    <q-btn flat dense round size="sm" icon="format_bold" aria-label="Bold" title="Bold (Ctrl+B)" @click="emitAction('bold')" />
    <q-btn flat dense round size="sm" icon="format_italic" aria-label="Italic" title="Italic (Ctrl+I)" @click="emitAction('italic')" />
    <q-btn flat dense round size="sm" icon="format_underlined" aria-label="Underline" title="Underline (Ctrl+U)" @click="emitAction('underline')" />
    <q-btn flat dense round size="sm" icon="strikethrough_s" aria-label="Strikethrough" title="Strikethrough (Ctrl+Shift+X)" @click="emitAction('strikethrough')" />

    <q-btn-dropdown
      flat
      dense
      round
      size="sm"
      icon="format_size"
      aria-label="Heading"
      title="Heading"
      class="md-toolbar__dropdown"
    >
      <q-list dense>
        <q-item clickable v-close-popup @click="emitAction('heading1')">
          <q-item-section>Heading 1</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="emitAction('heading2')">
          <q-item-section>Heading 2</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="emitAction('heading3')">
          <q-item-section>Heading 3</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <q-btn flat dense round size="sm" icon="format_quote" aria-label="Quote" title="Quote" @click="emitAction('quote')" />
    <q-btn flat dense round size="sm" icon="format_list_bulleted" aria-label="Bullet list" title="Bullet list" @click="emitAction('bulletList')" />
    <q-btn flat dense round size="sm" icon="format_list_numbered" aria-label="Numbered list" title="Numbered list" @click="emitAction('numberList')" />
    <q-btn flat dense round size="sm" icon="checklist" aria-label="Task list" title="Task list" @click="emitAction('taskList')" />

    <q-separator vertical class="q-mx-xs" />
    <q-btn flat dense round size="sm" icon="link" aria-label="Insert link" title="Insert link (Ctrl+K)" @click="openLink" />
    <q-btn flat dense round size="sm" icon="add_photo_alternate" aria-label="Upload image" title="Upload image" @click="$emit('upload')" />
    <q-btn flat dense round size="sm" icon="image" aria-label="Insert image URL" title="Insert image URL" @click="openImage" />
    <q-btn flat dense round size="sm" icon="format_align_center" aria-label="Center image or text" title="Center image or text" @click="emitAction('center')" />
    <q-btn flat dense round size="sm" icon="video_library" aria-label="Insert media embed" title="Insert video, audio or social embed" @click="openMedia" />
    <q-btn flat dense round size="sm" icon="table_chart" aria-label="Insert table" title="Insert table" @click="openTable" />
    <q-btn flat dense round size="sm" icon="code" aria-label="Inline code" title="Inline code" @click="emitAction('inlineCode')" />
    <q-btn flat dense round size="sm" icon="data_object" aria-label="Code block" title="Code block" @click="emitAction('codeBlock')" />
    <q-btn flat dense round size="sm" icon="horizontal_rule" aria-label="Divider" title="Divider" @click="emitAction('divider')" />
    <q-space />
    <slot name="end" />
  </div>

  <q-dialog v-model="linkOpen">
    <q-card class="md-toolbar__dialog">
      <q-card-section class="md-toolbar__dialog-head">
        <div>
          <div class="home-eyebrow">Markdown</div>
          <h2 class="home-panel__title">Insert link</h2>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close link dialog" title="Close" @click="linkOpen = false" />
      </q-card-section>
      <q-separator />
      <q-card-section class="md-toolbar__fields">
        <q-input v-model.trim="linkLabel" label="Link text" dense outlined autofocus aria-label="Link text" />
        <q-input v-model.trim="linkUrl" label="URL" dense outlined aria-label="Link URL" hint="https://…" @keyup.enter="insertLink" />
        <div v-if="linkError" class="md-toolbar__error" role="alert">{{ linkError }}</div>
      </q-card-section>
      <q-card-actions align="right" class="md-toolbar__actions">
        <q-btn flat no-caps label="Cancel" @click="linkOpen = false" />
        <q-btn unelevated no-caps color="primary" icon="add_link" label="Insert link" @click="insertLink" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog v-model="imageOpen">
    <q-card class="md-toolbar__dialog">
      <q-card-section class="md-toolbar__dialog-head">
        <div>
          <div class="home-eyebrow">Markdown</div>
          <h2 class="home-panel__title">Insert image</h2>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close image dialog" title="Close" @click="imageOpen = false" />
      </q-card-section>
      <q-separator />
      <q-card-section class="md-toolbar__fields">
        <q-input v-model.trim="imageAlt" label="Alternative text" dense outlined autofocus aria-label="Image alternative text" hint="Describe the image for screen readers" />
        <q-input v-model.trim="imageUrl" label="Image URL" dense outlined aria-label="Image URL" hint="https://…" @keyup.enter="insertImage" />
        <div v-if="imageError" class="md-toolbar__error" role="alert">{{ imageError }}</div>
      </q-card-section>
      <q-card-actions align="right" class="md-toolbar__actions">
        <q-btn flat no-caps label="Cancel" @click="imageOpen = false" />
        <q-btn unelevated no-caps color="primary" icon="add_photo_alternate" label="Insert image" @click="insertImage" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog v-model="tableOpen">
    <q-card class="md-toolbar__dialog">
      <q-card-section class="md-toolbar__dialog-head">
        <div>
          <div class="home-eyebrow">Markdown</div>
          <h2 class="home-panel__title">Insert table</h2>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close table dialog" title="Close" @click="tableOpen = false" />
      </q-card-section>
      <q-separator />
      <q-card-section class="md-toolbar__fields">
        <div class="md-toolbar__row">
          <q-input v-model.number="tableColumns" type="number" min="1" max="8" label="Columns" dense outlined aria-label="Table columns" />
          <q-input v-model.number="tableRows" type="number" min="2" max="20" label="Rows" dense outlined aria-label="Table rows" />
        </div>
        <p class="md-toolbar__hint">A header row and a divider row are included.</p>
      </q-card-section>
      <q-card-actions align="right" class="md-toolbar__actions">
        <q-btn flat no-caps label="Cancel" @click="tableOpen = false" />
        <q-btn unelevated no-caps color="primary" icon="table_chart" label="Insert table" @click="insertTable" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog v-model="mediaOpen">
    <q-card class="md-toolbar__dialog">
      <q-card-section class="md-toolbar__dialog-head">
        <div>
          <div class="home-eyebrow">Markdown</div>
          <h2 class="home-panel__title">Insert media</h2>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close media dialog" title="Close" @click="mediaOpen = false" />
      </q-card-section>
      <q-separator />
      <q-card-section class="md-toolbar__fields">
        <q-input
          v-model.trim="mediaUrl"
          label="Media URL"
          dense
          outlined
          autofocus
          aria-label="Media URL"
          hint="YouTube, 3Speak, Vimeo, Odysee, Rumble, BitChute, DTube, Spotify, SoundCloud, Twitch or X"
          @update:model-value="detectMedia"
          @keyup.enter="insertMedia"
        />
        <div v-if="mediaDetected" class="md-toolbar__media">
          <img v-if="mediaDetected.thumbnail" :src="mediaDetected.thumbnail" :alt="mediaDetected.provider + ' thumbnail'" />
          <div>
            <div class="md-toolbar__media-provider">{{ mediaDetected.provider }}</div>
            <div class="md-toolbar__media-kind">{{ mediaDetected.kind }} · inserts a {{ mediaDetected.kind === 'audio' || mediaDetected.kind === 'live' ? 'player' : 'link' }}</div>
          </div>
        </div>
        <div v-if="mediaError" class="md-toolbar__error" role="alert">{{ mediaError }}</div>
      </q-card-section>
      <q-card-actions align="right" class="md-toolbar__actions">
        <q-btn flat no-caps label="Cancel" @click="mediaOpen = false" />
        <q-btn unelevated no-caps color="primary" icon="video_library" label="Insert media" @click="insertMedia" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.md-toolbar {
  display: flex;
  align-items: center;
  gap: 0.05rem;
  overflow-x: auto;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-bottom: 0;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: rgba(255, 255, 255, 0.035);
}

.md-toolbar .q-btn,
.md-toolbar__dropdown {
  flex: none;
}

.md-toolbar__dropdown :deep(.q-btn__content) {
  gap: 0;
}

.md-toolbar__dialog {
  width: 480px;
  max-width: 94vw;
  overflow: hidden;
  background: #1d1d1d;
}

.md-toolbar__dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.8rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.md-toolbar__fields {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
}

.md-toolbar__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.md-toolbar__hint {
  margin: 0;
  color: #78909c;
  font-size: 0.72rem;
}

.md-toolbar__error {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #ff8a80;
  font-size: 0.75rem;
}

.md-toolbar__media {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
}

.md-toolbar__media img {
  width: 104px;
  height: 58px;
  object-fit: cover;
  border-radius: 3px;
}

.md-toolbar__media-provider {
  color: #e4eaed;
  font-size: 0.8rem;
  font-weight: 600;
}

.md-toolbar__media-kind {
  color: #90a4ae;
  font-size: 0.7rem;
}

.md-toolbar__actions {
  padding: 0.55rem 0.85rem 0.7rem;
  border-top: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
}

@media (max-width: 599px) {
  .md-toolbar {
    flex-wrap: wrap;
    overflow-x: visible;
  }

  .md-toolbar :deep(.q-space) {
    display: none;
  }
}
</style>

<script>
import { safeExternalUrl } from 'src/utils/safeUrl'
import { detectEmbed } from 'src/services/embeds'

export default {
  name: 'MarkdownToolbar',
  emits: ['action', 'upload'],
  data () {
    return {
      linkOpen: false,
      linkLabel: '',
      linkUrl: '',
      linkError: '',
      imageOpen: false,
      imageAlt: '',
      imageUrl: '',
      imageError: '',
      tableOpen: false,
      tableRows: 3,
      tableColumns: 3,
      mediaOpen: false,
      mediaUrl: '',
      mediaError: '',
      mediaDetected: null
    }
  },
  methods: {
    emitAction (type) {
      this.$emit('action', { type })
    },
    openLink () {
      this.linkLabel = ''
      this.linkUrl = ''
      this.linkError = ''
      this.linkOpen = true
    },
    insertLink () {
      const url = safeExternalUrl(this.linkUrl, { allowMailto: true })
      if (!url) {
        this.linkError = 'Enter a valid http(s) or mailto link.'
        return
      }
      this.linkError = ''
      this.$emit('action', { type: 'link', label: this.linkLabel || url, url })
      this.linkOpen = false
    },
    openImage () {
      this.imageAlt = ''
      this.imageUrl = ''
      this.imageError = ''
      this.imageOpen = true
    },
    insertImage () {
      const url = safeExternalUrl(this.imageUrl)
      if (!url) {
        this.imageError = 'Enter a valid http(s) image URL.'
        return
      }
      this.imageError = ''
      this.$emit('action', { type: 'image', alt: this.imageAlt || 'image', url })
      this.imageOpen = false
    },
    openTable () {
      this.tableRows = 3
      this.tableColumns = 3
      this.tableOpen = true
    },
    insertTable () {
      this.$emit('action', {
        type: 'table',
        rows: Math.min(20, Math.max(2, Number(this.tableRows) || 3)),
        columns: Math.min(8, Math.max(1, Number(this.tableColumns) || 3))
      })
      this.tableOpen = false
    },
    openMedia () {
      this.mediaUrl = ''
      this.mediaError = ''
      this.mediaDetected = null
      this.mediaOpen = true
    },
    detectMedia () {
      this.mediaDetected = detectEmbed(this.mediaUrl)
      this.mediaError = ''
    },
    insertMedia () {
      const detected = detectEmbed(this.mediaUrl)
      if (!detected) {
        this.mediaError = 'Enter a supported media URL.'
        return
      }
      this.$emit('action', { type: 'embed', markdown: detected.markdown })
      this.mediaOpen = false
    }
  }
}
</script>
