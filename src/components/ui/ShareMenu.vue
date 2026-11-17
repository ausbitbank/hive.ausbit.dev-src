<template>
  <q-btn
    flat
    dense
    round
    icon="share"
    :aria-label="'Share ' + (title || 'this page')"
    :title="'Share ' + (title || 'this page')"
  >
    <q-menu dark auto-close>
      <q-list dense class="share-menu" role="menu" aria-label="Share actions">
        <q-item clickable role="menuitem" @click="copyLink">
          <q-item-section avatar><q-icon name="link" size="18px" /></q-item-section>
          <q-item-section>Copy link</q-item-section>
        </q-item>
        <q-item clickable role="menuitem" @click="copyMarkdown">
          <q-item-section avatar><q-icon name="code" size="18px" /></q-item-section>
          <q-item-section>Copy Markdown</q-item-section>
        </q-item>
        <q-item v-if="canNativeShare" clickable role="menuitem" @click="nativeShare">
          <q-item-section avatar><q-icon name="ios_share" size="18px" /></q-item-section>
          <q-item-section>Share…</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script>
import { copyToClipboard } from 'quasar'

export default {
  name: 'ShareMenu',
  props: {
    title: { type: String, default: '' },
    text: { type: String, default: '' },
    path: { type: String, default: '' }
  },
  computed: {
    shareUrl () {
      if (this.path) {
        try {
          return new URL(this.path, window.location.origin).href
        } catch {
          return window.location.href
        }
      }
      return window.location.href
    },
    canNativeShare () {
      return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    }
  },
  methods: {
    async copyLink () {
      try {
        await copyToClipboard(this.shareUrl)
        this.$q.notify({ message: 'Link copied.', color: 'green', icon: 'link', timeout: 1800 })
      } catch {
        this.$q.notify({ message: 'Could not copy the link.', color: 'negative', icon: 'warning' })
      }
    },
    async copyMarkdown () {
      const label = this.title || this.shareUrl
      try {
        await copyToClipboard('[' + label + '](' + this.shareUrl + ')')
        this.$q.notify({ message: 'Markdown copied.', color: 'green', icon: 'code', timeout: 1800 })
      } catch {
        this.$q.notify({ message: 'Could not copy the Markdown.', color: 'negative', icon: 'warning' })
      }
    },
    async nativeShare () {
      try {
        await navigator.share({
          title: this.title || document.title,
          text: this.text || this.title || '',
          url: this.shareUrl
        })
      } catch {
        // User cancelled or the browser rejected the share sheet.
      }
    }
  }
}
</script>

<style scoped>
.share-menu {
  min-width: 190px;
}
</style>
