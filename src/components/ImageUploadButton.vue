<template>
  <span class="image-upload-btn">
    <q-btn
      :flat="flat"
      :dense="dense"
      :round="round"
      :size="size"
      :color="color"
      :label="label"
      icon="add_photo_alternate"
      type="button"
      :loading="busy"
      :disable="disabled || busy"
      :aria-label="busy ? 'Uploading image' : ariaLabel"
      :title="busy ? 'Uploading image…' : title"
      @click="openPicker"
    />
    <input
      ref="input"
      class="image-upload-btn__input"
      type="file"
      accept="image/*"
      :multiple="maxFiles > 1"
      tabindex="-1"
      aria-hidden="true"
      @change="onFileChange"
    >
  </span>
</template>

<style scoped>
.image-upload-btn {
  display: inline-flex;
  flex: none;
}

.image-upload-btn__input {
  display: none;
}
</style>

<script>
import { LocalStorage } from 'quasar'
import { altFromFileName } from 'src/utils/media'
import {
  appendUploadHistory,
  buildImageSigningPayload,
  imageHostErrorMessage,
  readImageBytes,
  uploadImage,
  validateImageFile
} from 'src/services/imageHost'
import { signImageUploadChallenge } from 'src/services/imageSigning'

export default {
  name: 'ImageUploadButton',
  props: {
    username: { type: String, default: '' },
    loginType: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    label: { type: String, default: '' },
    title: { type: String, default: 'Upload image' },
    ariaLabel: { type: String, default: 'Upload image' },
    maxFiles: { type: Number, default: 4 },
    color: { type: String, default: '' },
    round: { type: Boolean, default: true },
    flat: { type: Boolean, default: true },
    dense: { type: Boolean, default: true },
    size: { type: String, default: 'sm' }
  },
  emits: ['insert', 'before-pick'],
  data () {
    return {
      busy: false,
      progress: 0
    }
  },
  computed: {
    account () {
      return this.username || this.$hiveStore?.user?.username || ''
    },
    mode () {
      return this.loginType || this.$hiveStore?.user?.loginType || ''
    },
    smartlockSessionMs () {
      const minutes = Number(this.$hiveStore?.user?.settings?.smartlockSessionMinutes) || 15
      return minutes * 60 * 1000
    }
  },
  methods: {
    openPicker () {
      if (this.busy || this.disabled) return
      if (!this.account) {
        this.$q.notify({
          type: 'warning',
          message: 'Log in to upload images',
          caption: 'Keychain, SmartLock or HiveAuth signs the upload.'
        })
        return
      }
      this.$emit('before-pick')
      const input = this.$refs.input
      if (!input) return
      input.value = ''
      input.click()
    },
    onFileChange (event) {
      const files = Array.from(event?.target?.files || [])
      if (event?.target) event.target.value = ''
      this.uploadFiles(files)
    },
    /**
     * Public entry point for paste and drop handlers. Returns the number of
     * images that uploaded and were emitted for insertion.
     */
    async uploadFiles (files) {
      if (this.busy) return 0
      const candidates = Array.from(files || [])
      if (!candidates.length) return 0
      if (!this.account) {
        this.$q.notify({
          type: 'warning',
          message: 'Log in to upload images',
          caption: 'Keychain, SmartLock or HiveAuth signs the upload.'
        })
        return 0
      }

      const accepted = []
      for (const file of candidates) {
        const validation = validateImageFile(file)
        if (!validation.ok) {
          this.$q.notify({
            type: 'negative',
            message: validation.error,
            caption: String(file?.name || '')
          })
          continue
        }
        accepted.push(file)
      }
      if (!accepted.length) return 0

      const max = Math.max(1, Number(this.maxFiles) || 1)
      const queue = accepted.slice(0, max)
      if (accepted.length > queue.length) {
        this.$q.notify({
          type: 'warning',
          message: 'Only ' + max + ' images can be uploaded at once.'
        })
      }

      this.busy = true
      this.progress = 0
      const uploaded = []
      let dismiss = null
      try {
        dismiss = this.$q.notify({
          spinner: true,
          message: queue.length > 1 ? 'Uploading ' + queue.length + ' images…' : 'Uploading image…',
          timeout: 0
        })
      } catch {
        // A missing notifier must not block the upload itself.
      }

      try {
        for (const file of queue) {
          try {
            const bytes = await readImageBytes(file)
            const signature = await signImageUploadChallenge({
              username: this.account,
              loginType: this.mode,
              payload: buildImageSigningPayload(bytes),
              smartlockSessionMs: this.smartlockSessionMs,
              promptPassword: () => this.promptSmartlockPassword()
            })
            const url = await uploadImage({
              username: this.account,
              signature,
              file,
              onProgress: value => { this.progress = value }
            })
            const alt = altFromFileName(file.name)
            uploaded.push({ url, alt })
            appendUploadHistory(LocalStorage, this.account, {
              url,
              alt,
              name: file.name,
              size: file.size,
              type: file.type
            })
          } catch (error) {
            this.$q.notify({
              type: 'negative',
              message: imageHostErrorMessage(error),
              caption: String(file?.name || '')
            })
            // A cancelled signature would only prompt again for the next file.
            if (/cancel|denied/i.test(String(error?.message || ''))) break
            if (/cancel|denied/i.test(String(error?.code || ''))) break
          }
        }
      } finally {
        if (typeof dismiss === 'function') dismiss()
        this.busy = false
        this.progress = 0
      }

      if (uploaded.length) {
        this.$emit('insert', uploaded)
        this.$q.notify({
          type: 'positive',
          message: uploaded.length > 1 ? uploaded.length + ' images uploaded' : 'Image uploaded',
          caption: 'Inserted into your post.'
        })
      }
      return uploaded.length
    },
    promptSmartlockPassword () {
      return new Promise(resolve => {
        this.$q.dialog({
          title: 'Unlock SmartLock',
          message: 'Enter the SmartLock password to sign the image upload.',
          prompt: { model: '', type: 'password', outlined: true, label: 'Password' },
          cancel: true,
          persistent: true
        }).onOk(resolve).onCancel(() => resolve(''))
      })
    }
  }
}
</script>
